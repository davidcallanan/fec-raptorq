/**
 * @stability 2 - provisional
 * 
 * Collects all items from an async iterable into an array.
 */
export const collect_async = async (async_iterable) => {
	const result = [];

	for await (const item of await async_iterable) {
		result.push(item);
	}
	
	return result;
};

export const collectAsync = collect_async;
