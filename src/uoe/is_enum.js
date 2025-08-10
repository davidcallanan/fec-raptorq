import { error_user_payload } from "./error_user_payload.js";
import { throw_error } from "./throw_error.js";

/**
 * @stability 2 - provisional
 * 
 * Checks if an object is a uoe-enum instance.
 * 
 * See `enm` for constructing an enum instance.
 */
export const is_enum = (obj, sym) => {
	if (sym === undefined) {
		return typeof obj?.sym === "string";
	}
	
	if (is_enum(sym)) {
		return is_enum(obj, sym.sym);
	}
	
	if (typeof sym !== "string") {
		throw_error(error_user_payload("`sym` must be string"));
	}
	
	return obj?.sym === sym;
};

export const isEnum = is_enum;
