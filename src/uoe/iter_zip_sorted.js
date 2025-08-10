import { reduce } from "./reduce.js"; 

/**
 * This function iterates over multiple pre-sorted iterables such that the combined iteration remains sorted.
 * 
 * A comparison function must be provided and it is assumed that the provided iterables are already individually sorted with respect to this comparison function.
 */
export const iter_zip_sorted = function* (compare, ...iterables) {
	const its = iterables.map((iterable) => iterable[Symbol.iterator]());
	const nexts = its.map((it) => it.next());

	while (true) {
		if (nexts.every((next) => next.done)) {
			break;
		}

		let [min_idx, min] = reduce(nexts.entries(), ([min_idx, min]=[], [next_idx, next]) => {
			if (min_idx === undefined || min.done) {
				return [next_idx, next];
			}

			if (next.done) {
				return [min_idx, min];
			}

			return compare(next.value, min.value) < 0 ? [next_idx, next] : [min_idx, min];
		});

		yield min.value;
		
		nexts[min_idx] = its[min_idx].next();
	}
}
