/**
 * @stability 2 - provisional
 */
export const bigint_decode = (bytes) => {
	let bint = 0n;

	for (let i = 0; i < bytes.length; i++) {
		bint <<= 8n;
		bint += BigInt(bytes[i]);
	}

	return bint;
};

export const bigintDecode = bigint_decode;
