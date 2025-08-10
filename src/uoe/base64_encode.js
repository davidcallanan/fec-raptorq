import { error_user_payload } from "./error_user_payload.js";
import { throw_error } from "./throw_error.js";

/**
 * No-one should ever have the write a `base64_encode` function again.
 * 
 * Aside - Why is there still no better web standard than working with Latin-1 strings?
 */
export const base64_encode = (input) => {
	if (!(input instanceof Uint8Array)) {
		throw_error(error_user_payload("input must be uint8array"));
	}

	// Convert input into Latin-1 UTF-16, with the high byte zeroed.
	// This safely encodes arbitrary binary data into the format expected by `btoa`.
	const latin_string = Array.prototype.map.call(input, (byte) => String.fromCharCode(byte)).join("");

	return btoa(latin_string);
};

export const base64Encode = base64_encode;
