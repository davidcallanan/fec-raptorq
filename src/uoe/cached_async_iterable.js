/**
 * @stability 1 - experimental
 * 
 * Creates an async iterable that caches the results of an async iterator.
 * 
 * This allows for immediate re-iteration.
 */
export const cached_async_iterable = (iterator) => {
	let cache = [];

	return {
		async *[Symbol.asyncIterator] () {
			let i = 0;

			while (true) {
				if (i < cache.length) {
					const entry = await cache[i];

					if (entry.done) {
						return entry.value;
					} else {
						yield entry.value;
					}
				} else {
					const result = iterator.next();
					cache.push(result);
					continue;
				}

				i++;
			}
		}
	};
};

export const cachedAsyncIterable = cached_async_iterable;
