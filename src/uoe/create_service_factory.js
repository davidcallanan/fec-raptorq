import { create_async_factory } from "./create_async_factory.js";
import { unsuspended_factory } from "./unsuspended_factory.js";

/**
 * @deprecated
 * @stability 0 - deprecated
 */
export const create_service_factory = (cls) => {
	return unsuspended_factory(async (...args) => {
		const obj = new cls(...args);
		obj._init && await obj._init();

		const origin = Symbol("origin");

		cls._user_error = (message, cause) => {
			const error = user_error(message, cause);
			error._origin = origin;
		};

		for (let key of Object.keys(obj)) {
			if (key.startsWith("_")) {
				continue;
			}

			if (typeof obj[key] === "function") {
				obj[key] = obj[key].bind(obj);
			}
		}

		return obj;
	});
};

export const createServiceFactory = create_service_factory;
