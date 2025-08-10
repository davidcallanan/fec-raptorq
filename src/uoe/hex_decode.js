import { error_user_payload } from "./error_user_payload.js";
import { throw_error } from "./throw_error.js";

/**
 * @stability 2 - provisional
 */
export const hex_decode = (input) => {
	if (typeof input !== "string") {
		throw_error(error_user_payload("input must be string"));
	}

	if (input.length % 2 !== 0) {
		throw_error(error_user_payload("input must have even length"));
	}

	if (!input.match(/^[0-9a-fA-F]+$/)) {
		throw_error(error_user_payload("input must contain hex"));
	}

	const bytes = new Uint8Array(input.length / 2);

	for (let i = 0; i < input.length; i += 2) {
		bytes[i / 2] = parseInt(input.substring(i, i + 2), 16);
	}

	return bytes;
};

export const hexDecode = hex_decode;
