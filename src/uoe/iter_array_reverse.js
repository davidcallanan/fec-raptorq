/**
 * @stability 3 - stable
 * 
 * Iterates an array in reverse.
*/

export const iter_array_reverse = (arr) => {
	return {
		[Symbol.iterator]: () => {
			let idx = arr.length;

			return {
				next: () => {
					idx--;

					return {
						done: idx < 0,
						value: arr[idx],
					};
				},
			};
		},
	};
};

export const iterArrayReverse = iter_array_reverse;
