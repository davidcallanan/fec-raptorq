import { enm } from "./enm.js";

/**
 * Tries to await a promise and resolves with `:ok(value)` if the promise resolved or `:err(error)` if the promise rejected.
 */
export const try_await = async (promise) => {
	try {
		return enm.ok(await promise);
	} catch (e) {
		return enm.err(e);
	}
};

export const tryAwait = try_await;
