import { create_async_factory } from "./create_async_factory.js";
import { unsuspended_promise } from "./unsuspended_promise.js";

/**
 * @stability 2 - provisional
 * 
 * @example
 * 
 * class Api {
 *   constructor(foo, bar) { ... }
 * 
 *   async _init() {
 *     await some_initialization_logic();
 *   }
 * 
 *   ...
 * }
 * 
 * export const create_api = create_unsuspended_factory(Api);
 */
export const create_unsuspended_factory = (cls) => {
	return unsuspended_promise(create_async_factory(cls));
};

export const createUnsuspendedFactory = create_unsuspended_factory;
