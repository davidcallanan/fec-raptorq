/**
 * @deprecated - Scheduled for removal January 2027.
 * @stability 0 - deprecated
 * 
 * @see user_error.js
 * @see state_error.js
 * @see internal_error.js
 */

// In my opinion there are only three fundamental categories of errors.
// Different categories of errors can be reported depending on the interface contract's policies.
// I'm sure this system is not yet perfect but I'm getting there.
// It will probably be adjusted gradually over time.

/**
 * A user error is an error caused by the programmer.
 * 
 * There are two types of user errors:
 *   - Providing illegal input to the interface, that is, providing input that's never accepted and is considered malformed regardless of the current state.
 *   - In the case where the interface user has sole ownership of the state: Providing input to the interface that is invalid in the current state.
 * 
 * Many interface contracts may not report user errors and instead choose the route of undefined behaviour with a potentially poisonous outcome. Check the policy of a specific interface for confirmation.
 * 
 * A perfect type system would remove the need for user errors to ever be reported at runtime and instead be caught at compile-time.
 * 
 * @example
 * 
 * const sqrt = (x) => {
 *   if (x < 0) {
 *     throw user_error("x must be non-negative");
 *   }
 * 
 *   return Math.sqrt(x);
 * };
 */
export const user_error = (message, cause) => {
	let err = new Error(message, { ...cause && { cause } });
	err.name = "UserError";
	return err;
};

export const userError = user_error;

/**
 * In the case of a stateful interface where the interface user does not have sole ownership of the state (i.e. the state is affected by external factors), a state error is an error caused by the current state of the system at the precise instant when the request was processed.
 * 
 * If, and only if, the interface user does in fact have sole ownership of the state, a user error should be used instead.
 * 
 * @example
 * 
 * const create_counter = (max) => {
 *   let count = 0;
 * 
 *   const increment = () => {
 *     if (count >= max) {
 *       throw state_error("current count must be less than max");
 *     }
 *   };
 * 
 *   return increment;
 * };
 * 
 * const increment = create_counter(1);
 * // simulating two users having shared simultaneous access to the counter
 * const a = { increment };
 * const b = { increment };
 * a.increment(); // ok
 * b.increment(); // throws state error
 */
export const state_error = (type, message, cause) => {
	let err = new Error(message, { ...cause && { cause } });
	err.name = "StateError";
	err.type = type;
	return err;
};

export const stateError = state_error;

/**
 * An internal error is an error caused by implementation details of the interface which prevented the interface from fulfilling its contractual obligations and is thus forced to break the regular flow of the program.
 * 
 * Many interface contracts may opt for undefined behaviour instead of detecting and reporting these errors. Check the policy of a specific interface for confirmation. Even then, a contract's affirmative policy to report these errors is still limited to the impossible assumption that the logical machine (e.g. CPU) is not susceptible to any faults that could cause a glitch in the outcome.
 * 
 * If a stateful interface reports an internal error, it is assumed that the exposed interface is damaged. It is then a violation for the interface not to report internal errors on all further function calls. If a repair mechanism is in place, this can either be achieved:
 *   1. internally, by haulting execution instead of reporting an internal error, and then repairing the damage before resuming execution;
 *   2. externally, by exposing an additional interface for rebuilding a new fresh interface that is not marked as damaged, once the fault has been repaired;
 *   3. by considering certain internal defects as part of the exposed state, and converting these errors to state errors.
 * 
 * This can be a complex decision to make.
 * 
 * Example omitted because why not.
 */
export const internal_error = (message, cause) => {
	let err = new Error(message, { ...cause && { cause } });
	err.name = "InternalError";
	return err;
};

export const internalError = internal_error;
