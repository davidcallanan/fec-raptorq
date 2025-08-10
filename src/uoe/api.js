import { unsuspended_promise } from "./unsuspended_promise.js";

const apis = new WeakSet();

/**
 * @stability 1 - experimental
 * 
 * A uoe-api is a potentially indeterminstic function that may have side effects. It is the least-restrictive concept of a function.
 * 
 * An api does not take in any further arguments, and can merely be executed.
 * 
 * If input data must be provided, a map can be used which then returns an api to be executed, kind of like currying.
 * 
 * If calling a map with no arguments returns an api, this api will be implicitely executed. This means a map can still expose indeterminism, provided it is understood that an api return value is expected.
 */
export const api = (exec) => {
	const api_internal = unsuspended_promise((input) => exec(input));
	const api = () => api_internal();
	apis.add(api);
	return api;
};

/**
 * Checks if an object is a uoe-api.
 */
export const is_api = (obj) => apis.has(obj);

export const isApi = is_api;
