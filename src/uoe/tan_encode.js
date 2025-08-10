import { error_user_payload } from "./error_user_payload.js";
import { hex_encode } from "./hex_encode.js";
import { is_lossless_utf8 } from "./is_lossless_utf8.js";
import { throw_error } from "./throw_error.js";
import { utf8_decode_maximally } from "./utf8_decode_maximally.js";

const prefix = (string, pref) => {
	return string
		.split("\n")
		.map((line) => pref + line)
		.join("\n");
};

const is_dangerous = (entry) => (false
	|| entry === ""
	|| entry.includes("\n")
	|| entry.startsWith(">")
);

const encode_raw_entry = (entry) => {
	let output = "";
	let i = 0;

	while (i < entry.length) {
		const result = utf8_decode_maximally(entry.subarray(i));

		if (false
			|| result.num_valid_bytes >= 16
			|| (true
				&& result.num_valid_bytes > 0
				&& i + result.num_valid_bytes === entry.length
			)
		) {
			output += prefix(result.string, ">u ") + "\n";
			i += result.num_valid_bytes;
		}

		for (let j = 8; j <= 32; j += 8) {
			if (i + j > entry.length) {
				output += ">x " + hex_encode(entry.subarray(i)) + "\n";
				i = entry.length;
				break;
			}

			if (false
				|| j === 32
				|| utf8_decode_maximally(entry.subarray(i + j)).num_valid_bytes >= 16
			) {
				output += ">x " + hex_encode(entry.subarray(i, i + j)) + "\n";
				i += j;
				break;
			}
		}

	}

	return output;
};

/**
 * @stabililty 1 - experimental
 * 
 * Encodes an (optionally nested) array of uint8arrays/strings into "Textual Array Notation" (TAN).
 * 
 * This is a UTF-8 encoding suitable for transfer through text-based mediums. The format can hold arbitrary binary data.
 * 
 * If a string is encountered, it is first encoded as UTF-8. TAN does not remember whether the original input was textual or binary data, so if a distinction must be made, you would need a custom way to indicate this fact.
 * 
 * All binary data is valid, including newlines and empty strings.
 */
export const tan_encode = (entries, no_trailing) => {
	if (!Array.isArray(entries)) {
		throw_error(error_user_payload("entries must be array"));
	}

	let output = "";
	let prev_was = undefined;

	const mapped_entries = entries.map((entry) => {
		if (typeof entry === "string") {
			return new TextEncoder().encode(entry);
		}

		return entry;
	});

	for (const entry of mapped_entries) {
		if (entry instanceof Uint8Array) {
			if (!is_lossless_utf8(entry)) {
				if (prev_was === "multiline_bytes") {
					output += "\n";
				}

				output += encode_raw_entry(entry);
				prev_was = "multiline_bytes";
			} else {
				const entry_string = new TextDecoder().decode(entry);

				if (is_dangerous(entry_string)) {
					if (prev_was === "multiline_unicode") {
						output += "\n";
					}

					output += prefix(entry_string, "> ") + "\n";
					prev_was = "multiline_unicode";
				} else {
					output += entry_string + "\n";
					prev_was = "unicode";
				}
			}
		} else if (Array.isArray(entry)) {
			const itself = tan_encode(entry, true);

			if (prev_was === "multiline_tan") {
				output += "\n";
			}

			output += prefix(itself, ">> ") + "\n";
			prev_was = "multiline_tan";
		} else {
			throw_error(error_user_payload("each entry must be string, uint8array or array"));
		}
	}

	if (no_trailing && output.endsWith("\n")) {
		return output.substring(0, output.length - 1);
	}

	return output;
};

export const tanEncode = tan_encode;
