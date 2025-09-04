import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import Uint1Array from "../Uint1Array.js";
import { create_unsuspended_promise, unsuspended_promise } from "unsuspended-promise";
import { bigint_ceil } from "../uoe/bigint_ceil.js";
import { oti_decode as oti_decode_raw } from "../raptorq_raw/oti_decode.js";
import { oti_encode as oti_encode_raw } from "../raptorq_raw/oti_encode.js";
import { oti_decode } from "./oti_decode.js";
import { exact_strategy } from "./exact_strategy.js";

// Safe wrapper functions that validate transformations
const safe_max_value = (bits) => {
	if (bits === 0n) return 0n;
	return (1n << bits) - 1n;
};

const create_safe_wrappers = (remap, external_bits, max_internal_bits) => {
	const max_external_value = external_bits === 0n ? 0n : safe_max_value(external_bits);
	const max_internal_value = safe_max_value(max_internal_bits);

	const to_internal_safe = (external_value) => {
		const internal_value = remap.to_internal(external_value);

		if (false
			|| typeof internal_value !== "bigint"
			|| internal_value < 0n
			|| internal_value > max_internal_value
		) {
			throw_error(error_user_payload(`to_internal returned invalid value ${internal_value}. Must be bigint between 0n and ${max_internal_value}.`));
		}

		// Double-check round-trip consistency (only if external_bits > 0n)
		if (external_bits > 0n) {
			const round_trip_external = remap.to_external(internal_value);

			if (round_trip_external === undefined) {
				throw_error(error_user_payload(`Internal value ${internal_value} cannot be represented externally (to_external returned undefined).`));
			}

			if (round_trip_external !== external_value) {
				throw_error(error_user_payload(`to_internal / to_external are not consistent.${external_value} -> ${internal_value} -> ${round_trip_external}`));
			}
		}

		return internal_value;
	};

	const to_external_safe = (internal_value) => {
		if (external_bits === 0n) {
			return undefined;
		}

		const external_value = remap.to_external(internal_value);

		// Allow to_external to return undefined to indicate non-representable values
		if (external_value === undefined) {
			throw_error(error_user_payload(`Internal value ${internal_value} cannot be represented externally(to_external returned undefined).`));
		}

		if (false
			|| typeof external_value !== "bigint"
			|| external_value < 0n
			|| external_value > max_external_value
		) {
			throw_error(error_user_payload(`to_external returned invalid value ${external_value}.Must be bigint between 0n and ${max_external_value}.`));
		}

		// Double-check round-trip consistency
		const round_trip_internal = remap.to_internal(external_value);
		if (round_trip_internal !== internal_value) {
			throw_error(error_user_payload(`to_internal / to_external are not consistent.${internal_value} -> ${external_value} -> ${round_trip_internal}`));
		}

		return external_value;
	};

	return { to_internal_safe, to_external_safe };
};

const obtain_async_iterator = (promise_like) => {
	return async function* () {
		const iterator = await promise_like;

		for await (const entry of iterator) {
			yield entry;
		}
	};
};

// Factory function to create process_oti function for a given strategy
const create_process_oti = (strategy) => {
	return (input_oti) => {
		console.log("===== decoded", oti_decode(strategy, input_oti));
		return oti_encode_raw(oti_decode(strategy, input_oti));
	};
};


