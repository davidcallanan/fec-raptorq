import { lazy_bind } from "./lazy_bind.js";

/**
 * @stability 4 - locked
 * 
 * Binds a function's `this` value to itself.
 * 
 * This is useful for creating callable objects where `this` refers to the callable object itself.
 */
export const bind_self = (func) => {
	// Note: The usage of `var` is intentional.
	var result = lazy_bind(func, () => result);
	return result;
};
