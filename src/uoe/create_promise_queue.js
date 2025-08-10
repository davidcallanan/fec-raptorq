class PromiseQueue {
    constructor() {
        this._queue = [];
    }

    add(promise) {
        this._queue.push(promise);
    }

	_all(results) {
        let all = Promise.all(this._queue);
        this._queue = [];

        return all.then((new_results) => {
            results.push(...new_results);

            if (this._queue.length > 0) {
                return this._all(results);
            }

            return results;
        });
    }

	all() {
		if (this._existing_all === undefined) {
			this._existing_all = this._all([]);
		}

		return this._existing_all;
    }
}

/**
 * @stability 2 - provisional
 * 
 * Allows you to await a bunch of promises while adding additional promises to the queue which are subsequently awaited too.
 * 
 * The `add` method takes in a promise and adds this promise to the queue.
 * 
 * The `all` method returns a promise that resolves when all promises in the queue have resolved.
 * 
 * At the time `all` is first called, all `all` calls will resolve at any point that all promises in the queue are in the resolved state.
 * 
 * Adding promises to the queue after resolution is equivalent to starting fresh with a new promise queue, the existing promises are swept from the queue after resolution.
 */
export const create_promise_queue = () => new PromiseQueue();
export const createPromiseQueue = create_promise_queue;
