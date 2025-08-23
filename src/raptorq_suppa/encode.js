import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import { exact_options } from "../raptorq_raw/exact_options.js";
import Uint1Array from "../Uint1Array.js";

// Safe wrapper functions that validate transformations
const safe_max_value = (bits) => {
	if (bits === 0) return 0n;
	return (1n << BigInt(bits)) - 1n;
};

const create_safe_wrappers = (remap, external_bits, max_internal_bits) => {
	const max_external_value = external_bits === 0 ? 0n : safe_max_value(external_bits);
	const max_internal_value = safe_max_value(max_internal_bits);

	const to_internal_safe = (external_value) => {
		const internal_value = remap.to_internal(external_value);

		if (false
			|| typeof internal_value !== "number"
			|| !Number.isInteger(internal_value)
			|| internal_value < 0
			|| BigInt(internal_value) > max_internal_value
		) {
			throw_error(error_user_payload(`to_internal returned invalid value ${internal_value}. Must be integer between 0 and ${max_internal_value}.`));
		}

		// Double-check round-trip consistency (only if external_bits > 0)
		if (external_bits > 0) {
			const round_trip_external = remap.to_external(internal_value);
			if (round_trip_external !== external_value) {
				throw_error(error_user_payload(`to_internal/to_external are not consistent. ${external_value} -> ${internal_value} -> ${round_trip_external}`));
			}
		}

		return internal_value;
	};

	const to_external_safe = (internal_value) => {
		if (external_bits === 0) {
			if (remap.to_external !== undefined) {
				throw_error(error_user_payload("to_external must be undefined when external_bits is 0"));
			}
			return undefined;
		}

		const external_value = remap.to_external(internal_value);

		if (false
			|| typeof external_value !== "number"
			|| !Number.isInteger(external_value)
			|| external_value < 0
			|| BigInt(external_value) > max_external_value
		) {
			throw_error(error_user_payload(`to_external returned invalid value ${external_value}. Must be integer between 0 and ${max_external_value}.`));
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

export const encode = ({ raptorq_raw }, { options, data, strategy }) => {
	strategy ??= {};
	strategy.sbn ??= {};
	strategy.esi ??= {};
	strategy.oti ??= {};

	// Set defaults for strategy.sbn
	strategy.sbn.external_bits ??= 8;
	strategy.sbn.remap ??= {};

	// Validate strategy.sbn
	if (false
		|| typeof strategy.sbn.external_bits !== "number"
		|| !Number.isInteger(strategy.sbn.external_bits)
		|| strategy.sbn.external_bits < 0
		|| strategy.sbn.external_bits > 8
	) {
		throw_error(error_user_payload("Provided strategy.sbn.external_bits must be integer between 0 and 8."));
	}

	// Set defaults for remap functions
	if (strategy.sbn.external_bits === 0) {
		strategy.sbn.remap.to_internal ??= (_unused) => 0;
		strategy.sbn.remap.to_external = undefined; // Cannot be present if max_bits is 0
	} else {
		strategy.sbn.remap.to_internal ??= (external) => external;
		strategy.sbn.remap.to_external ??= (internal) => internal;
	}

	// Validate remap functions
	if (typeof strategy.sbn.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.sbn.remap.to_internal must be a function."));
	}

	if (strategy.sbn.external_bits > 0) {
		if (typeof strategy.sbn.remap.to_external !== "function") {
			throw_error(error_user_payload("Provided strategy.sbn.remap.to_external must be a function when external_bits > 0."));
		}
	} else if (strategy.sbn.remap.to_external !== undefined) {
		throw_error(error_user_payload("Provided strategy.sbn.remap.to_external cannot be present when external_bits is 0."));
	}

	// Create safe wrappers for SBN (8 bits is the default max for internal SBN)
	const sbn_wrappers = create_safe_wrappers(strategy.sbn.remap, strategy.sbn.external_bits, 8);

	// Set defaults for strategy.esi
	strategy.esi.external_bits ??= 24;
	strategy.esi.remap ??= {};

	// Validate strategy.esi
	if (false
		|| typeof strategy.esi.external_bits !== "number"
		|| !Number.isInteger(strategy.esi.external_bits)
		|| strategy.esi.external_bits < 2
		|| strategy.esi.external_bits > 24
	) {
		throw_error(error_user_payload("Provided strategy.esi.external_bits must be integer between 2 and 24."));
	}

	// Set defaults for ESI remap functions
	strategy.esi.remap.to_internal ??= (external) => external;
	strategy.esi.remap.to_external ??= (internal) => internal;

	// Validate ESI remap functions
	if (typeof strategy.esi.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.esi.remap.to_internal must be a function."));
	}

	if (typeof strategy.esi.remap.to_external !== "function") {
		throw_error(error_user_payload("Provided strategy.esi.remap.to_external must be a function."));
	}

	// Create safe wrappers for ESI (24 bits is the default max for internal ESI)
	const esi_wrappers = create_safe_wrappers(strategy.esi.remap, strategy.esi.external_bits, 24);

	// Validate encoding options against safe wrappers (test the transformations)
	options ??= {};

	// For SBN: test that num_source_blocks - 1 can be safely transformed
	if (options.num_source_blocks !== undefined) {
		const test_sbn = options.num_source_blocks - 1; // SBN is 0-indexed
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

		// Parse transfer length (40 bits = 5 bytes, big-endian)
		const transfer_length = Number(
			(BigInt(raw_oti[0]) << 32n) +
			(BigInt(raw_oti[1]) << 24n) +
			(BigInt(raw_oti[2]) << 16n) +
			(BigInt(raw_oti[3]) << 8n) +
			BigInt(raw_oti[4])
		);

		// Parse FEC encoding ID (8 bits)
		const fec_encoding_id = raw_oti[5];

		// Parse symbol size (16 bits = 2 bytes, big-endian)
		const symbol_size = (raw_oti[6] << 8) + raw_oti[7];

		// Parse num source blocks (8 bits)
		const num_source_blocks = raw_oti[8];

		// Parse num sub blocks (16 bits = 2 bytes, big-endian) 
		const num_sub_blocks = (raw_oti[9] << 8) + raw_oti[10];

		// Parse symbol alignment (8 bits)
		const symbol_alignment = raw_oti[11];

		// Validate the extracted OTI values before processing
		if (false
			|| typeof transfer_length !== "number"
			|| !Number.isInteger(transfer_length)
			|| transfer_length < 1
			|| transfer_length > 942574504275
		) {
			throw_error(error_user_payload(`Invalid transfer_length ${transfer_length} in original OTI. Must be integer between 1 and 942574504275.`));
		}

		if (false
			|| typeof symbol_size !== "number"
			|| !Number.isInteger(symbol_size)
			|| symbol_size < 1
			|| symbol_size > 65535
		) {
			throw_error(error_user_payload(`Invalid symbol_size ${symbol_size} in original OTI. Must be integer between 1 and 65535.`));
		}

		if (false
			|| typeof num_source_blocks !== "number"
			|| !Number.isInteger(num_source_blocks)
			|| num_source_blocks < 1
			|| num_source_blocks > 256
		) {
			throw_error(error_user_payload(`Invalid num_source_blocks ${num_source_blocks} in original OTI. Must be integer between 1 and 256.`));
		}

		if (false
			|| typeof num_sub_blocks !== "number"
			|| !Number.isInteger(num_sub_blocks)
			|| num_sub_blocks < 1
			|| num_sub_blocks > 65535
		) {
			throw_error(error_user_payload(`Invalid num_sub_blocks ${num_sub_blocks} in original OTI. Must be integer between 1 and 65535.`));
		}

		if (false
			|| typeof symbol_alignment !== "number"
			|| !Number.isInteger(symbol_alignment)
			|| symbol_alignment < 1
			|| symbol_alignment > 255
		) {
			throw_error(error_user_payload(`Invalid symbol_alignment ${symbol_alignment} in original OTI. Must be integer between 1 and 255.`));
		}

		// Calculate total bits needed for custom OTI and prepare values
		let total_bits = 0;
		const field_values = [];

		// Set defaults for all OTI fields when any OTI strategy is configured
		strategy.oti.transfer_length ??= {};
		strategy.oti.transfer_length.external_bits ??= 40;
		strategy.oti.transfer_length.remap ??= {};
		strategy.oti.transfer_length.remap.to_internal ??= (external) => external;
		strategy.oti.transfer_length.remap.to_external ??= (internal) => internal;

		strategy.oti.fec_encoding_id ??= {};
		strategy.oti.fec_encoding_id.external_bits ??= 8;
		// No remap functions for fec_encoding_id

		strategy.oti.symbol_size ??= {};
		strategy.oti.symbol_size.external_bits ??= 16;
		strategy.oti.symbol_size.remap ??= {};
		strategy.oti.symbol_size.remap.to_internal ??= (external) => external;
		strategy.oti.symbol_size.remap.to_external ??= (internal) => internal;

		strategy.oti.num_source_blocks ??= {};
		strategy.oti.num_source_blocks.external_bits ??= 8;
		strategy.oti.num_source_blocks.remap ??= {};
		strategy.oti.num_source_blocks.remap.to_internal ??= (external) => external;
		strategy.oti.num_source_blocks.remap.to_external ??= (internal) => internal;

		strategy.oti.num_sub_blocks ??= {};
		strategy.oti.num_sub_blocks.external_bits ??= 16;
		strategy.oti.num_sub_blocks.remap ??= {};
		strategy.oti.num_sub_blocks.remap.to_internal ??= (external) => external;
		strategy.oti.num_sub_blocks.remap.to_external ??= (internal) => internal;

		strategy.oti.symbol_alignment ??= {};
		strategy.oti.symbol_alignment.external_bits ??= 8;
		strategy.oti.symbol_alignment.remap ??= {};
		strategy.oti.symbol_alignment.remap.to_internal ??= (external) => external;
		strategy.oti.symbol_alignment.remap.to_external ??= (internal) => internal;

		// Process transfer_length
		const transfer_length_bits = strategy.oti.transfer_length.external_bits;
		if (transfer_length_bits > 0) {
			const external_value = strategy.oti.transfer_length.remap?.to_external
				? strategy.oti.transfer_length.remap.to_external(transfer_length)
				: transfer_length;

			// Validate external_value - handle large bit counts safely
			const max_value = safe_max_value(transfer_length_bits);

			if (false
				|| typeof external_value !== "number"
				|| !Number.isInteger(external_value)
				|| external_value < 0
				|| BigInt(external_value) > max_value
			) {
				throw_error(error_user_payload(`transfer_length remap.to_external returned ${external_value}, which doesn't fit in ${transfer_length_bits} bits. Must be integer between 0 and ${max_value}.`));
			}

			field_values.push({ bits: transfer_length_bits, value: external_value });
			total_bits += transfer_length_bits;
		}

		// Process fec_encoding_id
		const fec_encoding_id_bits = strategy.oti.fec_encoding_id.external_bits;
		if (fec_encoding_id_bits > 0) {
			if (fec_encoding_id_bits !== 8) {
				throw_error(error_user_payload(`fec_encoding_id.external_bits must be 0 (omitted) or 8 (present), got ${fec_encoding_id_bits}`));
			}

			// fec_encoding_id is always 6, no remap functions allowed
			const external_value = fec_encoding_id; // Always 6

			// Validate external_value
			const max_value = safe_max_value(fec_encoding_id_bits);
			if (false
				|| typeof external_value !== "number"
				|| !Number.isInteger(external_value)
				|| external_value < 0
				|| BigInt(external_value) > max_value
			) {
				throw_error(error_user_payload(`fec_encoding_id value ${external_value} doesn't fit in ${fec_encoding_id_bits} bits. Must be integer between 0 and ${max_value}.`));
			}

			field_values.push({ bits: fec_encoding_id_bits, value: external_value });
			total_bits += fec_encoding_id_bits;
		}

		// Process symbol_size
		const symbol_size_bits = strategy.oti.symbol_size.external_bits;
		if (symbol_size_bits > 0) {
			const external_value = strategy.oti.symbol_size.remap?.to_external
				? strategy.oti.symbol_size.remap.to_external(symbol_size)
				: symbol_size;

			// Validate external_value
			const max_value = safe_max_value(symbol_size_bits);
			if (false
				|| typeof external_value !== "number"
				|| !Number.isInteger(external_value)
				|| external_value < 0
				|| BigInt(external_value) > max_value
			) {
				throw_error(error_user_payload(`symbol_size remap.to_external returned ${external_value}, which doesn't fit in ${symbol_size_bits} bits. Must be integer between 0 and ${max_value}.`));
			}

			field_values.push({ bits: symbol_size_bits, value: external_value });
			total_bits += symbol_size_bits;
		}

		// Process num_source_blocks
		const num_source_blocks_bits = strategy.oti.num_source_blocks.external_bits;
		if (num_source_blocks_bits > 0) {
			const external_value = strategy.oti.num_source_blocks.remap?.to_external
				? strategy.oti.num_source_blocks.remap.to_external(num_source_blocks)
				: num_source_blocks;

			// Validate external_value
			const max_value = safe_max_value(num_source_blocks_bits);
			if (false
				|| typeof external_value !== "number"
				|| !Number.isInteger(external_value)
				|| external_value < 0
				|| BigInt(external_value) > max_value
			) {
				throw_error(error_user_payload(`num_source_blocks remap.to_external returned ${external_value}, which doesn't fit in ${num_source_blocks_bits} bits. Must be integer between 0 and ${max_value}.`));
			}

			field_values.push({ bits: num_source_blocks_bits, value: external_value });
			total_bits += num_source_blocks_bits;
		}

		// Process num_sub_blocks
		const num_sub_blocks_bits = strategy.oti.num_sub_blocks.external_bits;
		if (num_sub_blocks_bits > 0) {
			const external_value = strategy.oti.num_sub_blocks.remap?.to_external
				? strategy.oti.num_sub_blocks.remap.to_external(num_sub_blocks)
				: num_sub_blocks;

			// Validate external_value
			const max_value = safe_max_value(num_sub_blocks_bits);
			if (false
				|| typeof external_value !== "number"
				|| !Number.isInteger(external_value)
				|| external_value < 0
				|| BigInt(external_value) > max_value
			) {
				throw_error(error_user_payload(`num_sub_blocks remap.to_external returned ${external_value}, which doesn't fit in ${num_sub_blocks_bits} bits. Must be integer between 0 and ${max_value}.`));
			}

			field_values.push({ bits: num_sub_blocks_bits, value: external_value });
			total_bits += num_sub_blocks_bits;
		}

		// Process symbol_alignment
		const symbol_alignment_bits = strategy.oti.symbol_alignment.external_bits;
		if (symbol_alignment_bits > 0) {
			const external_value = strategy.oti.symbol_alignment.remap?.to_external
				? strategy.oti.symbol_alignment.remap.to_external(symbol_alignment)
				: symbol_alignment;

			// Validate external_value
			const max_value = safe_max_value(symbol_alignment_bits);
			if (false
				|| typeof external_value !== "number"
				|| !Number.isInteger(external_value)
				|| external_value < 0
				|| BigInt(external_value) > max_value
			) {
				throw_error(error_user_payload(`symbol_alignment remap.to_external returned ${external_value}, which doesn't fit in ${symbol_alignment_bits} bits. Must be integer between 0 and ${max_value}.`));
			}

			field_values.push({ bits: symbol_alignment_bits, value: external_value });
			total_bits += symbol_alignment_bits;
		}

		// If total_bits is 0, return undefined (no OTI needed)
		if (total_bits === 0) {
			return undefined;
		}

		// Build the custom OTI using Uint1Array
		const custom_oti_array = new Uint1Array(total_bits);
		let bit_offset = 0;

		for (const field of field_values) {
			const field_array = new Uint1Array(BigInt(field.value), field.bits);
			custom_oti_array.set(field_array, bit_offset);
			bit_offset += field.bits;
		}

		return custom_oti_array.to_uint8_array();
	};

	// Transform the encoding packets based on strategy
	const transformed_encoding_packets = (async function* () {
		// Check if we need ESI validation (calculate expected symbol count)
		const exact_opts = exact_options(options);
		const transfer_length = data.length;
		const estimated_source_symbols = Math.ceil(transfer_length / exact_opts.symbol_size);
		const estimated_total_symbols = estimated_source_symbols + exact_opts.num_repair_symbols;

		// Test that the estimated total symbols can be represented with ESI strategy
		try {
			esi_wrappers.to_external_safe(estimated_total_symbols - 1); // ESI is 0-indexed
		} catch (e) {
			throw_error(error_user_payload(`Estimated symbol count ${estimated_total_symbols} cannot be represented with current ESI strategy: ${e.message}`));
		}

		for await (const packet of raw_result.encoding_packets) {
			let transformed_packet;

			if (strategy.sbn.external_bits === 0) {
				// Remove SBN (first byte) from the packet - behaves like "disable" mode
				const payload_without_sbn = packet.slice(1);

				// Transform ESI (next 3 bytes) 
				const esi_bytes = new Uint8Array(3);
				esi_bytes[0] = payload_without_sbn[0];
				esi_bytes[1] = payload_without_sbn[1];
				esi_bytes[2] = payload_without_sbn[2];

				// Convert ESI from bytes to internal value
				const internal_esi = (esi_bytes[0] << 16) | (esi_bytes[1] << 8) | esi_bytes[2];

				// Apply ESI remap to get external ESI value using safe wrapper
				const external_esi = esi_wrappers.to_external_safe(internal_esi);

				// Create ESI Uint1Array from BigInt
				const esi_array = new Uint1Array(BigInt(external_esi), strategy.esi.external_bits);

				// Extract packed bytes and combine with symbol data
				const packed_bytes = esi_array.to_uint8_array();
				const symbol_data = payload_without_sbn.slice(3);
				transformed_packet = new Uint8Array(packed_bytes.length + symbol_data.length);
				transformed_packet.set(packed_bytes, 0);
				transformed_packet.set(symbol_data, packed_bytes.length);
			} else {
				// Transform SBN (first byte) and ESI (next 3 bytes)
				const sbn_byte = packet[0];
				const esi_bytes = new Uint8Array(3);
				esi_bytes[0] = packet[1];
				esi_bytes[1] = packet[2];
				esi_bytes[2] = packet[3];

				// Convert SBN to external value using safe wrapper
				const external_sbn = sbn_wrappers.to_external_safe(sbn_byte);

				// Convert ESI from bytes to internal value
				const internal_esi = (esi_bytes[0] << 16) | (esi_bytes[1] << 8) | esi_bytes[2];

				// Apply ESI remap to get external ESI value using safe wrapper
				const external_esi = esi_wrappers.to_external_safe(internal_esi);

				// Create separate Uint1Array instances for SBN and ESI
				const sbn_array = new Uint1Array(BigInt(external_sbn), strategy.sbn.external_bits);
				const esi_array = new Uint1Array(BigInt(external_esi), strategy.esi.external_bits);

				// Create combined array using set method
				const combined_array = new Uint1Array(strategy.sbn.external_bits + strategy.esi.external_bits);
				combined_array.set(sbn_array, 0);
				combined_array.set(esi_array, strategy.sbn.external_bits);

				// Extract packed bytes and combine with symbol data
				const packed_bytes = combined_array.to_uint8_array();
				const symbol_data = packet.slice(4);
				transformed_packet = new Uint8Array(packed_bytes.length + symbol_data.length);
				transformed_packet.set(packed_bytes, 0);
				transformed_packet.set(symbol_data, packed_bytes.length);
			}

			yield transformed_packet;
		}
	})();

	return {
		oti: process_oti(raw_result.oti),
		oti_spec: raw_result.oti,
		encoding_packets: transformed_encoding_packets,
	};
};