export const _decode = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
	strategy ??= {};

	// Use exact_strategy to handle all defaults and validation
	strategy = exact_strategy(strategy);

	// Create safe wrappers for SBN (8 bits is the default max for internal SBN)
	const sbn_wrappers = create_safe_wrappers(strategy.encoding_packet.sbn.remap, strategy.encoding_packet.sbn.external_bits, 8n);

	// Create safe wrappers for ESI (24 bits is the default max for internal ESI)
	const esi_wrappers = create_safe_wrappers(strategy.encoding_packet.esi.remap, strategy.encoding_packet.esi.external_bits, 24n);

	// Create the process_oti function using the factory
	const process_oti = create_process_oti(strategy);

	const processed_oti = process_oti(oti);

	// Transform the encoding packets based on strategy before passing to raw decode
	const transformed_encoding_packets = {
		async *[Symbol.asyncIterator]() {
			for await (const packet of encoding_packets) {
				let transformed_packet;

				if (strategy.encoding_packet.sbn.external_bits === 0n) {
					// Extract ESI from packed bits using Uint1Array
					const esi_bits = strategy.encoding_packet.esi.external_bits;
					const esi_bytes_needed = bigint_ceil(esi_bits, 8n);
					const esi_packed_bytes = packet.slice(0, Number(esi_bytes_needed));

					// Create Uint1Array from packed bytes to extract ESI bits
					const combined_array = new Uint1Array(Number(esi_bits));
					combined_array.get_underlying_buffer().set(esi_packed_bytes);

					// Extract ESI array (entire array in this case)
					const esi_array = combined_array.slice(0, Number(esi_bits));
					const external_esi = esi_array.to_bigint();

					// Apply ESI remap to get internal ESI value using safe wrapper
					const internal_esi = esi_wrappers.to_internal_safe(external_esi);

					// Convert internal ESI to 3-byte format using BigInt for safe shifting
					const internal_esi_bytes = new Uint8Array(3);
					internal_esi_bytes[0] = Number((internal_esi >> 16n) & 0xFFn);
					internal_esi_bytes[1] = Number((internal_esi >> 8n) & 0xFFn);
					internal_esi_bytes[2] = Number(internal_esi & 0xFFn);

					// Reconstruct packet: SBN (0) + internal ESI (3 bytes) + symbol data
					const symbol_data = packet.slice(Number(esi_bytes_needed));
					transformed_packet = new Uint8Array(1 + 3 + symbol_data.length);
					transformed_packet[0] = 0; // SBN is 0 since external_bits is 0
					transformed_packet.set(internal_esi_bytes, 1);
					transformed_packet.set(symbol_data, 4);
				} else {
					// Extract SBN+ESI from packed bits using unified Uint1Array
					const total_bits = strategy.encoding_packet.sbn.external_bits + strategy.encoding_packet.esi.external_bits;
					const total_bytes_needed = bigint_ceil(total_bits, 8n);
					const packed_bytes = packet.slice(0, Number(total_bytes_needed));

					// Create unified Uint1Array from packed bytes
					const combined_array = new Uint1Array(Number(total_bits));
					combined_array.get_underlying_buffer().set(packed_bytes);

					// Extract separate SBN and ESI arrays
					const sbn_array = combined_array.slice(0, Number(strategy.encoding_packet.sbn.external_bits));
					const esi_array = combined_array.slice(Number(strategy.encoding_packet.sbn.external_bits), Number(total_bits));

					// Convert to values using BigInt
					const external_sbn = sbn_array.to_bigint();
					const external_esi = esi_array.to_bigint();

					// Apply remap functions to get internal values using safe wrappers
					const internal_sbn = sbn_wrappers.to_internal_safe(external_sbn);
					const internal_esi = esi_wrappers.to_internal_safe(external_esi);

					// Convert internal ESI to 3-byte format
					const internal_esi_bytes = new Uint8Array(3);
					internal_esi_bytes[0] = Number((internal_esi >> 16n) & 0xFFn);
					internal_esi_bytes[1] = Number((internal_esi >> 8n) & 0xFFn);
					internal_esi_bytes[2] = Number(internal_esi & 0xFFn);

					// Reconstruct packet: SBN (1 byte) + internal ESI (3 bytes) + symbol data
					const symbol_data = packet.slice(Number(total_bytes_needed));
					transformed_packet = new Uint8Array(1 + 3 + symbol_data.length);
					transformed_packet[0] = Number(internal_sbn & 0xFFn); // Convert to single byte
					transformed_packet.set(internal_esi_bytes, 1);
					transformed_packet.set(symbol_data, 4);
				}

				yield transformed_packet;
			}
		}
	};

	return raptorq_raw.decode({ usage, oti: processed_oti, encoding_packets: transformed_encoding_packets });
};

// Helper function to calculate expected OTI size from strategy
const calculate_oti_size = (strategy) => {
	if (Object.keys(strategy.oti).length === 0) {
		return 12; // Default 12-byte OTI
	}

	// Set defaults for all OTI fields exactly like the encoder does
	const oti_config = {
		transfer_length: {
			external_bits: 40n,
			...strategy.oti.transfer_length
		},
		fec_encoding_id: {
			external_bits: 8n,
			...strategy.oti.fec_encoding_id
		},
		symbol_size: {
			external_bits: 16n,
			...strategy.oti.symbol_size
		},
		num_source_blocks: {
			external_bits: 8n,
			...strategy.oti.num_source_blocks
		},
		num_sub_blocks: {
			external_bits: 16n,
			...strategy.oti.num_sub_blocks
		},
		symbol_alignment: {
			external_bits: 8n,
			...strategy.oti.symbol_alignment
		},
	};

	const total_bits = (0n
		+ oti_config.transfer_length.external_bits
		+ oti_config.fec_encoding_id.external_bits
		+ oti_config.symbol_size.external_bits
		+ oti_config.num_source_blocks.external_bits
		+ oti_config.num_sub_blocks.external_bits
		+ oti_config.symbol_alignment.external_bits
	);

	if (total_bits === 0n) {
		return 0; // No OTI needed
	}

	return Number(bigint_ceil(total_bits, 8n));
};

