import { suspended_api } from "./suspended_api.js";
import { unsuspended_promise } from "./unsuspended_promise.js";

/**
 * @stability 2 - provisional
 * 
 * Creates an async api that can be invoked immediately but where the underlying api can be resolved at a later time.
 * 
 * This allows you to defer the initialization of an api until it is an appropriate time to do so, for example, until certain parameters or services are available that this api requires.
 * 
 * Upon invokation of any method, it will first wait for the underlying api to be provided before proceeding.
 * 
 * See `suspended_api` and `unsuspended_promise`.
 * 
 * @example
 * 
 * // SomeUiComponent.js
 * 
 * const [fetch, resolve_fetch] = deferred_api();
 * console.log(await fetch("https://example.com"));
 * 
 * // we only want to fetch client-side
 * on_component_mount_clientside(() => {
 *   resolve_fetch(window.fetch);
 * });
 */
export const deferred_api = (async_factory) => {
	const [api_promise, resolve_api] = unsuspended_promise();
	const api = unsuspended_promise(api_promise);
	
	if (async_factory !== undefined) {
		async_factory().then(resolve_api);
		return api;
	}

	return [api, resolve_api];
};

export const deferredApi = deferred_api;
