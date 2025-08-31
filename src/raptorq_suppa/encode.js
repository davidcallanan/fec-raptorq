import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import { exact_options } from "../raptorq_raw/exact_options.js";
import Uint1Array from "../Uint1Array.js";
import { bigint_ceil } from "../uoe/bigint_ceil.js";

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
				throw_error(error_user_payload(`to_internal/to_external are not consistent. ${external_value} -> ${internal_value} -> ${round_trip_external}`));
			}
		}

		return internal_value;
	};

	const to_external_safe = (internal_value) => {
		if (external_bits === 0n) {
			if (remap.to_external !== undefined) {
				throw_error(error_user_payload("to_external must be undefined when external_bits is 0n"));
			}
			return undefined;
		}

		const external_value = remap.to_external(internal_value);

		// Allow to_external to return undefined to indicate non-representable values
		if (external_value === undefined) {
			throw_error(error_user_payload(`Internal value ${internal_value} cannot be represented externally (to_external returned undefined).`));
		}

		if (false
			|| typeof external_value !== "bigint"
			|| external_value < 0n
			|| external_value > max_external_value
		) {
			throw_error(error_user_payload(`to_external returned invalid value ${external_value}. Must be bigint between 0n and ${max_external_value}.`));
		}

		// Double-check round-trip consistency
		const round_trip_internal = remap.to_internal(external_value);
		if (round_trip_internal !== internal_value) {
			throw_error(error_user_payload(`to_internal/to_external are not consistent. ${internal_value} -> ${external_value} -> ${round_trip_internal}`));
		}

		return external_value;
	};

	return { to_internal_safe, to_external_safe };
};

