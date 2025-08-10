import { iter_zip } from "./iter_zip.js";

/**
 * @deprecated as this uses the legacy tuple format.
 * 
 * Normalizes a tuple such that unnamed fields match the values of named fields.
 * 
 * @example
 * 
 * const vector = tup(1, 2)({ z: 3 });
 * const { x, y, z } = normalize_tuple(vector, ["x", "y", "z"]);
 */
export const normalize_tuple = (tuple, mappings) => {
	const index_by_field_name = new Map();

	for (let [idx, field_name] of mappings.entries()) {
		index_by_field_name.set(field_name, idx);
	}

	let result = [];

	for (let [unnamed_field, field_name] of iter_zip(tuple, mappings)) {
		let value = unnamed_field !== undefined ? unnamed_field : field_name !== undefined ? tuple[field_name] : undefined;
		result.push(value);
		field_name !== undefined && (result[field_name] = value);
	}

	for (let field_name in tuple) {
		if (field_name in result) {
			continue;
		}

		result[field_name] = tuple[field_name];

		if (index_by_field_name.has(field_name)) {
			result[index_by_field_name.get(field_name)] = tuple[field_name];
		}
	}

	return result;
};

export const normalizeTuple = normalize_tuple;
