export const reduce = (iterable, reducer, initial_acc) => {
	let acc = initial_acc;

	for (let entry of iterable) {
		acc = reducer(acc, entry);
	}

	return acc;
};
