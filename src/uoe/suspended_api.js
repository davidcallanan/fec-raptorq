import { create_promise } from "./create_promise";

/**
 * Creates a promise to an api that can be resolved at a later time.
 */
export const suspended_api = () => {
	const [api_promise, resolve_api, _reject] = create_promise();
	return [api_promise, resolve_api];
};

export const suspendedApi = suspended_api;
