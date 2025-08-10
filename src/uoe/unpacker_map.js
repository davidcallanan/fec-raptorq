import { is_enum } from "./is_enum.js";
import { is_map } from "./is_map.js";
import { map } from "./map.js";
import { obtain_map } from "./obtain_map.js";
import { create_promise } from "./create_promise.js";
import { api } from "./api.js";

/**
 * @stability 1 - experimental
 * 
 * Takes in an unpacker function and produces a map that destructures the various scenarios that the input might take on (whether the input be a uoe-map, a uoe-enum, or undefined).
 * 
 * Recall that "undefined" is the leaf case, specifying the desire to obtain the final return value of the map.
 * 
 * Otherwise, the input may be an enum or a map. Be careful not to inadvertently pass in a map that resolves to an enum leaf, when it is desired that the enum be passed in instead. Take care to await this if necessary.
 * 
 * TODO: should notion of uoe-api be incorporated directly into this notation?
 * 
 * @example
 * 
 * const my_map = unpacker_map(($) => {
 *   $.symbol_name(($) => {
 *     // ...
 *   });
 * 
 * 	 $.symbol_name.$ret_lazy(() => "example");
 *   $.symbol_name.$ret("example"); // shorthand
 *   $.symbol_name.$call((map) => {});
 *   $.symbol_name.$fall((inp) => {});
 *   $.$ret(() => "example")
 *   $.$("example"); // shorthand
 *   $.$call((map) => {});
 *   $.$fall((inp) => {});
 * });
 * 
 * const person = unpacker_map(($) => {
 *   $.name.$ret("John Doe");
 *   $.age.$ret(27);
 *   $.friends.$ret(["mary", "jane", "joseph"]);
 *   $.address(($) => {
 *     $.street.$ret("123 Main St");
 *     $.city.$ret("Monopoly Town");
 *     $.state.$ret("CA");
 *   });
 * });
 */
export const unpacker_map = (unpacker) => obtain_map((async () =>{
	let self_ret = undefined;
	let self_call = undefined;
	let self_fall = undefined;
	
	const symbols = new Map();
	
	const builder = new Proxy({}, {
		get: (target, prop) => {
			if (prop === "$call") {
				return (callback) => {
					self_call = callback;	
				};
			}
			
			if (prop === "$fall") {
				return (fallback) => {
					self_fall = fallback;
				};
			}
			
			if (prop === "$ret") {
				return (value) => {
					self_ret = () => value;
				};
			}
			
			if (prop === "$ret_lazy") {
				return (lazy_value) => {
					self_ret = lazy_value;
				};
			}
			
			if (prop === "$ret_api") {
				return (unpacker) => {
					self_ret = () => {
						return api(async () => {
							const [explicit_prom, res_explicit, _rej] = create_promise();
				
							const implicit = unpacker_map(async ($) => {
								res_explicit(await unpacker($));
							});
							
							const explicit = await explicit_prom;
							
							if (explicit !== undefined) {
								return explicit;
							}
							
							return implicit;
						});
					};
				};
			}
			
			if (prop === "$call_api") {
				return (callback) => {
					self_call = (input) => {
						return api(async () => {
							const [explicit_prom, res_explicit, _rej] = create_promise();
				
							const implicit = unpacker_map(async ($) => {
								res_explicit(await callback(input, $));
							});
							
							const explicit = await explicit_prom;
							
							if (explicit !== undefined) {
								return explicit;
							}
							
							return implicit;
						});
					};
				};
			}
			
			if (/^[a-zA-Z0-9_]+$/.test(prop)) {
				return new Proxy((unpacker) => {
					symbols.set(prop, symbols.get(prop) ?? {});
					symbols.get(prop).fall = unpacker_map(unpacker);
				}, {
					get: (target, nested_prop) => {
						if (nested_prop === "$call") {
							return (callback) => {
								symbols.set(prop, symbols.get(prop) ?? {});
								symbols.get(prop).call = callback;
							};
						}
						
						if (nested_prop === "$call_api") {
							return (callback) => {
								symbols.set(prop, symbols.get(prop) ?? {});
								symbols.get(prop).call_api = callback;
							};
						}
						
						if (nested_prop === "$fall") {
							return (fallback) => {
								symbols.set(prop, symbols.get(prop) ?? {});
								symbols.get(prop).fall = fallback;
							};
						}
						
						if (nested_prop === "$ret") {
							return (value) => {
								symbols.set(prop, symbols.get(prop) ?? {});
								symbols.get(prop).ret = () => value;
							};
						}
						
						if (nested_prop === "$ret_lazy") {
							return (lazy_value) => {
								symbols.set(prop, symbols.get(prop) ?? {});
								symbols.get(prop).ret = lazy_value;
							};
						}
						
						if (nested_prop === "$ret_api") {
							return (unpacker) => {
								symbols.set(prop, symbols.get(prop) ?? {});
								symbols.get(prop).ret_api = unpacker;
							};
						}
						
						return target[nested_prop];
					},
				});
			}
			
			return target[prop];
		},
	});
	
	await unpacker(builder);
	
	const symbol_maps = new Map();
	
	for (const [sym, entry] of symbols) {
		symbol_maps.set(sym, unpacker_map(($) => {
			if (entry.ret !== undefined) {
				$.$ret_lazy(entry.ret);
			}
			
			if (entry.ret_api !== undefined) {
				$.$ret_api(entry.ret_api);
			}
			
			if (entry.call !== undefined) {
				$.$call(entry.call);
			}
			
			if (entry.call_api !== undefined) {
				$.$call_api(entry.call_api);
			}
			
			if (entry.fall !== undefined) {
				$.$fall(entry.fall);
			}
		}));
	}
	
	return map(async (input) => {
		if (true
			&& !is_map(input)
			&& !is_enum(input)
			&& input !== undefined
		) {
			throw user_payload_error("Expected uoe-map, uoe-enum or `undefined` as input to map. Consider using `obtain_map` or awaiting an enum leaf if appropriate.");
		}
		
		if (true
			&& self_ret !== undefined
			&& input === undefined
		) {
			return self_ret();
		}
		
		if (true
			&& self_call !== undefined
			&& is_map(input)
		) {
			const [explicit_prom, res_explicit, _rej] = create_promise();
			
			const implicit = unpacker_map(async ($) => {
				res_explicit(await self_call(input, $));
			});
			
			const explicit = await explicit_prom;
			
			if (explicit !== undefined) {
				return explicit;
			}
			
			return implicit;
		}
		
		if (true
			&& is_enum(input)
			&& symbol_maps.get(input.sym) !== undefined
		) {
			return symbol_maps.get(input.sym);
		}
		
		if (self_fall !== undefined) {
			return self_fall(input);
		}
	});
})());
