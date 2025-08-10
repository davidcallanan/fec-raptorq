import { map } from "./map.js";
import { is_map } from "./is_map.js";

/**
 * @stability 2 - provisional
 * 
 * Constructs a uoe-map object with only a single leaf value.
 * 
 * @example
 * 
 * const first_name = leaf_map("john");
 * const last_name = leaf_map(Promise.resolve("doe"));
 * 
 * console.log(await first_name()); // "john"
 * console.log(await last_name()); // "doe"
 */
export const leaf_map = (value) => {
	if (is_map(value)) {
		return value;
	}

	return map((input) => {
		if (input === undefined) {
			return value;
		}
	});
};

export const leafMap = leaf_map;