export const encode__ = ({ raptorq_raw }, { options, data, strategy }) => {
	// Create safe wrappers for SBN (8 bits is the default max for internal SBN)
	const sbn_wrappers = create_safe_wrappers(strategy.encoding_packet.sbn.remap, strategy.encoding_packet.sbn.external_bits, 8n);

	// Create safe wrappers for ESI (24 bits is the default max for internal ESI)
	const esi_wrappers = create_safe_wrappers(strategy.encoding_packet.esi.remap, strategy.encoding_packet.esi.external_bits, 24n);

	// Validate encoding options against safe wrappers (test the transformations)
	options ??= {};

	// For SBN: test that num_source_blocks - 1 can be safely transformed
	if (options.num_source_blocks !== undefined) {
		const test_sbn = options.num_source_blocks - 1n; // SBN is 0-indexed
		try {
			sbn_wrappers.to_external_safe(test_sbn);
		} catch (e) {
			throw_error(error_user_payload(`Provided options.num_source_blocks ${options.num_source_blocks} cannot be represented with current SBN strategy: ${e.message}`));
		}
	}

	// Get the raw encoding result
	const raw_result = raptorq_raw.encode({ options, data });

	// Process OTI if strategy.oti is configured
	const process_oti = async (raw_oti_promise) => {
		const raw_oti = await raw_oti_promise;

		// If no OTI strategy is configured, return the raw OTI
		if (Object.keys(strategy.oti).length === 0) {
			return raw_oti;
		}

		// Extract values from the original 12-byte OTI based on raptorq_raw.md structure:
		// [40 bits] Transfer Length + [8 bits] FEC Encoding ID + [16 bits] Symbol Size + 
		// [8 bits] Num Source Blocks + [16 bits] Num Sub-Blocks + [8 bits] Symbol Alignment

		// Parse transfer length (40 bits = 5 bytes, big-endian) using BigInt
		const transfer_length = (BigInt(raw_oti[0]) << 32n)
			+ (BigInt(raw_oti[1]) << 24n)
			+ (BigInt(raw_oti[2]) << 16n)
			+ (BigInt(raw_oti[3]) << 8n)
			+ BigInt(raw_oti[4]);

		// Parse FEC encoding ID (8 bits)
		const fec_encoding_id = BigInt(raw_oti[5]);

		// Parse symbol size (16 bits = 2 bytes, big-endian)
		const symbol_size = (BigInt(raw_oti[6]) << 8n) + BigInt(raw_oti[7]);

		// Parse num source blocks (8 bits)
		const num_source_blocks = BigInt(raw_oti[8]);

		// Parse num sub blocks (16 bits = 2 bytes, big-endian) 
		const num_sub_blocks = (BigInt(raw_oti[9]) << 8n) + BigInt(raw_oti[10]);

		// Parse symbol alignment (8 bits)
		const symbol_alignment = BigInt(raw_oti[11]);

		// Validate the extracted OTI values before processing
		if (false
			|| typeof transfer_length !== "bigint"
			|| transfer_length < 1n
			|| transfer_length > 942574504275n
		) {
			throw_error(error_user_payload(`Invalid transfer_length ${transfer_length} in original OTI. Must be bigint between 1n and 942574504275n.`));
		}

		if (false
			|| typeof symbol_size !== "bigint"
			|| symbol_size < 1n
			|| symbol_size > 65535n
		) {
			throw_error(error_user_payload(`Invalid symbol_size ${symbol_size} in original OTI. Must be bigint between 1n and 65535n.`));
		}

		if (false
			|| typeof num_source_blocks !== "bigint"
			|| num_source_blocks < 1n
			|| num_source_blocks > 256n
		) {
			throw_error(error_user_payload(`Invalid num_source_blocks ${num_source_blocks} in original OTI. Must be bigint between 1n and 256n.`));
		}

		if (false
			|| typeof num_sub_blocks !== "bigint"
			|| num_sub_blocks < 1n
			|| num_sub_blocks > 65535n
		) {
			throw_error(error_user_payload(`Invalid num_sub_blocks ${num_sub_blocks} in original OTI. Must be bigint between 1n and 65535n.`));
		}

		if (false
			|| typeof symbol_alignment !== "bigint"
			|| symbol_alignment < 1n
			|| symbol_alignment > 255n
		) {
			throw_error(error_user_payload(`Invalid symbol_alignment ${symbol_alignment} in original OTI. Must be bigint between 1n and 255n.`));
		}

		// Calculate total bits needed for custom OTI and prepare values
		let total_bits = 0n;
		const field_values = [];

		// Set defaults for all OTI fields when any OTI strategy is configured
		strategy.oti.transfer_length ??= {};
		strategy.oti.transfer_length.external_bits ??= 40n;
		strategy.oti.transfer_length.remap ??= {};
		strategy.oti.transfer_length.remap.to_internal ??= (external) => external;
		strategy.oti.transfer_length.remap.to_external ??= (internal) => internal;

		strategy.oti.fec_encoding_id ??= {};
		strategy.oti.fec_encoding_id.external_bits ??= 8n;
		// No remap functions for fec_encoding_id

		strategy.oti.symbol_size ??= {};
		strategy.oti.symbol_size.external_bits ??= 16n;
		strategy.oti.symbol_size.remap ??= {};
		strategy.oti.symbol_size.remap.to_internal ??= (external) => external;
		strategy.oti.symbol_size.remap.to_external ??= (internal) => internal;

		strategy.oti.num_source_blocks ??= {};
		strategy.oti.num_source_blocks.external_bits ??= 8n;
		strategy.oti.num_source_blocks.remap ??= {};
		strategy.oti.num_source_blocks.remap.to_internal ??= (external) => external;
		strategy.oti.num_source_blocks.remap.to_external ??= (internal) => internal;

		strategy.oti.num_sub_blocks ??= {};
		strategy.oti.num_sub_blocks.external_bits ??= 16n;
		strategy.oti.num_sub_blocks.remap ??= {};
		strategy.oti.num_sub_blocks.remap.to_internal ??= (external) => external;
		strategy.oti.num_sub_blocks.remap.to_external ??= (internal) => internal;

		strategy.oti.symbol_alignment ??= {};
		strategy.oti.symbol_alignment.external_bits ??= 8n;
		strategy.oti.symbol_alignment.remap ??= {};
		strategy.oti.symbol_alignment.remap.to_internal ??= (external) => external;
		strategy.oti.symbol_alignment.remap.to_external ??= (internal) => internal;

		// Process transfer_length
		const transfer_length_bits = strategy.oti.transfer_length.external_bits;
		if (transfer_length_bits > 0n) {
			const external_value = strategy.oti.transfer_length.remap.to_external(transfer_length);

			// console.log(strategy.oti.transfer_length.remap.to_internal.toString(), strategy.oti.transfer_length.remap.to_external.toString());
			// console.log("tl", transfer_length, "external_value", external_value);

			// Validate external_value - handle large bit counts safely
			const max_value = safe_max_value(transfer_length_bits);

			if (false
				|| typeof external_value !== "bigint"
				|| external_value < 0n
				|| external_value > max_value
			) {
				throw_error(error_user_payload(`transfer_length remap.to_external returned ${external_value}, which doesn't fit in ${transfer_length_bits} bits. Must be bigint between 0n and ${max_value}.`));
			}

			field_values.push({ bits: Number(transfer_length_bits), value: external_value });
			total_bits += transfer_length_bits;
		}

		// Process fec_encoding_id
		const fec_encoding_id_bits = strategy.oti.fec_encoding_id.external_bits;
		if (fec_encoding_id_bits > 0n) {
			if (fec_encoding_id_bits !== 8n) {
				throw_error(error_user_payload(`fec_encoding_id.external_bits must be 0n (omitted) or 8n (present), got ${fec_encoding_id_bits}`));
			}

			// fec_encoding_id is always 6n, no remap functions allowed
			const external_value = fec_encoding_id; // Always 6n

			// Validate external_value
			const max_value = safe_max_value(fec_encoding_id_bits);
			if (false
				|| typeof external_value !== "bigint"
				|| external_value < 0n
				|| external_value > max_value
			) {
				throw_error(error_user_payload(`fec_encoding_id value ${external_value} doesn't fit in ${fec_encoding_id_bits} bits. Must be bigint between 0n and ${max_value}.`));
			}

			field_values.push({ bits: Number(fec_encoding_id_bits), value: external_value });
			total_bits += fec_encoding_id_bits;
		}

		// Process symbol_size
		const symbol_size_bits = strategy.oti.symbol_size.external_bits;
		if (symbol_size_bits > 0n) {
			const external_value = strategy.oti.symbol_size.remap?.to_external
				? strategy.oti.symbol_size.remap.to_external(symbol_size)
				: symbol_size;

			// Validate external_value
			const max_value = safe_max_value(symbol_size_bits);
			if (false
				|| typeof external_value !== "bigint"
				|| external_value < 0n
				|| external_value > max_value
			) {
				throw_error(error_user_payload(`symbol_size remap.to_external returned ${external_value}, which doesn't fit in ${symbol_size_bits} bits. Must be bigint between 0n and ${max_value}.`));
			}

			field_values.push({ bits: Number(symbol_size_bits), value: external_value });
			total_bits += symbol_size_bits;
		}

		// Process num_source_blocks
		const num_source_blocks_bits = strategy.oti.num_source_blocks.external_bits;
		if (num_source_blocks_bits > 0n) {
			const external_value = strategy.oti.num_source_blocks.remap?.to_external
				? strategy.oti.num_source_blocks.remap.to_external(num_source_blocks)
				: num_source_blocks;

			// Validate external_value
			const max_value = safe_max_value(num_source_blocks_bits);
			if (false
				|| typeof external_value !== "bigint"
				|| external_value < 0n
				|| external_value > max_value
			) {
				throw_error(error_user_payload(`num_source_blocks remap.to_external returned ${external_value}, which doesn't fit in ${num_source_blocks_bits} bits. Must be bigint between 0n and ${max_value}.`));
			}

			field_values.push({ bits: Number(num_source_blocks_bits), value: external_value });
			total_bits += num_source_blocks_bits;
		}

		// Process num_sub_blocks
		const num_sub_blocks_bits = strategy.oti.num_sub_blocks.external_bits;
		if (num_sub_blocks_bits > 0n) {
			const external_value = strategy.oti.num_sub_blocks.remap?.to_external
				? strategy.oti.num_sub_blocks.remap.to_external(num_sub_blocks)
				: num_sub_blocks;

			// Validate external_value
			const max_value = safe_max_value(num_sub_blocks_bits);
			if (false
				|| typeof external_value !== "bigint"
				|| external_value < 0n
				|| external_value > max_value
			) {
				throw_error(error_user_payload(`num_sub_blocks remap.to_external returned ${external_value}, which doesn't fit in ${num_sub_blocks_bits} bits. Must be bigint between 0n and ${max_value}.`));
			}

			field_values.push({ bits: Number(num_sub_blocks_bits), value: external_value });
			total_bits += num_sub_blocks_bits;
		}

		// Process symbol_alignment
		const symbol_alignment_bits = strategy.oti.symbol_alignment.external_bits;
		if (symbol_alignment_bits > 0n) {
			const external_value = strategy.oti.symbol_alignment.remap?.to_external
				? strategy.oti.symbol_alignment.remap.to_external(symbol_alignment)
				: symbol_alignment;

			// Validate external_value
			const max_value = safe_max_value(symbol_alignment_bits);
			if (false
				|| typeof external_value !== "bigint"
				|| external_value < 0n
				|| external_value > max_value
			) {
				throw_error(error_user_payload(`symbol_alignment remap.to_external returned ${external_value}, which doesn't fit in ${symbol_alignment_bits} bits. Must be bigint between 0n and ${max_value}.`));
			}

			field_values.push({ bits: Number(symbol_alignment_bits), value: external_value });
			total_bits += symbol_alignment_bits;
		}

		// If total_bits is 0, return undefined (no OTI needed)
		if (total_bits === 0n) {
			return undefined;
		}

		// Build the custom OTI using Uint1Array
		const custom_oti_array = new Uint1Array(Number(total_bits));
		let bit_offset = 0;

		for (const field of field_values) {
			const field_array = new Uint1Array(field.value, field.bits);
			custom_oti_array.set(field_array, bit_offset);
			bit_offset += field.bits;
		}

		return custom_oti_array.to_uint8_array();
	};

	// Transform the encoding packets based on strategy
	const transformed_encoding_packets = (async function* () {
		// Check if we need ESI validation (calculate expected symbol count)
		const exact_opts = exact_options(options);
		const transfer_length = BigInt(data.length);
		const estimated_source_symbols = bigint_ceil(transfer_length, exact_opts.symbol_size);
		const estimated_total_symbols = estimated_source_symbols + exact_opts.num_repair_symbols;

		// Test that the estimated total symbols can be represented with ESI strategy
		try {
			esi_wrappers.to_external_safe(estimated_total_symbols - 1n); // ESI is 0-indexed
		} catch (e) {
			throw_error(error_user_payload(`Estimated symbol count ${estimated_total_symbols} cannot be represented with current ESI strategy: ${e.message}`));
		}

		// Get OTI for per-packet placement if needed
		let oti_for_packets = null;
		if (strategy.oti.placement === "encoding_packet") {
			oti_for_packets = await process_oti(raw_result.oti);
		}

		for await (const packet of raw_result.encoding_packets) {
			let transformed_packet;

			if (strategy.encoding_packet.sbn.external_bits === 0n) {
				// Remove SBN (first byte) from the packet - behaves like "disable" mode
				const payload_without_sbn = packet.slice(1);

				// Transform ESI (next 3 bytes) 
				const esi_bytes = new Uint8Array(3);
				esi_bytes[0] = payload_without_sbn[0];
				esi_bytes[1] = payload_without_sbn[1];
				esi_bytes[2] = payload_without_sbn[2];

				// Convert ESI from bytes to internal value using BigInt for safe operations
				const internal_esi = (BigInt(esi_bytes[0]) << 16n) | (BigInt(esi_bytes[1]) << 8n) | BigInt(esi_bytes[2]);

				// Apply ESI remap to get external ESI value using safe wrapper
				const external_esi = esi_wrappers.to_external_safe(internal_esi);

				// Create ESI Uint1Array from BigInt
				const esi_array = new Uint1Array(external_esi, Number(strategy.encoding_packet.esi.external_bits));

				// Extract packed bytes and combine with symbol data
				const packed_bytes = esi_array.to_uint8_array();
				const symbol_data = payload_without_sbn.slice(3);

				// Create the base packet
				const base_packet_length = packed_bytes.length + symbol_data.length;
				let final_packet;

				if (strategy.oti.placement === "encoding_packet" && oti_for_packets) {
					// Prepend OTI to the packet
					final_packet = new Uint8Array(oti_for_packets.length + base_packet_length);
					final_packet.set(oti_for_packets, 0);
					final_packet.set(packed_bytes, oti_for_packets.length);
					final_packet.set(symbol_data, oti_for_packets.length + packed_bytes.length);
				} else {
					final_packet = new Uint8Array(base_packet_length);
					final_packet.set(packed_bytes, 0);
					final_packet.set(symbol_data, packed_bytes.length);
				}

				transformed_packet = final_packet;
			} else {
				// Transform SBN (first byte) and ESI (next 3 bytes)
				const sbn_byte = packet[0];
				const esi_bytes = new Uint8Array(3);
				esi_bytes[0] = packet[1];
				esi_bytes[1] = packet[2];
				esi_bytes[2] = packet[3];

				// Convert SBN to external value using safe wrapper
				const external_sbn = sbn_wrappers.to_external_safe(BigInt(sbn_byte));

				// Convert ESI from bytes to internal value using BigInt for safe operations
				const internal_esi = (BigInt(esi_bytes[0]) << 16n) | (BigInt(esi_bytes[1]) << 8n) | BigInt(esi_bytes[2]);

				// Apply ESI remap to get external ESI value using safe wrapper
				const external_esi = esi_wrappers.to_external_safe(internal_esi);

				// Create separate Uint1Array instances for SBN and ESI
				const sbn_array = new Uint1Array(external_sbn, Number(strategy.encoding_packet.sbn.external_bits));
				const esi_array = new Uint1Array(external_esi, Number(strategy.encoding_packet.esi.external_bits));

				// Create combined array using set method
				const combined_array = new Uint1Array(Number(strategy.encoding_packet.sbn.external_bits + strategy.encoding_packet.esi.external_bits));
				combined_array.set(sbn_array, 0);
				combined_array.set(esi_array, Number(strategy.encoding_packet.sbn.external_bits));

				// Extract packed bytes and combine with symbol data
				const packed_bytes = combined_array.to_uint8_array();
				const symbol_data = packet.slice(4);

				// Create the base packet
				const base_packet_length = packed_bytes.length + symbol_data.length;
				let final_packet;

				if (strategy.oti.placement === "encoding_packet" && oti_for_packets) {
					// Prepend OTI to the packet
					final_packet = new Uint8Array(oti_for_packets.length + base_packet_length);
					final_packet.set(oti_for_packets, 0);
					final_packet.set(packed_bytes, oti_for_packets.length);
					final_packet.set(symbol_data, oti_for_packets.length + packed_bytes.length);
				} else {
					final_packet = new Uint8Array(base_packet_length);
					final_packet.set(packed_bytes, 0);
					final_packet.set(symbol_data, packed_bytes.length);
				}

				transformed_packet = final_packet;
			}

			yield transformed_packet;
		}
	})();

	return {
		oti: strategy.oti.placement === "encoding_packet" ? Promise.resolve(undefined) : process_oti(raw_result.oti),
		oti_spec: raw_result.oti,
		encoding_packets: transformed_encoding_packets,
	};
};


