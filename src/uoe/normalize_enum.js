import { enm } from "./enm.js";

/**
 * Normalizes an enum such that a bare string is converted to an enum using that string as the symbol.
 * 
 * @example
 * 
 * // The following three lines of code are equivalent:
 * normalize_enum(enm.foo);
 * normalize_enum(enm["foo"]);
 * normalize_enum("foo");
 */

export const normalize_enum = (enum_object) => {
	if (typeof enum_object === "string") {
		const enum_type = enum_object;
		return enm[enum_type];
	}

	return enum_object;
};

export const normalizeEnum = normalize_enum;
