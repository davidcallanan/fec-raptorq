import { pos_mod } from "./pos_mod.js";

/**
 * Normalizes an angle to be between 0 and 2 pi radians.
 */
export const normalized_angle = (angle) => {
	return pos_mod(angle, 2 * Math.PI);
};
