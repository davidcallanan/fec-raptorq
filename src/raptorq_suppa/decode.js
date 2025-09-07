import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import Uint1Array from "../Uint1Array.js";
import { create_unsuspended_promise, unsuspended_promise } from "unsuspended-promise";
import { bigint_ceil } from "../uoe/bigint_ceil.js";
import { oti_decode as oti_decode_raw } from "../raptorq_raw/oti_decode.js";
import { oti_encode as oti_encode_raw } from "../raptorq_raw/oti_encode.js";
import { oti_decode } from "./oti_decode.js";
import { exact_strategy } from "./exact_strategy.js";
import { packet_header_decode } from "./packet_header_decode.js";

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
				// Decode and verify packet header using utility function
				const header_result = packet_header_decode(strategy, packet);
				
				if (!header_result.valid) {
					// Silently drop invalid packet (ECC mismatch or other issues)
					continue;
				}

				const { external_sbn, external_esi, symbol_data } = header_result;

				// Convert external values to internal values using safe wrappers
				let internal_sbn = 0n;
				if (strategy.encoding_packet.sbn.external_bits > 0n && external_sbn !== null) {
					internal_sbn = sbn_wrappers.to_internal_safe(external_sbn);
				}

				const internal_esi = esi_wrappers.to_internal_safe(external_esi);

				// Convert internal ESI to 3-byte format
				const internal_esi_bytes = new Uint8Array(3);
				internal_esi_bytes[0] = Number((internal_esi >> 16n) & 0xFFn);
				internal_esi_bytes[1] = Number((internal_esi >> 8n) & 0xFFn);
				internal_esi_bytes[2] = Number(internal_esi & 0xFFn);

				// Reconstruct packet in raw format: SBN (1 byte) + internal ESI (3 bytes) + symbol data
				const transformed_packet = new Uint8Array(1 + 3 + symbol_data.length);
				transformed_packet[0] = Number(internal_sbn & 0xFFn); // Convert to single byte
				transformed_packet.set(internal_esi_bytes, 1);
				transformed_packet.set(symbol_data, 4);

				yield transformed_packet;
			}
		}
	};

	return raptorq_raw.decode({ usage, oti: processed_oti, encoding_packets: transformed_encoding_packets });
};

// Helper function to calculate expected header size from strategy (including ECC + OTI + SBN + ESI)
const calculate_header_size = (strategy) => {
	let total_bits = 0n;

	// ECC bits
	total_bits += strategy.encoding_packet.ecc.external_bits;

	// OTI bits (if per-packet placement)
	if (strategy.oti.placement === "encoding_packet") {
		const oti_config = {
			transfer_length: { external_bits: 40n, ...strategy.oti.transfer_length },
			fec_encoding_id: { external_bits: 8n, ...strategy.oti.fec_encoding_id },
			symbol_size: { external_bits: 16n, ...strategy.oti.symbol_size },
			num_source_blocks: { external_bits: 8n, ...strategy.oti.num_source_blocks },
			num_sub_blocks: { external_bits: 16n, ...strategy.oti.num_sub_blocks },
			symbol_alignment: { external_bits: 8n, ...strategy.oti.symbol_alignment },
		};

		const oti_total_bits = (0n
			+ oti_config.transfer_length.external_bits
			+ oti_config.fec_encoding_id.external_bits
			+ oti_config.symbol_size.external_bits
			+ oti_config.num_source_blocks.external_bits
			+ oti_config.num_sub_blocks.external_bits
			+ oti_config.symbol_alignment.external_bits
		);

		total_bits += oti_total_bits;
	}

	// SBN bits
	total_bits += strategy.encoding_packet.sbn.external_bits;

	// ESI bits
	total_bits += strategy.encoding_packet.esi.external_bits;

	if (total_bits === 0n) {
		return 0;
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

		// For per-packet OTI, we need to extract OTI from the first valid packet
		let extracted_oti = null;
		let oti_resolved = false;
		const [oti_prom, oti_prom_res, oti_prom_rej] = create_unsuspended_promise();

		const oti_extracting_packets = (async function* () {
			for await (const packet of encoding_packets) {
				// Decode packet header to extract OTI (and verify ECC)
				const header_result = packet_header_decode(strategy, packet);
				
				if (!header_result.valid) {
					// Silently drop invalid packet
					continue;
				}

				if (!oti_resolved) {
					if (!header_result.oti_data) {
						throw_error(error_user_payload("Per-packet OTI placement expected but no OTI found in packet"));
					}

					if (extracted_oti === null) {
						// First valid packet - store the OTI
						extracted_oti = header_result.oti_data;
						oti_prom_res(extracted_oti);
						oti_resolved = true;
					} else {
						// Subsequent packets - verify OTI consistency
						let oti_matches = true;
						if (!header_result.oti_data || header_result.oti_data.length !== extracted_oti.length) {
							oti_matches = false;
						} else {
							for (let i = 0; i < header_result.oti_data.length; i++) {
								if (header_result.oti_data[i] !== extracted_oti[i]) {
									oti_matches = false;
									break;
								}
							}
						}

						if (!oti_matches) {
							throw_error(error_user_payload("OTI mismatch detected in encoding packets. All packets must have identical OTI when using per-packet placement."));
						}
					}
				}

				// Convert external values to internal values using safe wrappers
				let internal_sbn = 0n;
				if (strategy.encoding_packet.sbn.external_bits > 0n && header_result.external_sbn !== null) {
					internal_sbn = sbn_wrappers.to_internal_safe(header_result.external_sbn);
				}

				const internal_esi = esi_wrappers.to_internal_safe(header_result.external_esi);

				// Convert internal ESI to 3-byte format
				const internal_esi_bytes = new Uint8Array(3);
				internal_esi_bytes[0] = Number((internal_esi >> 16n) & 0xFFn);
				internal_esi_bytes[1] = Number((internal_esi >> 8n) & 0xFFn);
				internal_esi_bytes[2] = Number(internal_esi & 0xFFn);

				// Reconstruct packet in raw format: SBN (1 byte) + internal ESI (3 bytes) + symbol data
				const transformed_packet = new Uint8Array(1 + 3 + header_result.symbol_data.length);
				transformed_packet[0] = Number(internal_sbn & 0xFFn);
				transformed_packet.set(internal_esi_bytes, 1);
				transformed_packet.set(header_result.symbol_data, 4);

				yield transformed_packet;
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
