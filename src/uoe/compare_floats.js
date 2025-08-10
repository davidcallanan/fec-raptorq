export const compare_floats = (a, b, epsilon) => {
	epsilon ??= 1e-6;
	return Math.abs(a - b) < epsilon;
};
