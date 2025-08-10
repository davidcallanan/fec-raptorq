import { error_user_payload } from "./error_user_payload.js";
import { throw_error } from "./throw_error.js";

/**
 * @stability 2 - provisional
 */
export const hex_encode = (bytes) => {
	if (!(bytes instanceof Uint8Array)) {
		throw_error(error_user_payload("bytes must be uint8array"));
	}

	return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const hexEncode = hex_encode;
