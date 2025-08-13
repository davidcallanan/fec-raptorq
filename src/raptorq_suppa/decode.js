import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";

export const decode = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
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

	// Transform the encoding packets based on strategy before passing to raw decode
	const transformed_encoding_packets = {
		async *[Symbol.asyncIterator]() {
			for await (const packet of encoding_packets) {
				let transformed_packet;

				if (strategy.sbn.max_external_bits === 0) {
					// Add SBN (0 since external bits is 0) as first byte
					// Extract ESI bytes based on external bits
					const esi_byte_count = Math.ceil(strategy.esi.max_external_bits / 8);
					const external_esi_bytes = packet.slice(0, esi_byte_count);

					// Convert external ESI bytes to value
					let external_esi = 0;
					for (let i = 0; i < esi_byte_count; i++) {
						external_esi |= external_esi_bytes[i] << ((esi_byte_count - 1 - i) * 8);
					}

					// Apply ESI remap to get internal ESI value
					const internal_esi = strategy.esi.remap.to_internal(external_esi);

					// Convert internal ESI to 3-byte format
					const internal_esi_bytes = new Uint8Array(3);
					internal_esi_bytes[0] = (internal_esi >> 16) & 0xFF;
					internal_esi_bytes[1] = (internal_esi >> 8) & 0xFF;
					internal_esi_bytes[2] = internal_esi & 0xFF;

					// Reconstruct packet: SBN (0) + internal ESI (3 bytes) + symbol data
					const symbol_data = packet.slice(esi_byte_count);
					transformed_packet = new Uint8Array(1 + 3 + symbol_data.length);
					transformed_packet[0] = 0; // SBN is 0 since max_external_bits is 0
					transformed_packet.set(internal_esi_bytes, 1);
					transformed_packet.set(symbol_data, 4);
				} else {
					// Extract SBN and ESI bytes based on external bits
					const sbn_byte_count = Math.ceil(strategy.sbn.max_external_bits / 8);
					const esi_byte_count = Math.ceil(strategy.esi.max_external_bits / 8);

					const external_sbn_bytes = packet.slice(0, sbn_byte_count);
					const external_esi_bytes = packet.slice(sbn_byte_count, sbn_byte_count + esi_byte_count);

					// Convert external SBN bytes to value
					let external_sbn = 0;
					for (let i = 0; i < sbn_byte_count; i++) {
						external_sbn |= external_sbn_bytes[i] << ((sbn_byte_count - 1 - i) * 8);
					}

					// Convert external ESI bytes to value
					let external_esi = 0;
					for (let i = 0; i < esi_byte_count; i++) {
						external_esi |= external_esi_bytes[i] << ((esi_byte_count - 1 - i) * 8);
					}

					// Apply remap functions to get internal values
					const internal_sbn = strategy.sbn.remap.to_internal(external_sbn);
					const internal_esi = strategy.esi.remap.to_internal(external_esi);

					// Convert internal ESI to 3-byte format
					const internal_esi_bytes = new Uint8Array(3);
					internal_esi_bytes[0] = (internal_esi >> 16) & 0xFF;
					internal_esi_bytes[1] = (internal_esi >> 8) & 0xFF;
					internal_esi_bytes[2] = internal_esi & 0xFF;

					// Reconstruct packet: SBN (1 byte) + internal ESI (3 bytes) + symbol data
					const symbol_data = packet.slice(sbn_byte_count + esi_byte_count);
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
