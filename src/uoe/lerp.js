/**
 * Interpolates linearly between two values `a` and `b` based on the parametric value `t`.
 */
export const lerp = (a, b, t) => {
	return a + (b - a) * t;	
};
