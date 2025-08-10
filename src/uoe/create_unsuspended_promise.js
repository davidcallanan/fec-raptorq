import { create_promise } from "./create_promise";
import { unsuspended_promise } from "./unsuspended_promise.js";

/**
 * @stability 2 - provisional
 * 
 * Equivalent to `create_promise` but uses an `unsuspended_promise` instead of a regular promise.
 */
export const create_unsuspended_promise = () => {
	const [promise, res, rej] = create_promise();
	return [unsuspended_promise(promise), res, rej];
};
