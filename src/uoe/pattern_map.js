import { empty_map } from "./empty_map.js";

/**
 * Constructs a larger map from a list of patterns and their corresponding maps.
 * 
 * @example
 * 
 * const default_map = leaf_map("foobar");
 * 
 * const map = pattern_map([
 *   default_map,
 * 	 ["foo", leaf_map("foo")],
 *   ["bar", leaf_map("bar")],
 * ]);
 * 
 * await map(); // "foobar"
 * await map("foo")(); // "foo"
 * await map("bar")(); // "bar"
 * 
 * @todo Implement more patterns than just a simple symbol match.
 */
export const pattern_map = (patterns) => {
	patterns ??= [];

	// TODO: In future it would not be just a simple Map to achieve this, as we need to allow nested and subpatterns.
	const patterns_map = new Map();
	let default_pattern = empty_map;

	if (!Array.isArray(patterns)) {
		throw TypeError("`patterns` must be an array.");
	}

	for (const pattern of patterns) {
		if (! (false
			|| Array.isArray(pattern)
			|| is_map(pattern)
		)) {
			throw TypeError("Each pattern must be an array or a map for the default pattern.");
		}

		if (Array.isArray(pattern)) {
			if (pattern.length !== 2) {
				throw TypeError("Each pattern must have exactly two elements.");
			}

			const [left, map] = pattern;
			
			const symbol = (() => {
				if (typeof left === "string") {
					return enm[left];
				}

				if (is_enm(left)) {
					if (left.data !== undefined) {
						throw "Not implemented.";
					}

					return left;
				}

				throw "Not implemented.";
			})();

			if (!is_map(map)) {
				throw TypeError("The map corresponding to each pattern must be a map.");
			}

			if (patterns_map.has(symbol)) {
				throw TypeError(`Duplicate pattern for symbol ${symbol}.`);
			}

			patterns_map.set(symbol, map);
		} else {
			const map = pattern;
			default_pattern = map;
		}
	}

	return map((input) => {
		if (is_enm(input)) {
			if (input.data !== undefined) {
				throw "Not implemented. TODO: Break into constituent symbol and data.";
			}

			if (patterns_map.has(input.sym)) {
				return patterns_map.get(input.sym);
			}
		}

		return default_map(input);
	});
};

export const patternMap = pattern_map;
