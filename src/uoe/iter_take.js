export function* iter_take(iterator, n) {
	let count = 0;

	for (const item of iterator) {
		if (count >= n) {
			return;
		}

		yield item;
		count++;
	}
}

export const iterTake = iter_take;
