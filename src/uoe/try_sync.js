import { enm } from "./enum.js";

/**
 * Tries to run a function and returns `:ok(value)` if the function completed or `:err(error)` if the function threw.
 */
export const try_sync = (func) => {
	try {
		return enm.ok(func());
	} catch (e) {
		return enm.err(e);
	}
}

export const trySync = try_sync;
