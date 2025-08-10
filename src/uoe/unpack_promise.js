/**
 * @stability 4 - locked
 * 
 * Obtains and splits a promise into its individual `then`, `catch`, and `finally` components, already bound and ready to be destructured.
 * 
 * The given object is forced to be a promise using `Promise.resolve`.
 * 
 * @example
 * 
 * const { then, catch, finally } = unpack_promise(Promise.resolve(27));
 * 
 * then(console.log); // 27
 */
export const unpack_promise = (thenable) => {
	const promise = Promise.resolve(thenable);
	
	return {
		then: promise.then.bind(promise),
		catch: promise.catch.bind(promise),
		finally: promise.finally.bind(promise),
	};
};

export const unpackPromise = unpack_promise;
