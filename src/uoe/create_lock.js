import { create_promise } from "./create_promise.js";
import { call_as_async } from "./call_as_async.js";
import { create_sync_factory } from "./create_sync_factory.js";

const LOCK_ERROR_MSG = `Developer Alert [Critical]
A lock is permanently locked due to an exception.
There is no exposed process in place to detect this incident.
A safety invariant would be broken if this lock were automatically released.
If this is a routine error, the developer should have instead processed the error in a non-disruptive manner.`;

class Lock {
	_init() {
		this._is_locked = false;
		this._outstanding_promises = [];
	}
	
	_next_outstanding() {
		(async () => {
			if (this._outstanding_promises.length > 0) {
				const resolve = this._outstanding_promises.shift();
				resolve();
			} else {
				this._is_locked = false;
			}
		})();
	}

	async acquire(callback) {
		const [when_should_proceed, res] = create_promise();
		
		if (!this._is_locked) {
			this._is_locked = true;
			res();
		} else {
			this._outstanding_promises.push(res);		
		}
		
		await when_should_proceed;

		try {
			var result = await call_as_async(callback);
		} catch (e) {
			console.error(LOCK_ERROR_MSG);
			throw e;
		}

		this._next_outstanding();

		return result;
	}

	async acquire_immediately(callback) {
		if (this._is_locked) {
			return {
				was_acquired: false,
				result: undefined,	
			};
		} else {
			this._is_locked = true;
			
			const [result, res_result, rej_result] = create_promise();

			call_as_async(callback).then((result) => {
				res_result(result);
				this._next_outstanding();
			}).catch((e) => {
				console.error(LOCK_ERROR_MSG);
				throw e;
			});

			return {
				was_acquired: true,
				result,
			};
		}
	}
	
	acquireImmediately(...args) {
		return this.acquire_immediately(...args);
	}
}

/**
 * @stability 2 - provisional
 * 
 * Creates a simple lock object with two methods, `acquire` and `acquire_immediately`.
 * 
 * The `acquire` method takes a callback and returns the callback's return value.
 * 
 * The `acquire_immediately` method will try to acquire the lock immediately, returning an object with both `.was_acquired` immediate and `.result` promise.
 * 
 * This implementation is prone to deadlocks across multiple locks.
 * 
 * See the monolithic `create_multi_lock` as a potential mitigation to deadlocks.
 */
export const create_lock = create_sync_factory(Lock);
export const createLock = create_lock;
