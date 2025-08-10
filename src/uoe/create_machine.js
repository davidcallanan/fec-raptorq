import { create_sync_factory } from "./create_sync_factory.js";
import { throw_error } from "./throw_error.js";
import { user_payload_error } from "./user_payload_error.js";

const ACCEPT = Symbol("ACCEPT");
const REJECT = Symbol("REJECT");

class Machine {
	constructor(initial_state, reduce) {
		this.state = initial_state;
		this._reduce = reduce;
	}

	async apply(payload) {
		const result = await this._reduce({
			accept: (state) => ([ACCEPT, state]),
			reject: () => ([REJECT]),
		}, state, payload);

		if (false
			|| !Array.isArray(result)
			|| result.length === 0
		) {
			throw_error(user_payload_error("Reducer must return system.accept or system.reject"));
		}

		if (result[0] === REJECT) {
			return ["reject", this];
		}

		if (result[0] === ACCEPT) {
			return ["accept", create_machine(result[1], this._reduce)];
		}

		throw_error(user_payload_error("Reducer must return system.accept or system.reject"));
	}
}

/**
 * @stability 1 - experimental
 * 
 * Creates an immutable state machine.
 * 
 * To create a live instance, see `TODO:create_source`.
 * 
 * TODO: use uoe enums.
 */
export const create_machine = create_sync_factory(Machine);
export const createMachine = create_machine;
