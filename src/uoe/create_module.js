import { as_async } from "./as_async.js";
import { empty_map } from "./empty_map.js";
import { is_map } from "./is_map.js";
import { pattern_map } from "./pattern_map.js";

/**
 * @stability 1 - experimental
 * 
 * Creates a module which is an intermediate organizational tool for building a map.
 * 
 * It handles:
 * 
 * 1. Initialization
 * 2. Environment (dependency) capturing
 * 3. Self-referencing
 * 4. Segregating implementation into chunks, for the purpose of allowing the developer to split the implementation across files.
 * 5. Obtaining a final map factory for export.
 * 
 * Takes in an optional async initialization function, which takes in the environment (a map) provided by the developer when they invoke the map factory, and returns an updated environment which is passed to your implementation, allowing for any needed initialization logic.
 * 
 * @example
 * 
 * // mod.ts
 * 
 * import function_a from "./function_a.js";
 * import function_b from "./function_b.js";
 * 
 * const module = create_module(async (env) => {
 *   // initialization logic here
 * });
 * 
 * module.impl(function_a);
 * module.impl(function_b);
 * 
 * export default module.create_map_factory();
 * 
 * // function_a.js
 * 
 * export default (env) => [
 *   ["function_a", "banana"],
 * ];
 * 
 * // function_b.js
 * 
 * export default (env) => [
 *   ["function_b", "octopus"],
 * ];
 * 
 * // main.ts
 * 
 * import create_map from "./mod.js";
 * 
 * const map = create_map();
 * 
 * await map.function_a(); // "banana"
 * await map.function_b(); // "octopus"
 */
export const create_module = (init) => {
	const init_async = as_async(init ?? (() => {}));
	const impl_chunks = [];

	return {
		impl: (callback) => {
			impl_chunks.push(callback);
		},
		create_map_factory: () => {
			return (env) => obtain_map((async () => {
				env ??= empty_map;

				if (!is_map(env)) {
					throw TypeError("`env` must be a map.");
				}

				env = await init_async(env) ?? env;

				if (!is_map(env)) {
					throw TypeError("`env` must be a map.");
				}

				const processed = [...impl_chunks.map(impl_chunk => impl_chunk(env))];
				return pattern_map(processed);
			})());
		},
	};
};

export const createModule = create_module;
