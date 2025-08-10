import { map } from "./map.js";
import { call_as_async } from "./call_as_async.js";

// TODO: test
/**
 * @deprecated See `obtain_map`. Scheduled for removal in June 2027.
 * 
 * Immediately returns a map equal to that eventually obtained by the given async function.
 * 
 * @example
 * 
 * const map = unsuspended_map(async () => {
 *   await timeout(1000);
 *   return map(() => {
 *     if (input === undefined) {
 *       return "foo";
 *     }
 *   });
 * });
 * 
 * console.log(await map()); // "foo"
 */
export const unsuspended_map = (func) => {
	const the_map = call_as_async(func);

	return map(async (input) => {
		return await (await the_map)(input);
	});
};

export const unsuspendedMap = unsuspended_map;
