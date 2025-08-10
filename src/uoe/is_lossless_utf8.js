import { compare_bytes } from "./compare_bytes.js";
import { error_user_payload } from "./error_user_payload.js";
import { throw_error } from "./throw_error.js";

const decoder_fatal = new TextDecoder("utf-8", {
	fatal: true,
});

/**
 * @stability 1 - experimental
 * 
 * The purpose of this function is to determine if binary data is both valid UTF-8 data and can also be losslessly converted back to the original raw bytes (e.g. a BOM mark would poison the data and classify it as lossy given that we must allow the case that the user reinterprets the data as binary data instead of UTF-8).
 * 
 * This function is of particular use when raw binary data must be stored and the programmer must determine the safety of transmitting this data through a text-based medium (text file, text editor, copy & paste, etc.) rather than a binary medium.
 * 
 * If there is any risk, this function will return false, advising the programmer to use a binary medium.
 */
export const is_lossless_utf8 = (input) => {
	if (!(input instanceof Uint8Array)) {
		throw_error(error_user_payload("input must be uint8array"));
	}

	try {
		var decoded = decoder_fatal.decode(input);
	} catch (e) {
		return false;
	}

	const encoded = new TextEncoder().encode(decoded);

	// TODO: is this exhaustive?

	if (!compare_bytes(input, encoded)) {
		return false;
	}

	return true;
};

export const isLosslessUtf8 = is_lossless_utf8;
