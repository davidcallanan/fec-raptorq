const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", {
	fatal: false,
	ignoreBOM: false,
});

const fatal_decoder = new TextDecoder("utf-8", {
	fatal: true,
	ignoreBOM: false,
});

/**
 * @stability 1 - experimental
 * 
 * Decodes a Uint8Array containing UTF-8 data into a string until it hits an invalid byte sequence.
 * 
 * Returns an object containing the maximal valid `string` and corresponding `num_bytes` taken from the original input.
 */
export const utf8_decode_maximally = (bytes) => {
	// A naïve approach might be to just non-fatally decode and re-encode the string, counting the number of bytes of overlap.
	// This technique would not work due to some combinations beginning with 0xEF being invalid UTF-8, subsequently getting replaced by the replacement character 0xEF 0xBF 0xBD.
	// The byte 0xEF would incorrectly be counted in the overlap check.
	// As such, an additional check for the replacement character is necessary.

	const decoded = decoder.decode(bytes);

	const num_valid_bytes = (() => {
		const re_encoded = encoder.encode(decoded);

		for (let i = 0; i < re_encoded.length; i++) {
			if (bytes[i] === re_encoded[i]) {
				if (true
					&& i + 2 < re_encoded.length
					&& re_encoded[i] === 0xEF
					&& re_encoded[i + 1] === 0xBF
					&& re_encoded[i + 2] === 0xBD
					&& (false
						|| bytes[i + 1] !== 0xBF
						|| bytes[i + 2] !== 0xBD
					)
				) {
					return i;
				}

				continue;
			}

			return i;
		};
	})();

	return {
		string: fatal_decoder.decode(bytes.subarray(0, num_valid_bytes)),
		num_valid_bytes,
	};
};

export const utf8DecodeMaximally = utf8_decode_maximally;
