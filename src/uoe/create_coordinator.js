import { create_lock } from "./create_lock.js";
import { create_promise } from "./create_promise.js";
import { create_unsuspended_factory } from "./create_unsuspended_factory.js";

const apply = (map, scope) => {
	scope.forEach((entry) => {
		if (map.has(entry)) {
			map.set(entry, map.get(entry) + 1);
		} else {
			map.set(entry, 1);
		}
	});
};

const unapply = (map, scope) => {
	scope.forEach((entry) => {
		const curr = map.get(entry);
		
		if (curr === 1) {
			map.delete(entry);
		} else {
			map.set(entry, curr - 1);
		}
	});
};

const safe_to_run = (map, scope) => {
	return scope.every(entry => !map.has(entry));
};

class Coordinator {
	_init() {
		this._tx_queue = [];
		this._scopes_queued = new Map();
		this._scopes_ongoing = new Map();
	}

	async _run_now(scope, callback, resolve) {
		apply(this._scopes_ongoing, scope);
		
		try {
			await callback()
		} catch (e) {
			console.error("An exception has raised doubt on the safety of releasing a lock. To ensure locks are released, the developer must take full responsiblity in handling exceptions.");
			throw e;
		}
		
		unapply(this._scopes_queued, scope);
		unapply(this._scopes_ongoing, scope);
		resolve();
		this._run_next_transactions();
	}
	
	async _run_next_transactions() {
		const scopes_queued = new Map();
		
		for (let i = 0; i < Math.min(this._tx_queue.length, 16); i++) {
			const { scope, callback, resolve } = this._tx_queue[i];
			
			if (true
				&& safe_to_run(scopes_queued, scope)
				&& safe_to_run(this._scopes_ongoing, scope)
			) {
				this._tx_queue.splice(i--, 1);
				this._run_now(scope, callback, resolve);
			}
			
			apply(scopes_queued, scope);
		}
	}
	
	async run_transaction(scope, callback) {
		const [promise, resolve, _reject] = create_promise();
		
		const should_run_now = safe_to_run(this._scopes_queued, scope);
		apply(this._scopes_queued, scope);
		
		if (should_run_now) {
			this._run_now(scope, callback, resolve);
		} else {
			this._tx_queue.push({ scope, callback, resolve });
		}
		
		return await promise;
	}
}

/**
 * @stability 1 - experimental
 * 
 * This is a very basic coordinator that hasn't been well-optimized. It remains an exercise for future me.
 */
export const create_coordinator = create_unsuspended_factory(Coordinator);
