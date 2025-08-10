import { create_promise } from "./create_promise.js";
import { call_as_async } from "./call_as_async.js";
import { create_sync_factory } from "./create_sync_factory.js";
import { iter_take } from "./iter_take.js";

const LOCK_ERROR_MSG = `Developer Alert [Critical]
A lock is permanently locked due to an exception.
There is no exposed process in place to detect this incident.
A safety invariant would be broken if this lock were automatically released.
If this is a routine error, the developer should have instead processed the error in a non-disruptive manner.`;

const max_concurrency = 64;

class MultiLock {
    _init() {
        this._locks = new Map();
        this._queue = new Set();
    }
	
    _process_queue() {
		const cumulative_scopes = new Set();

		for (const request of iter_take(this._queue, max_concurrency)) {
			const { scopes, res } = request;
			let should_res = false;

            if (this._can_acquire(scopes, cumulative_scopes)) {
                this._lock_scopes(scopes);
				this._queue.delete(request);
				should_res = true;
			}

			for (const scope of scopes) {
				cumulative_scopes.add(scope);
			}

			should_res && res();
        }
    }

    _can_acquire(scopes, cumulative_scopes) {
		return scopes.every((scope) =>
			!this._locks.has(scope) && !cumulative_scopes.has(scope)
		);
    }

    _lock_scopes(scopes) {
        for (const scope of scopes) {
            this._locks.set(scope, true);
        }
    }

    _unlock_scopes(scopes) {
        for (const scope of scopes) {
            this._locks.delete(scope);
        }

        this._process_queue();
    }

    create_scope() {
        return Symbol("[multi_lock].scope");
    }

    async acquire(scopes, callback) {
        const [promise, res] = create_promise();

        const request = {
            scopes,
            res,
        };

        this._queue.add(request);
        
		this._process_queue();

        await promise;

		try {
			var result = await call_as_async(callback);
		} catch(e) {
			console.error(LOCK_ERROR_MSG);
			throw e;
		}

		this._unlock_scopes(scopes);

		return result;
    }
}

/**
 * @stability 1 - experimental
 * 
 * Creates a monolithic multi-lock where granular scopes can be acquired to increase throughput.
 * 
 * A single multi-lock is not prone to deadlocks as all scopes are acquired and released in a single atomic operation.
 * 
 * Overlapping acquisitions are performed sequentially to prevent starvation of older requests.
 * 
 * Invoke `create_scope` to create a new scope.
 * 
 * Pass an array of scopes alongside a callback to `acquire` to make an acquisition request.
 */
export const create_multi_lock = create_sync_factory(MultiLock);
