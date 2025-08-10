/**
 * @stability 2 - provisional
 */
export const bigint_encode = (bint, num_bytes) => {
	num_bytes ??= 8;

	const bytes = new Uint8Array(num_bytes);

	for (let i = num_bytes - 1; i >= 0; i--) {
		bytes[i] = Number(bint & 255n);
		bint >>= 8n;
	}

	return bytes;
};

export const bigintEncode = bigint_encode;
