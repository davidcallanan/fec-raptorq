import { build_obj_mut } from "./build_obj_mut.js";
import { named_function } from "./named_function.js";

const context_id_prefix = `__$$_context_id_`;
const context_id_suffix = `_$$__`;
const context_id_regex = new RegExp(`${context_id_prefix}([0-9]+)${context_id_suffix}`);

let next_context_id = 0;

/**
 * @stability 0 - deprecated
 * @deprecated As native async context is in development, this feature is halted.
 * 
 * Requires V8 and async stack traces feature. Credit to @WolverinDEV.
 * 
 * @see https://stackoverflow.com/a/75449704/1541397
 * 
 * @example
 * 
 * const ctx = create_context();
 * 
 * console.log(ctx.with("foo", () => {
 *   return ctx() + ctx();
 * })); // "foofoo"
 * 
 * console.log(await ctx.with("bar", async () => {
 *   await timeout(1000);
 *   return ctx() + ctx();
 * })); // "barbar"
 */
export const create_context = () => {
	const values = new Map();

	return build_obj_mut(named_function("read", () => {
		const stack = new Error().stack.split("\n");

		for (const frame of stack) {
			const match = frame.match(context_id_regex);

			if (!match) {
				continue;
			}

			const context_id = parseInt(match[1]);

			if (isNaN(context_id)) {
				console.warn(`Illegal context id: ${match[1]}`);
				continue;
			}

			return values.get(context_id);
		}

		return undefined;
	}), {
		with: (value, func) => {
			const context_id = next_context_id++;
			values.set(context_id, value);
			const wrapper = named_function(`${func.name}${context_id_prefix}${context_id}${context_id_suffix}`, func);
			const result = wrapper.call(this);
			Promise.resolve(result).finally(() => values.delete(context_id));
			return result;
		},
	});
};

export const createContext = create_context;
