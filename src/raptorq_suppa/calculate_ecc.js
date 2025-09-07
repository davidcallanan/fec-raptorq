import { error_internal } from "../uoe/error_internal.js";
import { throw_error } from "../uoe/throw_error.js";

export const calculate_ecc = (strategy, mini_header, symbol_data) => {
	if (strategy.encoding_packet.ecc.external_bits === 0n) {
		throw_error(error_internal("assertion failed: ECC external_bits cannot be 0"));
	}

	const combined_data = new Uint8Array(mini_header.length + symbol_data.length);

	combined_data.set(mini_header, 0);
	combined_data.set(symbol_data, mini_header.length);

	const ecc_value = strategy.encoding_packet.ecc.generate_ecc(combined_data);
	const max_ecc_value = (1n << strategy.encoding_packet.ecc.external_bits) - 1n;

	return ecc_value & max_ecc_value;
};
