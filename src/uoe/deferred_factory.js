/**
 * @stability 0 - deprectaed
 * @deprecated - replace calls to `deferred_factory` with `create_unsuspended_promise`.
 * @see ./create_unsuspended_promise.js
 * 
 * Deprecated. Will be removed from repository around 2027/01/01.
 * 
 * Creates a sync factory that returns an async api which waits for an underlying factory to be resolved and then waits for an underlying api to be instantiated.
 * 
 * The returned factory will suffer from all errors not being reported. If the underlying factory reports errors, these errors will instead be delayed to invocations of the api as internal errors.
 * 
 * Example omitted because.
 */
export const deferred_factory = () => {
	const [factory, resolve_factory] = suspended_factory();
	return [unsuspended_factory(factory), resolve_factory];
};

export const deferredFactory = deferred_factory;
