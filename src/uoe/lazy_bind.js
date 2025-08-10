import { callable } from "./callable.js";

/**
 * @stability 4 - locked
 * 
 * Binds the `this` value of a function lazily.
 * 
 * Takes in a `lazy_this_value` function that returns the `this` value to be used.
 */
export const lazy_bind = (func, lazy_this_value) => {
	// Note: Reflect is used to ensure the safe administration of native behaviour.
	return callable(func, (...args) => Reflect.apply(func, lazy_this_value(), args));
};
