const WARN_ON_CALLABLE_NON_FUNCTION = true;

/**
 * @stability 3 - stable
 * Makes an object callable.
 * 
 * Returns a resulting object such that when the object is called, the provided function is invoked.
 * The rest of the resulting object is proxied to the original object provided.
 */
export const callable = (obj, call) => {
	if (typeof obj === "function") {
		return new Proxy(obj, {
			apply: (_target, this_value, args) => Reflect.apply(call, this_value, args),
		});
	}

	if (WARN_ON_CALLABLE_NON_FUNCTION) {
		console.warn("Forcefully making non-function callable.", obj, call);
	}

	return new Proxy(call, {
		getPrototypeOf: () => Reflect.getPrototypeOf(obj),
		setPrototypeOf: (new_proto) => Reflect.setPrototypeOf(obj, new_proto),
		isExtensible: () => Reflect.isExtensible(obj),
		preventExtensions: () => Reflect.preventExtensions(obj),
		getOwnPropertyDescriptor: (prop) => Reflect.getOwnPropertyDescriptor(obj, prop),
		defineProperty: (prop, desc) => Reflect.defineProperty(obj, prop, desc),
		has: (prop) => Reflect.has(obj, prop),
		get: (_target, prop) => Reflect.get(obj, prop),
		set: (_target, prop, value) => Reflect.set(obj, prop, value),
		deleteProperty: (prop) => Reflect.deleteProperty(obj, prop),
		ownKeys: () => Reflect.ownKeys(obj),
	});
};
