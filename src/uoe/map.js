import { enm } from "./enm.js";
import { is_enum } from "./is_enum.js";
import { is_api } from "./is_api.js";
import { named_function } from "./named_function.js";
import { unsuspended_promise } from "./unsuspended_promise.js";

const symbol_is_map = Symbol("is_map");

export const _is_map = (obj) => {
	return (true
		&& typeof obj === "function"
		&& obj[symbol_is_map] === true
	);
};

const nil = Symbol("nil");

const cached = (func) => {
	let existing_result = nil;

	return (...args) => {
		if (existing_result === nil) {
			existing_result = func(...args);
		}

		return existing_result;
	};
};

/**
 * @stability 2 - provisional
 * 
 * A map is the uoe standard for a determinstic function.
 * 
 * A map has only one input argument, so you may like to pass in a tuple or other data type if you need more complex input.
 * 
 * A map must obey Map Enum Equivalence (MEE):
 * 
 *  - Calling a map with an enum containing data is equivalent to first calling the map with just the symbol of the enum, and subsequently calling the result with just the data of the enum. In other words `map(: :sym(input))` must be equivalent to `(: map:sym)(: input)` for all sym,input.
 * 
 * Accessing a property on a map (`map.foo`) is syntactic sugar for calling the map with the respective symbol (`map(enm.foo)`).
 * 
 * When calling a map, another map is returned. The only exception is when a map is called with `undefined`, this is the only way a final non-map result can be obtained, this is referred to as a "leaf" value.
 * 
 * If the leaf value is an api, it is implicitely executed and the result is returned instead.
 */
export const map = (get) => {
	get ??= () => {};

	let final_map;

	let get_leaf = () => unsuspended_promise((async () => {
		const result = await get(undefined);

		if (is_api(result)) {
			return await result();
		}

		return result;
	})());

	const raw_map = named_function(get.name, (input) => {
		if (input === undefined) {
			return get_leaf();
		}
		
		if (is_enum(input) && input.data !== undefined) {
			return raw_map(enm[input.sym])(input.data);
		}

		const get_output = () => Promise.resolve(get(input));

		return map((input) => {
			if (input === undefined) {
				return unsuspended_promise((async () => {
					const result = await get_output();

					if (_is_map(result)) {
						return await result();
					}

					return result;
				})());
			}

			return (async () => {
				const output = await get_output();

				if (_is_map(output)) {
					return output(input);
				}

				return undefined;
			})();
		});
	});

	final_map = new Proxy(raw_map, {
		get: (target, prop) => {
			if (prop === symbol_is_map) {
				return true;
			}

			if (prop === "then") {
				// Due to nested promise flattening, we cannot allow a map to be promise-like.
				// We must forcefully undefine the `then` property, as otherwise it would be classified as a "thenable".
				// If access to `:then` is needed, you must use the property [":then"] or call the map with `enm[":then"]`.

				return undefined;
			}

			if (["valueOf", "toString", "toLocaleString"].includes(prop)) {
				return () => "<uoe/map>";
			}

			if (["constructor", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "__proto__", Symbol.toPrimitive].includes(prop)) {
				return target[prop];
			}

			return raw_map(enm[prop]);
		},
	});

	return final_map;
};
