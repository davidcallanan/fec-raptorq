/**
 * Maps an iterable but returns an async iterator allowing for an async mapper function to be used.
 */
export const iter_map_async = async function* (iterable, mapper) {
	let i = 0;

	for await (const item of iterable) {
		yield await mapper(item, i);
		i++;
	}
};

export const iterMapAsync = iter_map_async;