export const decode__ = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
	// Use exact_strategy to handle all defaults and validation
	strategy = exact_strategy(strategy);

	// Validate that oti is undefined when placement is "encoding_packet"
	if (strategy.oti.placement === "encoding_packet") {
		if (oti !== undefined) {
			throw_error(error_user_payload("When strategy.oti.placement is 'encoding_packet', the oti parameter must be undefined"));
		}

		// Extract OTI from encoding packets and call _decode once we have it
		const expected_oti_size = calculate_oti_size(strategy);

		if (expected_oti_size === 0) {
			// No OTI expected, pass packets through unchanged
			return _decode({ raptorq_raw }, { usage, oti: undefined, encoding_packets, strategy });
		}

		let extracted_oti = null;
		let oti_resolved = false;
		const [oti_prom, oti_prom_res, oti_prom_rej] = create_unsuspended_promise();

		const oti_extracting_packets = (async function* () {
			for await (const packet of encoding_packets) {
				if (!oti_resolved) {
					if (packet.length < expected_oti_size) {
						throw_error(error_user_payload(`Packet too small to contain OTI. Expected at least ${expected_oti_size} bytes, got ${packet.length}`));
					}

					// Extract OTI from the beginning of the packet
					const packet_oti = packet.slice(0, expected_oti_size);
					const remaining_packet = packet.slice(expected_oti_size);

					if (extracted_oti === null) {
						// First packet - store the OTI
						extracted_oti = packet_oti;
						oti_prom_res(extracted_oti);
						oti_resolved = true;
					} else {
						// Subsequent packets - verify OTI consistency
						let oti_matches = true;
						if (packet_oti.length !== extracted_oti.length) {
							oti_matches = false;
						} else {
							for (let i = 0; i < packet_oti.length; i++) {
								if (packet_oti[i] !== extracted_oti[i]) {
									oti_matches = false;
									break;
								}
							}
						}

						if (!oti_matches) {
							throw_error(error_user_payload("OTI mismatch detected in encoding packets. All packets must have identical OTI when using per-packet placement."));
						}
					}

					yield remaining_packet;
				} else {
					// OTI already extracted, just strip it from packets
					yield packet.slice(expected_oti_size);
				}
			}
		})();

		// Create the decode function that waits for OTI
		const decode_with_extracted_oti = unsuspended_promise((async () => {
			const final_oti = await oti_prom;
			return _decode({ raptorq_raw }, { usage, oti: final_oti, encoding_packets: oti_extracting_packets, strategy });
		})());

		// Return based on usage type
		if (usage?.output_format === "blocks") {
			return obtain_async_iterator(decode_with_extracted_oti);
		} else {
			return decode_with_extracted_oti;
		}
	}

	// Standard flow for "negotiation" placement
	return _decode({ raptorq_raw }, { usage, oti, encoding_packets, strategy });
};

