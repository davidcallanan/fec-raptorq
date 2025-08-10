import { is_enum } from "./is_enum.js";
import { is_map } from "./is_map.js";
import { unsuspended_promise } from "./unsuspended_promise.js";

/**
 * @stability 1 - experimental
 * 
 * Checks if a uoe-map is an enum and subsequently returns it.
 */
export const get_enum = unsuspended_promise(async (object) => {
	if (is_map(object)) {
		const map = object;
		const result = await map();
		return await get_enum(result);
	}

	if (is_enum(object)) {
		return object;
	}

	return undefined;
});

export const getEnum = get_enum;
