import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import Uint1Array from "../Uint1Array.js";

export const decode = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
	strategy ??= {};
	strategy.sbn ??= {};
	strategy.esi ??= {};

	// Set defaults for strategy.sbn
	strategy.sbn.external_bits ??= 8;
	strategy.sbn.max_internal_value ??= 255;
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

	const max_sbn_external = (1 << strategy.sbn.external_bits) - 1;
	if (false
		|| typeof strategy.sbn.max_internal_value !== "number"
		|| !Number.isInteger(strategy.sbn.max_internal_value)
		|| strategy.sbn.max_internal_value < 0
		|| strategy.sbn.max_internal_value > max_sbn_external
	) {
		throw_error(error_user_payload(`Provided strategy.sbn.max_internal_value must be integer between 0 and ${max_sbn_external}.`));
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

	// Set defaults for strategy.esi
	strategy.esi.external_bits ??= 24;
	strategy.esi.max_internal_value ??= (1 << 24) - 1;
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

	const max_esi_external = (1 << strategy.esi.external_bits) - 1;
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

	// Transform the encoding packets based on strategy before passing to raw decode
	const transformed_encoding_packets = {
		async *[Symbol.asyncIterator]() {
			for await (const packet of encoding_packets) {
				let transformed_packet;

				if (strategy.sbn.external_bits === 0) {
					// Extract ESI from packed bits using Uint1Array
					const esi_bits = strategy.esi.external_bits;
					const esi_bytes_needed = Math.ceil(esi_bits / 8);
					const esi_packed_bytes = packet.slice(0, esi_bytes_needed);

					// Create Uint1Array from packed bytes to extract ESI bits
					const combined_array = new Uint1Array(esi_bits);
					combined_array.get_underlying_buffer().set(esi_packed_bytes);

					// Extract ESI array (entire array in this case)
					const esi_array = combined_array.slice(0, esi_bits);
					const external_esi = Number(esi_array.to_bigint());

					// Apply ESI remap to get internal ESI value
					const internal_esi = strategy.esi.remap.to_internal(external_esi);

					// Convert internal ESI to 3-byte format
					const internal_esi_bytes = new Uint8Array(3);
					internal_esi_bytes[0] = (internal_esi >> 16) & 0xFF;
					internal_esi_bytes[1] = (internal_esi >> 8) & 0xFF;
					internal_esi_bytes[2] = internal_esi & 0xFF;

					// Reconstruct packet: SBN (0) + internal ESI (3 bytes) + symbol data
					const symbol_data = packet.slice(esi_bytes_needed);
					transformed_packet = new Uint8Array(1 + 3 + symbol_data.length);
					transformed_packet[0] = 0; // SBN is 0 since external_bits is 0
					transformed_packet.set(internal_esi_bytes, 1);
					transformed_packet.set(symbol_data, 4);
				} else {
					// Extract SBN+ESI from packed bits using unified Uint1Array
					const total_bits = strategy.sbn.external_bits + strategy.esi.external_bits;
					const total_bytes_needed = Math.ceil(total_bits / 8);
					const packed_bytes = packet.slice(0, total_bytes_needed);

					// Create unified Uint1Array from packed bytes
					const combined_array = new Uint1Array(total_bits);
					combined_array.get_underlying_buffer().set(packed_bytes);

					// Extract separate SBN and ESI arrays
					const sbn_array = combined_array.slice(0, strategy.sbn.external_bits);
					const esi_array = combined_array.slice(strategy.sbn.external_bits, total_bits);

					// Convert to values using BigInt
					const external_sbn = Number(sbn_array.to_bigint());
					const external_esi = Number(esi_array.to_bigint());

					// Apply remap functions to get internal values
					const internal_sbn = strategy.sbn.remap.to_internal(external_sbn);
					const internal_esi = strategy.esi.remap.to_internal(external_esi);

					// Convert internal ESI to 3-byte format
					const internal_esi_bytes = new Uint8Array(3);
					internal_esi_bytes[0] = (internal_esi >> 16) & 0xFF;
					internal_esi_bytes[1] = (internal_esi >> 8) & 0xFF;
					internal_esi_bytes[2] = internal_esi & 0xFF;

					// Reconstruct packet: SBN (1 byte) + internal ESI (3 bytes) + symbol data
					const symbol_data = packet.slice(total_bytes_needed);
					transformed_packet = new Uint8Array(1 + 3 + symbol_data.length);
					transformed_packet[0] = internal_sbn & 0xFF; // Convert to single byte
					transformed_packet.set(internal_esi_bytes, 1);
					transformed_packet.set(symbol_data, 4);
				}

				yield transformed_packet;
			}
		}
	};

	return raptorq_raw.decode({ usage, oti, encoding_packets: transformed_encoding_packets });
};
