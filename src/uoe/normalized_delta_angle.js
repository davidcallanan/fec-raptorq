import { normalized_angle } from "./normalized_angle.js";

/**
 * Normalizes an angle to be between negative pi and positive pi radians.
 */
export const normalized_delta_angle = (angle) => {
	return normalized_angle(angle + Math.PI) - Math.PI;
};
