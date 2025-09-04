/**
 * @stability 3 - stable
 * 
 * Shallow-clones an object while simultaneously defaulting it to an empty object.
 */
export const shallow = (object) => {
	return { ...(object ?? {}) };
};
