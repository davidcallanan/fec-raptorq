const syntactic_sugar = (uly_map) => {
	return new Proxy(
		uly_map,
		{
			get: (_, prop) => syntactic_sugar(async (inp) => uly_map({
				type: prop,
				value: inp,
			})),
		},
	);
};

/**
 * @deprecated
 * @stability 0 - deprecated
 * 
 * `m` is for dependency on another map
 * `s` is for dependency on services (essentially everything else for the time being)
 * `l` is for local dependency on the map itself, for recursion or private methods
 * `inp` is for the input
 * 
 * Private methods should begin with an underscore for the sake of convention.
 * Private method access is not currently forbidden, because I'm too lazy right now.
 * 
 * @example
 * 
 * import { switch_enum } from "./switch_enum.js";
 * 
 * export const create_adder = create_map_factory(async ({ m, s, l, inp }) => {
 * 	 return switch_enum(inp, {
 * 	   _sum: (numbers) => {
 * 	     return numbers.reduce((a, b) => a + b, 0);
 * 	   },
 * 
 * 	   add: ([a, b]) => {
 *       _sum([a, b]);
 * 	   },
 * 	 });
 * });
 * 
 * let adder = create_adder();
 * 
 * // verbose usage:
 * await adder(enm.add([5, 6]));
 * 
 * // concise usage:
 * await adder.add([5, 6]);
 */
export const create_map_factory = (implementation) => {
	return ({ m, s } = {}) => {
		let map = syntactic_sugar(async (inp) => await implementation({ m, s, l: map, inp }));
		return map;
	};
};

export const createMapFactory = create_map_factory;

