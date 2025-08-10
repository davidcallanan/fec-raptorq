/**
 * Switches over a uoe-enum instance using the provided cases.
 * 
 * Must be exhaustive, an error is thrown if an unspecified case is encountered.
 * 
 * @example
 * 
 * const state = enm.partially_eligible({ reason: "too young" });
 * 
 * console.log(switch_enum(state, {
 *   eligible: () => "awesome",
 *   partially_eligible: (info) => `decent but ${info.reason}`,
 *   ineligible: () => "unfortunate",
 * }));
 */
export const switch_enum = (object, cases) => {
	if (cases[object.sym] === undefined) {
		console.warn("No case for", object);
		throw new Error(`No implementation found for \`${object.sym}\``);
	}

	return cases[object.sym](object.data);
};

export const switchEnum = switch_enum;
