const extra_data = new WeakMap();

/**
 * @stability 4 - locked
 * 
 * This function allows you to attach extra data to any object for temporary debugging purposes.
 * It essentially allows you to carry some data around that is tied to / associated with an object.
 * It is especially useful for objects that make it difficult to hackishly modify custom properties in moments of debugging.
 * 
 * @example
 * 
 * const john = create_person();
 * debug_xd(john).name = "john";
 * 
 * const jane = create_person();
 * debug_xd(jane).name = "jane";
 * 
 * // later on, we detect an error originating in some person object and we'd like to log its name
 * const person = get_arbitrary_person();
 * 
 * try {
 *   person.do_something();
 * } catch(e) {
 *   console.log(debug_xd(person).name, "caused the error");
 * }}
 */
export const debug_xd = (obj) => {
	if (obj === undefined) {
		return {};
	}
	
	if (extra_data.has(obj)) {
		return extra_data.get(obj);
	}

	const xd = {};
	extra_data.set(obj, xd);
	return xd;	
};

export const debugXd = debug_xd;
