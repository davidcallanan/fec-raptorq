/**
 * @stability 4 - locked
 * 
 * Properly converts any function to an async function.
 */

export const as_async = (possibly_async_func) => {
	// Note: An arrow function is not used because the `this` value must be maintained.
	// Note: Reflect is used to ensure the safe administration of native behaviour.
	return async function (...args) {
		return await Reflect.apply(possibly_async_func, this, args);
	};
};

export const asAsync = as_async;
