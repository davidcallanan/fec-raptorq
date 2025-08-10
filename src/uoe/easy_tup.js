/**
 * Constructs an object containing both positional and named fields.
 * 
 * Not to be confused with a uoe tuple.
 * 
 * @example
 * 
 * sum_vectors(easy_tup(1, 2), easy_tup(3, 4));
 * 
 * @example
 * 
 * const person = easy_tup("John", "Doe")({
 *   age: 30,
 * });
 */
export const easy_tup = (...fields) => {
	return new Proxy(fields, {
		apply: (_, __, [obj]) => {
			let result = [...fields];

			for (let key in obj) {
				result[key] = obj[key];
			}

			return result;
		},
	});
};
