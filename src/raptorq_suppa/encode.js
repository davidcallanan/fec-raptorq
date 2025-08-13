import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import { exact_options } from "../raptorq_raw/exact_options.js";

// TODO: update to use Uint1Array

export const encode = ({ raptorq_raw }, { options, data, strategy }) => {
	strategy ??= {};
	strategy.sbn ??= {};
	strategy.esi ??= {};

	// Set defaults for strategy.sbn
	strategy.sbn.max_external_bits ??= 8;
	strategy.sbn.max_internal_value ??= 255;
	strategy.sbn.remap ??= {};

	// Validate strategy.sbn
	if (false
		|| typeof strategy.sbn.max_external_bits !== "number"
		|| !Number.isInteger(strategy.sbn.max_external_bits)
		|| strategy.sbn.max_external_bits < 0
		|| strategy.sbn.max_external_bits > 8
	) {
		throw_error(error_user_payload("Provided strategy.sbn.max_external_bits must be integer between 0 and 8."));
	}

	const max_sbn_external = (1 << strategy.sbn.max_external_bits) - 1;
	if (false
		|| typeof strategy.sbn.max_internal_value !== "number"
		|| !Number.isInteger(strategy.sbn.max_internal_value)
		|| strategy.sbn.max_internal_value < 0
		|| strategy.sbn.max_internal_value > max_sbn_external
	) {
		throw_error(error_user_payload(`Provided strategy.sbn.max_internal_value must be integer between 0 and ${max_sbn_external}.`));
	}

	// Set defaults for remap functions
	if (strategy.sbn.max_external_bits === 0) {
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

	if (strategy.sbn.max_external_bits > 0) {
		if (typeof strategy.sbn.remap.to_external !== "function") {
			throw_error(error_user_payload("Provided strategy.sbn.remap.to_external must be a function when max_external_bits > 0."));
		}
	} else if (strategy.sbn.remap.to_external !== undefined) {
		throw_error(error_user_payload("Provided strategy.sbn.remap.to_external cannot be present when max_external_bits is 0."));
	}

	// Set defaults for strategy.esi
	strategy.esi.max_external_bits ??= 24;
	strategy.esi.max_internal_value ??= (1 << 24) - 1;
	strategy.esi.remap ??= {};

	// Validate strategy.esi
	if (false
		|| typeof strategy.esi.max_external_bits !== "number"
		|| !Number.isInteger(strategy.esi.max_external_bits)
		|| strategy.esi.max_external_bits < 2
		|| strategy.esi.max_external_bits > 24
	) {
		throw_error(error_user_payload("Provided strategy.esi.max_external_bits must be integer between 2 and 24."));
	}

	const max_esi_external = (1 << strategy.esi.max_external_bits) - 1;
	if (false
		|| typeof strategy.esi.max_internal_value !== "number"
		|| !Number.isInteger(strategy.esi.max_internal_value)
		|| strategy.esi.max_internal_value < 0
		|| strategy.esi.max_internal_value > max_esi_external
	) {
		throw_error(error_user_payload(`Provided strategy.esi.max_internal_value must be integer between 0 and ${max_esi_external}.`));
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

	// Enforce num_source_blocks constraint based on strategy.sbn
	options ??= {};
	if (false
		|| options.num_source_blocks !== undefined
		&& (options.num_source_blocks < 1 || options.num_source_blocks > strategy.sbn.max_internal_value + 1)
	) {
		throw_error(error_user_payload(`Provided options.num_source_blocks must be between 1 and ${strategy.sbn.max_internal_value + 1}.`));
	}

	// Get the raw encoding result
	const raw_result = raptorq_raw.encode({ options, data });

	// Transform the encoding packets based on strategy
	const transformed_encoding_packets = (async function* () {
		// Check if we need ESI validation (calculate expected symbol count)
		const exact_opts = exact_options(options);
		const transfer_length = data.length;
		const estimated_source_symbols = Math.ceil(transfer_length / exact_opts.symbol_size);
		const estimated_total_symbols = estimated_source_symbols + exact_opts.num_repair_symbols;

		if (estimated_total_symbols > strategy.esi.max_internal_value) {
			throw_error(error_user_payload(`Estimated symbol count ${estimated_total_symbols} exceeds strategy.esi.max_internal_value ${strategy.esi.max_internal_value}.`));
		}

		for await (const packet of raw_result.encoding_packets) {
			let transformed_packet;

			if (strategy.sbn.max_external_bits === 0) {
				// Remove SBN (first byte) from the packet - behaves like "disable" mode
				const payload_without_sbn = packet.slice(1);

				// Transform ESI (next 3 bytes) 
				const esi_bytes = new Uint8Array(3);
				esi_bytes[0] = payload_without_sbn[0];
				esi_bytes[1] = payload_without_sbn[1];
				esi_bytes[2] = payload_without_sbn[2];

				// Convert ESI from bytes to internal value
				const internal_esi = (esi_bytes[0] << 16) | (esi_bytes[1] << 8) | esi_bytes[2];

				// Apply ESI remap to get external ESI value
				const external_esi = strategy.esi.remap.to_external(internal_esi);

				// Convert external ESI back to bytes based on max_external_bits
				const esi_byte_count = Math.ceil(strategy.esi.max_external_bits / 8);
				const new_esi_bytes = new Uint8Array(esi_byte_count);
				for (let i = 0; i < esi_byte_count; i++) {
					new_esi_bytes[esi_byte_count - 1 - i] = (external_esi >> (i * 8)) & 0xFF;
				}

				// Combine ESI bytes with symbol data
				transformed_packet = new Uint8Array(new_esi_bytes.length + payload_without_sbn.length - 3);
				transformed_packet.set(new_esi_bytes, 0);
				transformed_packet.set(payload_without_sbn.slice(3), new_esi_bytes.length);
			} else {
				// Transform SBN (first byte) and ESI (next 3 bytes)
				const sbn_byte = packet[0];
				const esi_bytes = new Uint8Array(3);
				esi_bytes[0] = packet[1];
				esi_bytes[1] = packet[2];
				esi_bytes[2] = packet[3];

				// Convert SBN to internal value then external value
				const external_sbn = strategy.sbn.remap.to_external(sbn_byte);

				// Convert ESI from bytes to internal value
				const internal_esi = (esi_bytes[0] << 16) | (esi_bytes[1] << 8) | esi_bytes[2];

				// Apply ESI remap to get external ESI value
				const external_esi = strategy.esi.remap.to_external(internal_esi);

				// Convert external SBN back to bytes based on max_external_bits
				const sbn_byte_count = Math.ceil(strategy.sbn.max_external_bits / 8);
				const new_sbn_bytes = new Uint8Array(sbn_byte_count);
				for (let i = 0; i < sbn_byte_count; i++) {
					new_sbn_bytes[sbn_byte_count - 1 - i] = (external_sbn >> (i * 8)) & 0xFF;
				}

				// Convert external ESI back to bytes based on max_external_bits
				const esi_byte_count = Math.ceil(strategy.esi.max_external_bits / 8);
				const new_esi_bytes = new Uint8Array(esi_byte_count);
				for (let i = 0; i < esi_byte_count; i++) {
					new_esi_bytes[esi_byte_count - 1 - i] = (external_esi >> (i * 8)) & 0xFF;
				}

				// Combine SBN, ESI, and symbol data
				const symbol_data = packet.slice(4);
				transformed_packet = new Uint8Array(new_sbn_bytes.length + new_esi_bytes.length + symbol_data.length);
				transformed_packet.set(new_sbn_bytes, 0);
				transformed_packet.set(new_esi_bytes, new_sbn_bytes.length);
				transformed_packet.set(symbol_data, new_sbn_bytes.length + new_esi_bytes.length);
			}

			yield transformed_packet;
		}
	})();

	return {
		oti: raw_result.oti,
		encoding_packets: transformed_encoding_packets,
	};
};
