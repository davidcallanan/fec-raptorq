/**
 * @stability 4 - locked
 * 
 * Fixes modular arithmetic in JavaScript to always return a positive number.
 */
export const pos_mod = (a, b) => {
	return ((a % b) + b) % b;
};

export const posMod = pos_mod;
