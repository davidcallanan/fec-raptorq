import { user_error } from "./error.js";
import { unsuspended_factory } from "./unsuspended_factory.js";
import { internal_error } from "./error.js";

/**
 * @deprecated
 * @stability 0 - deprecated
 */
export const create_func_factory = (cls) => {
	return unsuspended_factory(async (...args) => {
		const obj = new cls(...args);
		obj._init && await obj._init();

		const origin = Symbol("origin");

		cls._user_error = (message, cause) => {
			const error = user_error(message, cause);
			error._origin = origin;
		};

		const keys = Object.keys(obj).filter(key => typeof obj[key] === "function" && !key.startsWith("_"));

		if (keys.length !== 1) {
			throw new Error(`Expected exactly one public method in a determinstic interface, but got ${keys.length}.`);
		}

		for (let key of Object.keys(obj)) {
			if (key.startsWith("_")) {
				continue;
			}

			if (typeof obj[key] === "function") {
				obj[key] = obj[key].bind(obj);
			}
		}

		const func = obj[keys[0]];

		return async (...args) => {
			let result;

			try {
				result = await func(...args);
			} catch (e) {
				if (e._origin === origin || e.name === "InternalError") {
					throw e;
				} else {
					throw internal_error("Uncaught error", e);
				}
			}

			return result;
		};
	});
};

export const createFuncFactory = create_func_factory;
