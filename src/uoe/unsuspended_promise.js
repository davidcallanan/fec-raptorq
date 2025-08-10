import { bind_callable } from "./bind_callable.js";

const unsuspended_promise_ = (promise_like, ctx) => {
	// Note: In this code we manually use `String` as some objects, such as Symbols, do not convert implicitely to strings, even within template literals.
	// The use of `toString` is avoided in favour of `String`, a less error-prone alternative.

	const promise = Promise.resolve(promise_like);

	return new Proxy((...args) => {
		return unsuspended_promise_((async () => {
			const api = await promise;

			if (typeof api !== "function") {
				if (ctx?.$$$_READING) {
					throw new TypeError(`${api} is not a function (reading '${ctx.$$$_READING.toString()}')`);
				}
				
				throw new TypeError(`${api} is not a function`);
			}

			return await Reflect.apply(api, api, args);
		})(), {
			$$$_READING: ctx?.$$$_READING ? `${ctx.$$$_READING}()` : "()",
		});
	}, {
		get: (target, prop) => {
			if (["then", "catch", "finally"].includes(prop)) {
				return promise[prop].bind(promise);
			}

			if (["valueOf", "toString", "toLocaleString"].includes(prop)) {
				return () => "<uoe/unsuspended_promise>";
			}

			if (["constructor", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "__proto__", Symbol.toPrimitive].includes(prop)) {
				return target[prop];
			}

			return unsuspended_promise_((async () => {
				const api = await promise;

				if (false
					// Motivation: In mirroring JavaScript's property access,
					// we claim that `null` and `undefined` are the only two
					// cases where property access results in a TypeError
					// being thrown.
					|| api === null
					|| api === undefined
				) {
					if (ctx?.$$$_READING) {
						throw new TypeError(`Cannot read properties of ${String(api)} (reading '${String(ctx.$$$_READING)}.${String(prop)}')`);
					}

					throw new TypeError(`Cannot read properties of ${String(api)} (reading '${String(prop)}')`);
				}

				if (typeof api[prop] === "function") {
					return bind_callable(api[prop], api);
				}

				return api[prop];
			})(), {
				$$$_READING: ctx?.$$$_READING ? `${String(ctx.$$$_READING)}.${String(prop)}` : prop,
			});
		},
	});
};

/**
 * @stability 3 - stable
 * 
 * An almost drop-in replacement for promises. Takes in a promise-like or non-promise value and returns a glorified promise. Analogous to `Promise.resolve`. 
 * 
 * Unsuspended promises incorporate an unsuspension mechanism. 
 * 
 * Wraps an api or promise to an api such that the api is immediately available. Properties and methods, including sub-properties of the api and sub-properties of the return-values of methods, are proxied to be immediately accessible before the api has neccesserily been resolved, and before parent properties and return-values of parent methods have been resolved. However, this means that the properties and methods are forced to be async.
 * 
 * Upon access of a property or invocation of the wrapped api, it will first wait for the underlying api to be resolved before proceeding.
 * 
 * If errors are reported by the passed-in promise, these errors will instead be delivered as internal errors inside any promises obtained from the wrapped api.
 * 
 * Warning: The `then`, `catch` and `finally` properties must not be defined on the underlying api as this makes the underlying api promise-like, while also conflicting with our implementation of the promise interface at every level.
 * Doing this will cause bizarre behaviour which may be difficult to track down.
 * 
 * @example
 * 
 * const api = unsuspended_promise(api_promise);
 * 
 * // The following two lines of code are equivalent
 * await api;
 * await api_promise;
 * 
 * // The following two lines of code are equivalent
 * await api();
 * await (await api_promise)();
 * 
 * // The following two lines of code are equivalent
 * await api.property;
 * await (await api_promise).property;
 * 
 * // The following three lines of code are equivalent
 * await api.method();
 * await unsuspended_promise(await api.method)();
 * await (await (await api_promise).method)();
 * 
 * // The following four lines of code are equivalent
 * await api.method().property;
 * await unsuspended_promise(await api.method()).property;
 * await unsuspended_promise(await api.method()).property;
 * await unsuspended_promise(unsuspended_promise(await api.method)()).property;
 * await (await (await (await api_promise).method)()).property;
 * 
 * // As you can see, unsuspending an api removes a lot of await statements.
 * // This offers a high degree of flexibility when working with asynchronous code.
 * 
 * @example
 * 
 * const create_opengl_api = async () => {
 *   const gl = await init_opengl();
 *   
 *   return {
 *     draw_triangle: async () => {
 *       await gl.draw_three_lines();
 *     },
 *   };
 * };
 * 
 * const opengl_api = unsuspended_promise(create_opengl_api());
 * await opengl_api.draw_triangle();
 * console.log("triangle drawn");
 */
export const unsuspended_promise = (api_promise_like) => {
	return unsuspended_promise_(api_promise_like);
};

export const unsuspendedPromise = unsuspended_promise;
