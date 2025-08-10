const syntactic_sugar = (overall, curr) => new Proxy(curr ?? {}, {
	get: (target, prop) => {
		if (typeof prop === "symbol") {
			return target[prop];
		}

		if (["sym", "data"].includes(prop)) {
			return target[prop];
		}

		if (prop === "then") {
			// This is a special case in response to "Note 0000" (`notes/0000_promise_flattening.md`).
			// We must forcefully undefine the `then` property, as otherwise it would be classified as a "thenable".
			// If access to `:then` is needed, you must use the property [":then"] instead.

			return undefined;
		}

		if (prop.startsWith(":")) {
			if (prop === ":then") {
				prop = "then";
			} else if (prop === ":sym") {
				prop = "sym";
			} else if (prop === ":data") {
				prop = "data";
			}
		}

		if (prop.includes(".")) {
			const [first, ...rest] = prop.split(".");
			return target[first][rest.join(".")];
		}

		if (prop.match(/[^a-zA-Z0-9_]/)) {
			throw new Error(`Illegal symbol: ${prop}`);
		}

		if (overall === undefined) {
			overall = {};
		}

		const result = (data) => {
			if (curr === undefined) {
				result.data = data;
			} else {
				curr.data.data = data;
			}

			return result;
		};

		Object.assign(result, overall);

		if (curr === undefined) {
			result.sym = prop;
		} else {
			curr.data = { sym: prop };
		}

		return syntactic_sugar(result, curr === undefined ? result : curr.data)
	},
});

/**
 * @stability 2 - provisional
 * 
 * Constructs a uoe-enum instance, which behaves like a tagged union.
 * 
 * An enum instance consists of a symbol and optionally some data.
 * 
 * The structure of an enum instance is `{ sym, data }`.
 * 
 * Replacements:
 * 
 *  - [":sym"] -> :sym
 *  - [":data"] -> :data
 *  - [":then"] -> :then
 * 
 * @example
 * 
 * const pet = enm.cat({ name: "Fluffy" });
 * const bate = enm.fish;
 * draw_animals(tup([pet, bate])({
 *   stroke: enm.no_stroke,
 *   fill: enm.with_fill.gradient(tup(enm.red, enm.blue))
 * }));
 */
export const enm = syntactic_sugar();
