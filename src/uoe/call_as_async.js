/**
 * @stability 4 - locked
 * 
 * Calls a function that may or may not be async with guaranteed async behaviour.
 * This is useful when invoking an externally-provided function that may not be async.
 * It ensures that any errors originating in the provided function are incorporated into the promise as opposed to the current execution flow.
 */
export const call_as_async = async (possibly_async_func) => {
	return await possibly_async_func();
};

export const callAsAsync = call_as_async;
