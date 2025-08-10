import { leaf_map } from "../leaf_map.js";

// Bug: The following does not work correctly.
// const x = expr`(:foo -> :bar("hello"))`;
// console.log("j", await (await x.foo()).data[0]());
// console.log("w", await (await x.foo().data)[0]());

import { mapData, join, opt, multi, opt_multi, or, declare } from "./blurp.js";

import { map } from "../map.js";
import { is_enum } from "../is_enum.js";
import { enm } from "../enm.js";
import { create_promise } from "../create_promise.js";
import { unsuspended_map } from "../unsuspended_map.js";

// UTILS

class SymbolTable {
	constructor(parent) {
		this._table = new Map();
		this._parent = parent;
	}

	set(sym, value) {
		if (this._table.has(sym)) {
			throw new Error(`Symbol ${sym} already exists`);
		}

		this._table.set(sym, value);
	}

	try_set(sym, value) {
		if (this._table.has(sym)) {
			return false;
		}

		this._table.set(sym, value);
		return true;
	}

	get(sym) {
		if (this._table.has(sym)) {
			return this._table.get(sym);
		}

		if (this._parent) {
			return this._parent.get(sym);
		}

		return undefined;
	}
}

// TOKENS

const WHITESPACE = /^\s+/;
const SINGLELINE_COMMENT  = mapData(/^\s*\/\/(.*?)\n/s,   data => data.groups[0]);
const MULTILINE_COMMENT   = mapData(/^\s*\/\*(.*?)\*\//s, data => data.groups[0]);
const SKIPPERS = opt(multi(or(WHITESPACE, SINGLELINE_COMMENT, MULTILINE_COMMENT)));

const withSkippers = (p) => mapData(join(SKIPPERS, p, SKIPPERS), data => data[1]);
const withLeftSkippers = (p) => mapData(join(SKIPPERS, p), data => data[1]);
const withRightSkippers = (p) => mapData(join(p, SKIPPERS), data => data[0]);

const INT = withSkippers(mapData(/^\d+/, data => BigInt(data.groups.all)));
const FLOAT = withSkippers(mapData(/^\d+\.\d+/, data => parseFloat(data.groups.all)));
const STRING = withSkippers(mapData(/^\"(.*?)\"/, data => data.groups[0]));
const BARE_CONSTANT = mapData(/^\:\!CONSTANT\$[0-9]\!+/, data => data.groups.all.split("$")[1].split("!")[0]);
const CONSTANT = withSkippers(BARE_CONSTANT);
const BARE_SYMBOL = mapData(/^\:[a-z0-9_]*/, data => data.groups.all.substring(1));
const SYMBOL = withSkippers(BARE_SYMBOL);
const IDENT = withSkippers(/^[a-z_][a-z0-9_]*/, data => data.groups.all);
const PLUS = withSkippers("+");
const MINUS = withSkippers("-");
const MULT = withSkippers("*");
const DIV = withSkippers("/");
const AND = withSkippers("&&");
const OR = withSkippers("||");
const EQ = withSkippers("==");
const NEQ = withSkippers("!=");
const LT = withSkippers("<");
const GT = withSkippers(">");
const LTE = withSkippers("<=");
const GTE = withSkippers(">=");
const NOT = withSkippers("!");
const BARE_LPAREN = "(";
const LPAREN = withSkippers(BARE_LPAREN);
const RPAREN = withSkippers(")");
const BARE_LBRACE = "{";
const LBRACE = withSkippers(BARE_LBRACE);
const RBRACE = withSkippers("}");
const TRUE = withSkippers("true");
const FALSE = withSkippers("false");
const COMMA = withSkippers(",");
const SEMI = withSkippers(";");
const WALRUS = withSkippers(":=");
// Use JavaScript when other operations are needed.

// RULES

const symbol_extension = declare();
const atom = declare();
const tuple = declare();
const block = declare();
const crystal = declare();
const pistol = declare();
const expression = declare();

symbol_extension.define(
	or(
		mapData(
			join(SYMBOL, opt(symbol_extension)),
			data => (ctx) => ({
				sym: data[0],
				...data[1] && {
					data: data[1](ctx),
				},
			}),
		),
		tuple,
		block,
	),
);

const symbol = mapData(
	join(BARE_SYMBOL, opt(symbol_extension)),
	data => (ctx) => leaf_map({
		sym: data[0],
		...data[1] && {
			data: data[1](ctx),
		},
	}),
);

const constant = mapData(
	CONSTANT,
	data => (ctx) => leaf_map(ctx.constants[data]),
);

const constant_call = mapData(
	join(constant, opt_multi(symbol)),
	data => (ctx) => {
		let result = data[0](ctx);
		
		for (let i = 0; i < data[1].length; i++) {
			result = result(data[1][i](ctx));
		}

		return result;
	},
);

const pattern = multi(or(
	mapData(
		BARE_SYMBOL,
		data => ({
			type: "symbol",
			sym: data,
		}),
	),
	mapData(
		join(BARE_LPAREN, opt_multi(or(
			mapData(SYMBOL, data => ({
				type: "named_destructure",
				sym: data,
				var_name: data,
			})),
			mapData(IDENT, data => ({
				type: "positional_destructure",
				var_name: data,
			})),
		), COMMA), RPAREN),
		data => ({
			type: "map",
			syms: data[1],
		}),
	),
));

const tuple_entry = or(
	mapData(
		join(opt(WHITESPACE), pattern, WHITESPACE, expression),
		data => ({
			type: "mapping_entry",
			patterns: data[1],
			expression: data[3],
		}),
	),
	mapData(
		expression,
		data => ({
			type: "positional_entry",
			expression: data,
		}),
	),
);

const construct_map = (old_ctx, entries) => {
	const ctx = {
		...old_ctx,
		symbol_table: new SymbolTable(old_ctx.symbol_table),
	};

	const [prom_local, resolve_local] = create_promise();
	const local = unsuspended_map(() => prom_local);

	const root_entries = new Map();

	for (const entry of entries) {
		const [p0, ...p_rest] = entry.patterns;
		
		if (p0.type === "symbol") {
			if (p0.sym === "") {
				if (p_rest.length > 0) {
					throw "Wtf you up to bro";
				}
			
				return entry.expression(ctx);
			}

			if (p_rest.length === 0) {
				ctx.symbol_table.try_set(p0.sym, {
					type: "map_get",
					map: local,
					sym: p0.sym,
				});
				
				const precomputed_value = (async () => {
					await undefined;
					return await entry.expression(ctx);
				})();

				root_entries.set(p0.sym, {
					execute: () => precomputed_value,
				});
			} else {
				if (!root_entries.has(p0.sym)) {
					ctx.symbol_table.try_set(p0.sym, {
						type: "map_get",
						map: local,
						sym: p0.sym,
					});

					root_entries.set(p0.sym, {
						entries: [{
							patterns: p_rest,
							expression: entry.expression,
						}],
					});
				} else {
					root_entries.get(p0.sym).entries.push({
						patterns: p_rest,
						expression: entry.expression,
					});
				}
			}
		} else {
			throw "Pattern type not implemented";
		}
	}

	for (const entry of root_entries.values()) {
		if (entry.entries !== undefined) {
			const entries = entry.entries;
			const precomputed_value = (async () => {
				await undefined;
				return construct_map(ctx, entries);
			})();
			entry.execute = () => precomputed_value;
			entry.entries = undefined;
		}
	}
	
	const result = map(async (input) => {
		if (input === undefined) {
			return undefined;
		}

		if (is_enum(input)) {
			const entry = root_entries.get(input.sym);

			if (entry === undefined) {
				return undefined;
			}

			return await entry.execute();
		} else {
			throw new Error("Expected enum. Todo: check for leaf enum here?");
		}
	});

	resolve_local(result);

	return result;
};

tuple.define(mapData(
	or(
		mapData(
			join(BARE_LPAREN, opt_multi(join(tuple_entry, SEMI)), RPAREN),
			data => ({
				entries: data[1].map(entry => entry[0]),
			}),
		),
		mapData(
			join(BARE_LPAREN, opt_multi(tuple_entry, COMMA), RPAREN),
			data => ({
				entries: data[1],
			}),
		),
	),
	data => {
		let next_positional_idx = 0;
		const entries = [];

		for (let entry of data.entries) {
			if (entry.type == "positional_entry") {
				entries.push({
					patterns: [{
						type: "symbol",
						sym: `${next_positional_idx++}`,
					}],
					expression: entry.expression,
				});
			} else if (entry.type == "mapping_entry") {
				entries.push({
					patterns: entry.patterns,
					expression: entry.expression,
				});
			}
		}
		
		return (ctx) => {
			return construct_map(ctx, entries);
		};
	},
));

block.define(mapData(
	join(BARE_LBRACE, RBRACE),
	data => () => map(),
));

atom.define(or(
	mapData(join(NOT, atom), data => (ctx) => leaf_map((async () => {
		const value = await data[1](ctx)();

		if (typeof value !== "boolean") {
			throw new Error(`Expected boolean, got ${value}`);
		}

		return !await data[1](ctx)();
	})())),
	mapData(FLOAT, data => () => leaf_map(data)),
	mapData(INT, data => () => leaf_map(data)),
	mapData(STRING, data => () => leaf_map(data)),
	mapData(TRUE, () => () => leaf_map(true)),
	mapData(FALSE, () => () => leaf_map(false)),
	constant_call,
	symbol,
	mapData(join(IDENT, WALRUS, expression), data => (ctx) => {
		const var_name = data[0].groups.all;
		const right = data[2](ctx);
		console.log("setting", var_name, "to", right);
		ctx.symbol_table.set(var_name, {
			type: "exact",
			value: right,
		});
		return right;
	}),
	mapData(IDENT, data => (ctx) => {
		const var_name = data.groups.all;
		const value = ctx.symbol_table.get(var_name);
		
		if (value === undefined) {
			throw new Error(`Variable ${var_name} is not defined`);
		}

		if (value.type === "exact") {
			return value.value;
		} else if (value.type === "map_get") {
			return value.map(enm[value.sym]);
		} else {
			throw new Error(`Internal error: unknown symbol table value type ${value.type}`);
		}
	}),
	tuple,
	block,
));

pistol.define(or(
	mapData(join(atom, multi(join(or(PLUS, MINUS), atom))), data => (ctx) => leaf_map((async () => {
		let result = await data[0](ctx)();

		for (let i = 0; i < data[1].length; i++) {
			const op = data[1][i][0];
			const value = await data[1][i][1](ctx)();

			if (op == "+") {
				result += value;
			} else if (op == "-") {
				result -= value;
			}
		}

		return result;
	})())),
	mapData(join(atom, multi(join(or(MULT, DIV), atom))), data => (ctx) => leaf_map((async () => {
		let result = await data[0](ctx)();
		let is_bigint = typeof result === "bigint";
		const outstanding = [];

		for (let i = 0; i < data[1].length; i++) {
			const op = data[1][i][0];
			const value = await data[1][i][1](ctx)();

			if (op == "*") {
				result *= value;
			} else if (op == "/") {
				if (is_bigint) {
					outstanding.push(value);
				} else {
					result /= value;
				}
			}
		}

		if (is_bigint) {
			for (let i = 0; i < outstanding.length; i++) {
				result /= outstanding[i];
			}
		}

		return result;
	})())),
	mapData(join(atom, multi(join(AND, atom))), data => (ctx) => leaf_map((async () => {
		let result = await data[0](ctx)();

		for (let i = 0; i < data[1].length; i++) {
			result = result && await data[1][i][1](ctx)();
		}

		return result;
	})())),
	mapData(join(atom, multi(join(OR, atom))), data => (ctx) => leaf_map((async () => {
		let result = await data[0](ctx)();

		for (let i = 0; i < data[1].length; i++) {
			result = result || await data[1][i][1](ctx)();
		}

		return result;
	})())),
	mapData(join(atom, multi(join(or(EQ, NEQ, GTE, LTE, GT, LT), atom))), data => (ctx) => leaf_map((async () => {
		let prev_value = await data[0](ctx)();

		for (let i = 0; i < data[1].length; i++) {
			const op = data[1][i][0];
			const value = await data[1][i][1](ctx)();

			if (op == "==") {
				if (!(prev_value === value)) {
					return false;
				}
			} else if (op == "!=") {
				if (!(prev_value !== value)) {
					return false;
				}
			} else if (op == ">") {
				if (!(prev_value > value)) {
					return false;
				}
			} else if (op == "<") {
				if (!(prev_value < value)) {
					return false;
				}
			} else if (op == ">=") {
				if (!(prev_value >= value)) {
					return false;
				}
			} else if (op == "<=") {
				if (!(prev_value <= value)) {
					return false;
				}
			}

			prev_value = value;
		}

		return true;
	})())),
	atom,
));

crystal.define(or(
	mapData(multi(join(or(PLUS, MINUS), atom)), data => (ctx) => leaf_map((async () => {
		let result;
		
		for (let i = 0; i < data.length; i++) {
			const op = data[i][0];
			const value = await data[i][1](ctx)();

			if (i == 0) {
				if (typeof value === "number") {
					result = 0;
				} else {
					result = 0n;
				}
			}
			
			if (op === "+") {
				result += value;
			} else if (op === "-") {
				result -= value;
			}
		}

		return result;
	})())),
	mapData(multi(join(or(MULT, DIV), atom)), data => (ctx) => leaf_map((async () => {
		let result;
		let is_bigint = false;
		const outstanding = [];
		
		for (let i = 0; i < data.length; i++) {
			const op = data[i][0];
			const value = await data[i][1](ctx)();

			if (i == 0) {
				if (typeof value === "number") {
					result = 1;
				} else {
					result = 1n;
					is_bigint = true;
				}
			}
			
			if (op === "*") {
				result *= value;
			} else if (op === "/") {
				if (is_bigint) {
					outstanding.push(value);
				} else {
					result /= value;
				}
			}
		}

		if (is_bigint) {
			for (let i = 0; i < outstanding.length; i++) {
				result /= outstanding[i];
			}
		}

		return result;
	})())),
	mapData(multi(join(AND, atom)), data => (ctx) => leaf_map((async () => {
		let result = true;
		
		for (let i = 0; i < data.length; i++) {
			const value = await data[i][1](ctx)();
			result &&= value;
		}

		return result;
	})())),
	mapData(multi(join(OR, atom)), data => (ctx) => leaf_map((async () => {
		let result = false;
		
		for (let i = 0; i < data.length; i++) {
			const value = await data[i][1](ctx)();
			result ||= value;
		}

		return result;
	})())),
	pistol,
));

expression.define(
	withSkippers(crystal),
);

const cache = new Map();

const run_expr = (input, constants) => {
	const ctx = {
		constants,
		symbol_table: new SymbolTable(),
	};

	if (cache.has(input)) {
		const result = cache.get(input);
		return result.data(ctx);
	}
	
	const result = expression(input);
	
	if (result.success === false || result.input !== "") {
		console.error(result);
		throw new Error(`Failed to parse`);
	}

	cache.set(input, result);
	
	return result.data(ctx);
};

/**
 * Evaluates an expression.
 * 
 * @example
 * 
 * await e("1 + 2")(); // 3
 * 
 * @example
 * 
 * const closing_balance = await e`
 *   + ${opening_balance}
 *   + ${sales}
 *   - ${expenses}
 * `();
 * 
 * @example
 * 
 * const F = await e`
 *   * ${gravitational_constant}
 *   * ${mass_a}
 *   * ${mass_b}
 *   / ${Math.pow(distance, 2)}
 * `();
 * 
 * @example
 * 
 * if (await e`
 *   && ${is_eligible}
 *   && (
 *     || ${is_of_age}
 *     || ${has_parental_consent}
 *   )
 * `()) {}
 * 
 * @example
 * 
 * const person = e`{
 *   :first_name "John";
 *   :last_name "Doe";
 *   :age 27;
 * }`;
 */
export const e = (arg, ...expressions) => {
	if (Array.isArray(arg)) {
		// This is a tagged template literal.

		let input = "";

		for (let [i, segment] of arg.entries()) {
			input += segment;

			if (i < expressions.length) {
				input += `:!CONSTANT\$${i}!`;
			}
		}

		const constants = expressions;
		return run_expr(input, constants);
	}

	const input = arg;
	return run_expr(input, []);
};