export const encode = ({ raptorq_raw }, { options, data, strategy }) => {
	strategy ??= {};
	strategy.encoding_packet ??= {};
	strategy.encoding_packet.sbn ??= {};
	strategy.encoding_packet.esi ??= {};
	strategy.oti ??= {};

	// Set defaults and validate strategy.oti.placement
	strategy.oti.placement ??= "negotation";
	if (strategy.oti.placement !== "negotation" && strategy.oti.placement !== "encoding_packet") {
		throw_error(error_user_payload(`Provided strategy.oti.placement must be "negotation" or "encoding_packet", got "${strategy.oti.placement}"`));
	}

	// Set defaults for strategy.encoding_packet.sbn
	strategy.encoding_packet.sbn.external_bits ??= 8n;
	strategy.encoding_packet.sbn.remap ??= {};

	// Validate strategy.encoding_packet.sbn
	if (false
		|| typeof strategy.encoding_packet.sbn.external_bits !== "bigint"
		|| strategy.encoding_packet.sbn.external_bits < 0n
		|| strategy.encoding_packet.sbn.external_bits > 8n
	) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.external_bits must be bigint between 0n and 8n."));
	}

	// Set defaults for remap functions
	if (strategy.encoding_packet.sbn.external_bits === 0n) {
		strategy.encoding_packet.sbn.remap.to_internal ??= (_unused) => 0n;
		strategy.encoding_packet.sbn.remap.to_external = undefined; // Cannot be present if max_bits is 0
	} else {
		strategy.encoding_packet.sbn.remap.to_internal ??= (external) => external;
		strategy.encoding_packet.sbn.remap.to_external ??= (internal) => internal;
	}

	// Validate remap functions
	if (typeof strategy.encoding_packet.sbn.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_internal must be a function."));
	}

	if (strategy.encoding_packet.sbn.external_bits > 0n) {
		if (typeof strategy.encoding_packet.sbn.remap.to_external !== "function") {
			throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_external must be a function when external_bits > 0."));
		}
	} else if (strategy.encoding_packet.sbn.remap.to_external !== undefined) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_external cannot be present when external_bits is 0."));
	}

	// Set defaults for strategy.encoding_packet.esi
	strategy.encoding_packet.esi.external_bits ??= 24n;
	strategy.encoding_packet.esi.remap ??= {};

	// Validate strategy.encoding_packet.esi
	if (false
		|| typeof strategy.encoding_packet.esi.external_bits !== "bigint"
		|| strategy.encoding_packet.esi.external_bits < 2n
		|| strategy.encoding_packet.esi.external_bits > 24n
	) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.external_bits must be bigint between 2n and 24n."));
	}

	// Set defaults for ESI remap functions
	strategy.encoding_packet.esi.remap.to_internal ??= (external) => external;
	strategy.encoding_packet.esi.remap.to_external ??= (internal) => internal;

	// Validate ESI remap functions
	if (typeof strategy.encoding_packet.esi.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.remap.to_internal must be a function."));
	}

	if (typeof strategy.encoding_packet.esi.remap.to_external !== "function") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.remap.to_external must be a function."));
	}


	if (strategy?.payload?.transfer_length_trim !== undefined) {
		strategy.payload.transfer_length_trim.external_bits ??= 0n;

		if (strategy.payload.transfer_length_trim.external_bits === 0n) {
			return encode__({ raptorq_raw }, { options, data, strategy });
		}

		strategy.payload.transfer_length_trim.pump_transfer_length ??= (effective_transfer_length) => effective_transfer_length;

		const external_bytes = Number(bigint_ceil(strategy.payload.transfer_length_trim.external_bits, 8n));

		strategy.oti ??= {};
		strategy.oti.transfer_length ??= {};
		strategy.oti.transfer_length.external_bits ??= 40n;
		strategy.oti.transfer_length.remap ??= {};
		strategy.oti.transfer_length.remap.to_internal ??= (external) => external;
		strategy.oti.transfer_length.remap.to_external ??= (internal) => internal;

		const orig_transfer_length_to_internal = strategy.oti.transfer_length.remap.to_internal;
		const orig_transfer_length_to_external = strategy.oti.transfer_length.remap.to_external;

		strategy.oti.transfer_length.remap.to_internal = (external) => {
			// note we do not involve external_bytes here, as it is easier for programmer to decide calculation on the effective transfer_length, as it is the effective transfer_length that they are likely ceiling based on symbol_size.
			return orig_transfer_length_to_internal(external);
		};

		strategy.oti.transfer_length.remap.to_external = (internal) => {
			return orig_transfer_length_to_external(internal);
		};

		const prefix = new Uint1Array(BigInt(data.length), Number(strategy.payload.transfer_length_trim.external_bits)).to_uint8_array();

		if (external_bytes !== prefix.length) {
			throw new Error("assertion failed.");
		}

		console.log("data length", data.length);
		console.log("prefix bytes", external_bytes);

		const effective_transfer_length = BigInt(data.length) + BigInt(external_bytes);

		console.log("effective transfer length", effective_transfer_length);

		const desired_effective_transfer_length = strategy.payload.transfer_length_trim.pump_transfer_length(effective_transfer_length);

		console.log("pumped length", desired_effective_transfer_length);

		if (desired_effective_transfer_length < effective_transfer_length) {
			throw_error(error_user_payload(`strategy.payload.transfer_length_trim.pump_transfer_length most return value >= original.`));
		}

		const new_data = new Uint8Array(Number(desired_effective_transfer_length));
		new_data.set(prefix, 0);
		new_data.set(data, external_bytes);

		return encode__({ raptorq_raw }, { options, data: new_data, strategy });
	}

	return encode__({ raptorq_raw }, { options, data, strategy });
};