export const decode = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
	strategy ??= {};

	if (strategy.payload?.transfer_length_trim !== undefined) {
		// Use exact_strategy to handle all defaults and validation
		strategy = exact_strategy(strategy);

		if (strategy.payload.transfer_length_trim.external_bits === 0n) {
			return decode__({ raptorq_raw }, { usage, oti, encoding_packets, strategy });
		}

		const external_bytes = Math.ceil(Number(strategy.payload.transfer_length_trim.external_bits) / 8);

		const orig_transfer_length_to_internal = strategy.oti.transfer_length.remap.to_internal;
		const orig_transfer_length_to_external = strategy.oti.transfer_length.remap.to_external;

		// Mirror the encoding transform for OTI transfer_length
		strategy.oti.transfer_length.remap.to_internal = (external) => {
			// note we do not involve external_bytes here, as it is easier for programmer to decide calculation on the effective transfer_length, as it is the effective transfer_length that they are likely ceiling based on symbol_size.
			return orig_transfer_length_to_internal(external);
		};

		strategy.oti.transfer_length.remap.to_external = (internal) => {
			return orig_transfer_length_to_external(internal);
		};

		// Extract the RaptorQ internal transfer_length from OTI first for remap context
		let raptorq_transfer_length;
		if (oti !== undefined) {
			// Process OTI to extract transfer_length 
			const process_oti = create_process_oti(strategy);
			const processed_oti = process_oti(oti);

			// Extract transfer_length from the processed 12-byte OTI using oti_decode
			const oti_object = oti_decode_raw(processed_oti);
			raptorq_transfer_length = oti_object.transfer_length;

			// console.log("tl", interm_raptorq_transfer_length, "->", raptorq_transfer_length);
		} else {
			// OTI is undefined, must extract from hardcoded strategy values
			if (!strategy.oti.transfer_length?.remap?.to_internal) {
				throw_error(error_user_payload("Cannot determine transfer_length for trim context when OTI is undefined"));
			}
			raptorq_transfer_length = strategy.oti.transfer_length.remap.to_internal(undefined);
		}

		// Decode first and then provide trim metadata
		const raw_result = decode__({ raptorq_raw }, { usage, oti, encoding_packets, strategy });

		// Handle different output formats
		if (usage?.output_format === "blocks") {
			const [transfer_length_trim, transfer_length_trim_res, transfer_length_trim_rej] = create_unsuspended_promise();

			// For blocks output, extract trim length and provide it as metadata
			return {
				blocks: (async function* () {
					let first_block_processed = false;

					for await (const block of raw_result.blocks) {
						if (block.sbn === 0n) {
							if (!first_block_processed) {
								// Extract trim length from the first block's prefix
								if (block.data.length < external_bytes) {
									transfer_length_trim_rej(error_user_payload(`First block too small to contain transfer_length_trim prefix. Expected at least ${external_bytes} bytes, got ${block.data.length}`));
									return;
								}

								const prefix_bytes = block.data.slice(0, external_bytes);
								const prefix_array = new Uint1Array(external_bytes * 8);
								prefix_array.get_underlying_buffer().set(prefix_bytes);
								const stored_length = prefix_array.to_bigint();

								// Apply to_internal remap function if provided
								let final_trim_length = stored_length;
								if (strategy.payload.transfer_length_trim.remap?.to_internal) {
									// Use the actual RaptorQ transfer_length as context
									final_trim_length = strategy.payload.transfer_length_trim.remap.to_internal(stored_length, { transfer_length: raptorq_transfer_length });
								}

								// Resolve the promise with the final trim length
								transfer_length_trim_res(final_trim_length);

								first_block_processed = true;
							}

							// For all blocks with sbn=0, strip the prefix
							yield {
								sbn: block.sbn,
								data: block.data.slice(external_bytes),
							};
						} else {
							// Pass through other blocks unchanged
							yield {
								sbn: block.sbn,
								data: block.data
							};
						}
					}

					if (!first_block_processed) {
						transfer_length_trim_rej(error_user_payload("No blocks received to extract transfer_length_trim from"));
					}
				})(),
				transfer_length_trim,
			};
		} else {
			// For combined output, extract trim length and provide trimmed result
			return (async () => {
				const decoded_data = await raw_result;

				if (decoded_data.length < external_bytes) {
					throw_error(error_user_payload(`Decoded data too small to contain transfer_length_trim prefix. Expected at least ${external_bytes} bytes, got ${decoded_data.length}`));
				}

				// Extract trim length from prefix
				const prefix_bytes = decoded_data.slice(0, external_bytes);
				const prefix_array = new Uint1Array(external_bytes * 8);
				prefix_array.get_underlying_buffer().set(prefix_bytes);
				const stored_length = prefix_array.to_bigint();

				// Apply to_internal remap function if provided
				let final_trim_length = stored_length;
				if (strategy.payload.transfer_length_trim.remap?.to_internal) {
					// Use the actual RaptorQ transfer_length as context
					final_trim_length = strategy.payload.transfer_length_trim.remap.to_internal(stored_length, { transfer_length: raptorq_transfer_length });
				}

				// Strip prefix and trim to specified length
				const data_without_prefix = decoded_data.slice(external_bytes);

				// Validate trim length
				if (final_trim_length > BigInt(data_without_prefix.length)) {
					throw_error(error_user_payload(`transfer_length_trim specifies length ${final_trim_length} but only ${data_without_prefix.length} bytes available after prefix`));
				}

				return data_without_prefix.slice(0, Number(final_trim_length));
			})();
		}
	}

	return decode__({ raptorq_raw }, { usage, oti, encoding_packets, strategy });
};
