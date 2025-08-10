/**
 * Creates a derivative from an asynchronous computation.
 * 
 * An update to the derivative is postponed until the promise is settled, and the resulting value or error is then used. In the meantime, the value of the derivative will be the previously computed value, or undefined when first created.
 * 
 * If any dependencies change before an outstanding promise settles, the outstanding promise will be ignored and the new promise will be used.
 * 
 * @example
 * 
 * let value = createSignal("example");
 * 
 * let hashedValue = createEventual({ createSignal, createEffect }, async () => {
 *   let hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value()));
 *   return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
 * });
 * 
 * createEffect(() => console.log(hashedValue()));
 * 
 * @description
 * 
 * It is necessary to access dependencies immediately at the start of the function (in the same microtask) to ensure future changes to that dependency are detected.
 * For example, the derivative in the example below will never be updated when the dependency changes.
 * Alternatively, consider using `createEventual(createDynamic(async () => ...))`.
 * 
 * @example
 * 
 * let value = createSignal(0);
 * 
 * let double = createEventual({ createSignal, createEffect }, async () => {
 *   await "nothing";
 *   return 2 * value();
 * });
 * 
 * createEffect(() => console.log(double())); // this effect will only ever run once
 */
export const create_eventual = (deps, async_func) => {
	deps.create_signal ??= deps.createSignal;
	deps.create_effect ??= deps.createEffect;

	let [derivative, set_derivative] = deps.create_signal();
	let outstanding_promise;

	deps.create_effect(() => {
		let promise = (async () => await async_func())();
		outstanding_promise = promise;

		promise.then((result) => {
			if (promise !== outstanding_promise) {
				return;
			}

			set_derivative(result);
		});

		promise.catch((error) => {
			if (promise !== outstanding_promise) {
				return;
			}

			set_derivative(error);
		});
	});

	return derivative;
};

export const createEventual = create_eventual;
