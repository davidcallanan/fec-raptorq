class SubstitutablePromise {
	constructor(initial_promise) {
		this._promise = initial_promise ?? new Promise(() => {});
	}

	substitute(promise) {
		this._promise = promise;
	}

	_exposed() {
		let promise = Promise.resolve(this._promise);

		return promise.then(result => {
			if (this._promise !== promise) {
				return this._exposed();
			}

			this._is_settled = true;

			return result;
		}).catch(err => {
			if (this._promise !== promise) {
				return this._exposed();
			}

			this._is_settled = true;

			return err;
		});
	}

	exposed() {
		if (this._existing_exposed === undefined) {
			this._existing_exposed = this._exposed();
		}

		return this._existing_exposed;
	}

	is_settled() {
		return this._is_settled === true;
	}
}

/**
 * @stability 2 - provisional
 * 
 * Creates a special promise that can be substituted with another promise.
 * 
 * The `exposed` method returns a promise that resolves to the currently substituted promise.
 * 
 * The `substitute` method takes in a new promise which is used for resolution, provided the `exposed` promise has not already resolved.
 * 
 * The `is_settled` method indicates whether the promise has been settled.
 */
export const create_substitutable_promise = (initial_promise) => new SubstitutablePromise(initial_promise);
export const createSubstitutablePromise = create_substitutable_promise;
