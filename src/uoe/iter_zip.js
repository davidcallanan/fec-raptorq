export const iter_zip = function* (...iterables) {
	const its = iterables.map((iterable) => iterable[Symbol.iterator]());

	while (true) {
		let nexts = its.map((it) => it.next());

		if (nexts.some((next) => next.done)) {
			break;
		}

		yield nexts.map((next) => next.value);
	}
};

export const iterZip = iter_zip;
