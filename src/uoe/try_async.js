/**
 * Tries to run an async function and resolves with `:ok(value)` if the function resolved or `:err(error)` if the function rejected.
 */
export const try_async = async (func) => {
	try {
		return enm.ok(await func());
	} catch (e) {
		return enm.err(e);
	}
};

export const tryAsync = try_async;
