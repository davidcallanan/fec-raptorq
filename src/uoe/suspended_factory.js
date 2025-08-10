import { suspended_api } from "./suspended_api.js";

/**
 * Creates an async factory that awaits access to an underlying factory that can be resolved at a later time.
 */
 export const suspended_factory = () => {
	const [factory_promise, resolve_factory] = suspended_api();

	const factory = async (...args) => {
		const factory = await factory_promise;
		return await factory(...args);
	};

	return [factory, resolve_factory];
};

export const suspendedFactory = suspended_factory;
