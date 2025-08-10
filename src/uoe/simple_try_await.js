/**
 * Tries to await a promise and resolves with an object containing either a value if the promise resolved or an error if the promise rejected.
 */
export const simple_try_await = async (promise) => {
	try {
		return { value: await promise };
	} catch (e) {
		return { error: e };
	}
};

export const simpleTryAwait = simple_try_await;
