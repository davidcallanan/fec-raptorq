import { create_lock } from "./create_lock.js";
import { create_unsuspended_factory } from "./create_unsuspended_factory.js";

let next_variable_id = 0;

class Variable {
	_init({ query, mutate }) {
		this._scope = Symbol(`scope:variable:${next_variable_id}`);
		this._query = query;
		this._mutate = mutate;
		this._lock = create_lock();
	}
	
	_force_into(target) {
		target._query = this._query;
		target._mutate = this._mutate;
	}
	
	man$force_swap(target) {
		return this._lock.acquire(async () => {
			await target._force_into(this);
		});
	}
	
	get_scope() {
		return this._scope;
	}
	
	solo() {
		return create_variable({
			query: this._query,
			mutate: this._mutate,
		});
	}
	
	query(query) {
		return this._query(query);
	}
	
	mutate(mutation) {
		return this._lock.acquire(async () => {
			const { query, mutate } = await this._mutate(mutation);
			this._query = query;
			this._mutate = mutate;
		});
	}
}

/**
 * @stability 1 - experimental
 */
export const create_variable = create_unsuspended_factory(Variable);
export const createVariable = create_variable;
