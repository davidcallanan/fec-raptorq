import { error_user_payload } from "./error_user_payload.js";
import { throw_error } from "./throw_error.js";

/**
 * No-one should ever have the write a `base64_decode` function again.
 */
export const base64_decode = (input) => {
	if (typeof input !== "string") {
		throw_error(error_user_payload("input must be string"));
	}

	const latin_string = atob(input);
	const output = new Uint8Array(latin_string.length);

	for (let i = 0; i < latin_string.length; i++) {
		output[i] = latin_string.charCodeAt(i);
	}

	return output;
};

export const base64Decode = base64_decode;
