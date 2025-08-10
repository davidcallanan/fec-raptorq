/**
 * Maps an iterable.
 * 
 * The first argument is the iterable and the second argument is the mapper function.
 */
export const iter_map = function* (iterable, mapper) {
	let i = 0;

	for (const item of iterable) {
		yield mapper(item, i);	
		i++;
	}
};
