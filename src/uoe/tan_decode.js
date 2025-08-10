import { error_user_payload } from "./error_user_payload.js";
import { hex_decode } from "./hex_decode.js";
import { throw_error } from "./throw_error.js";

const encoder = new TextEncoder();

const unprefix = (lines, num_chars) => {
	return lines.map((line) => line.substring(num_chars));
};

const decode_raw_entry = (lines) => {
	let bytes = new Uint8Array(0);
	let prev_was = undefined;

	for (const line of lines) {
		const remains = line.substring(3);

		const content = (() => {
			if (line.startsWith(">u ")) {
				const content = encoder.encode(prev_was === "unicode" ? remains + "\n" : remains);
				prev_was = "unicode";
				return content;
			} else if (line.startsWith(">x ")) {
				prev_was = "hex";
				return hex_decode(remains);
			}
		})();

		const original = bytes;
		bytes = new Uint8Array(bytes.length + content.length);
		bytes.set(original);
		bytes.set(content, original.length);
	}

	return bytes;
};

export const _tan_decode = (lines) => {
	const entries = [];

	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (line === "") {
			i++;
		} else if (line.startsWith(">> ")) {
			const nested_lines = [];

			for (var j = i; (true
				&& j < lines.length
				&& lines[j].startsWith(">> ")
			); j++) {
				nested_lines.push(lines[j]);
			}

			entries.push(_tan_decode(unprefix(nested_lines, 3)));

			i = j;
		} else if (false
			|| line.startsWith(">u ")
			|| line.startsWith(">x ")
		) {
			const nested_lines = [];

			for (let j = i; (true
				&& j < lines.length
				&& (false
					|| lines[j].startsWith(">u ")
					|| lines[j].startsWith(">x ")
				)
			); j++) {
				nested_lines.push(lines[j]);
				entries.push(decode_raw_entry(nested_lines));
			}
		} else if (line.startsWith("> ")) {
			const nested_lines = [];

			for (var j = i; (true
				&& j < lines.length
				&& lines[j].startsWith("> ")
			); j++) {
				nested_lines.push(lines[j]);
			}

			entries.push(encoder.encode(unprefix(nested_lines, 2).join("\n")));

			i = j;
		} else {
			entries.push(encoder.encode(line));
			i++;
		}
	}

	return entries;
};

/**
 * @stabililty 1 - experimental
 *
 * Decodes "Textual Array Notation" back into a (potentially-nested) array of uint8arrays.
 */
export const tan_decode = (input) => {
	if (typeof input !== "string") {
		throw_error(error_user_payload("input must be string"));
	}

	const lines = input.split("\n");
	return _tan_decode(lines);
};

export const tanDecode = tan_decode;
