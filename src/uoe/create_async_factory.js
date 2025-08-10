import { as_async } from "./as_async.js";
import { bind_callable } from "./bind_callable.js";
import { bind_self } from "./bind_self.js";
import { callable } from "./callable.js";
import { named_function } from "./named_function.js";

/**
 * @stability 2 - provisional
 * 
 * Creates an async factory for a class such that its `_init` method is called and awaited before the instantiated object is returned.
 * 
 * @example
 * 
 * class Api {
 *   constructor(foo, bar) { ... }
 * 
 *   async _init() {
 *     await some_initialization_logic();
 *   }
 * 
 *   ...
 * }
 * 
 * export const create_api = create_async_factory(Api);
 */
export const create_async_factory = (cls) => {
	if (cls.prototype._call !== undefined) {
		// This makes debugging nicer because the original object will be a function and so it will not wrapped by a function down the road (which is otherwise accomplished in `callable` using proxies).

		const orig_cls = cls;
		
		cls = named_function(orig_cls.name, function (...args) {
			const obj = new orig_cls(...args);
			const result = new Function();
			Object.setPrototypeOf(result, cls.prototype);
			Object.assign(result, obj);
			return result;
		});

		orig_cls.prototype.constructor = cls;
		cls.prototype = orig_cls.prototype;
		Object.setPrototypeOf(cls.prototype, Function.prototype);
	}

	return async (...args) => {
		const obj = new cls(...args);
		obj._init && await obj._init(...args);

		const adjusted_obj = obj._call !== undefined
			? callable(
				obj,
				as_async(function(...args) { return obj._call(...args) })
			)
			: obj
		;

		const result = new Proxy(adjusted_obj, {
			get(target, key) {
				if (typeof target[key] === "function") {
					return bind_callable(target[key], target);
				}

				return target[key];
			},
		});
		
		return typeof result === "function" ? bind_self(result) : result;
	};
};

export const createAsyncFactory = create_async_factory;
