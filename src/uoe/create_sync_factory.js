import { bind_callable } from "./bind_callable.js";
import { bind_self } from "./bind_self.js";
import { callable } from "./callable.js";
import { named_function } from "./named_function.js";

/**
 * @stability 1 - experimental
 * 
 * Creates an synchronous factory for a class.
 */
export const create_sync_factory = (cls) => {
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

	return (...args) => {
		const obj = new cls(...args);
		obj._init && obj._init(...args);

		const adjusted_obj = obj._call !== undefined
			? callable(
				obj,
				function(...args) { return obj._call(...args) }
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

export const createSyncFactory = create_sync_factory;
