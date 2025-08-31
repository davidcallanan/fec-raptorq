/**
 * @stability 3 - stable
 * 
 * Fixes modular arithmetic in JavaScript to always return a positive number.
 */
export const bigint_pos_mod = (a, b) => {
	return ((a % b) + b) % b;
};

export const bigintPosMod = bigint_pos_mod;
