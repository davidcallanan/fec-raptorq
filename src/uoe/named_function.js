/**
 * @stability 4 - locked
 * 
 * Creates a function that is dynamically named at run-time.
 */
export const named_function = (name, func) => {
	// Note: An arrow function is not used because the `this` value must be maintained.
	// Note: Reflect is used to ensure the safe administration of native behaviour.
	return { [name]: function(...args) { return Reflect.apply(func, this, args) } }[name];
};

export const namedFunction = named_function;
