/**
 * @deprecated This should support async iterables too.
 */
export const map_collect_async = (iterable, mapper) => {
	const promises = [];
	let i = 0;

	for (const item of iterable) {
		const curr_i = i;
		promises.push(item.then(result => mapper(result, curr_i)));
		i++;
	}

	return Promise.all(promises);
};

export const mapCollectAsync = map_collect_async;
