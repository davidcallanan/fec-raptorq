import { error_user_payload } from "./error_user_payload.js";
import { throw_error } from "./throw_error.js";

/**
 * @stability 2 - provisional
 * 
 * Aside - why does JavaScript not have an inbuilt function for this?
 */
export const compare_bytes = (a, b) => {
	if (false
		|| !(a instanceof Uint8Array)
		|| !(b instanceof Uint8Array)
	) {
		throw_error(error_user_payload("inputs must be uint8array"));
	}

	if (a.length !== b.length) {
		return false;
	}

	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}

	return true;
};

export const compareBytes = compare_bytes;
