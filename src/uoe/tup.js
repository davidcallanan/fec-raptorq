import { map } from "./map.js";
import { is_enum } from "./is_enum.js";
import { enm } from "./enm.js";

const create_tup = (positional_fields, named_fields) => {
	const m = map((input) => {
		if (input === undefined) { // TODO
			input = enm[0];
		}

		if (is_enum(input)) {
			const pos = parseInt(input.sym);

			if (isNaN(pos)) {
				return named_fields[input.sym];
			}

			return positional_fields[pos];
		}

		if (typeof input === "object") {
			return create_tup(positional_fields, {
				...named_fields,
				...input,
			});
		}
	});

	return m;
};

/**
 * Constructs a uoe tuple which is just a uoe map with both positional and named fields.
 * 
 * @example
 * 
 * sum_vectors(tup(1, 2), tup(3, 4));
 * 
 * @example
 * 
 * const person = tup("John", "Doe")({
 *   age: 30,
 * });
 * 
 * console.log(await person[0]());
 * console.log(await person[1]());
 * console.log(await person.age());
 */
export const tup = (...fields) => {
	return create_tup(fields, {});
};
