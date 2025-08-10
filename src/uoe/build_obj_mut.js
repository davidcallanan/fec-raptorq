/**
 * @stability 2 - provisional
 * 
 * Similar to `build_obj` except that each steps mutates the initial object.
 * The first argument is taken as-is, and the remaining arguments are treated as steps.
 * This means fancy objects like functions can be passed in as the first argument.
 */
export const build_obj_mut = (initial_obj, ...steps) => {
	for (let step of steps) {
		let next = typeof step === "function" ? step(initial_obj) : step;
		Object.assign(initial_obj, next);
	}

	return initial_obj;
};

export const buildObjMut = build_obj_mut;
