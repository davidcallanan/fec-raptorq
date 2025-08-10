/**
 * Tries to run an async function and resolves with an object containing either a value if the function resolved or an error if the function rejected.
 */
export const simple_try_async = async (func) => {
	try {
		return { value: await func() };
	} catch (e) {
		return { error: e };
	}
};

export const simpleTryAsync = simple_try_async;
