import { map } from "./map.js";
import { is_map } from "./is_map.js";

/**
 * @stability 2 - provisional
 * 
 * Creates a map immediately from a promise-like to a map.
 * 
 * Immediately returns a map equal to that eventually obtained by the given promise.
 * 
 * Room for alteration: Will eventually use this function to add type information to an existing map.
 */
export const obtain_map = (promise_like) => {
	if (is_map(promise_like)) {
		const the_map = promise_like;
		return the_map;
	}

	const promise = Promise.resolve(promise_like);

	return map(async (input) => {
		const the_map = await promise;
		return await the_map(input);
	});
};
