/**
 * @stability 3 - stable
 * 
 * Builds an object in multiple steps, where each step can access the accumulated properties of the previous steps.
 * 
 * Each passed-in argument represents a step.
 * Each step provides the new properties to merge into the accumulated object.
 * A step may be a plain object, or a function returning an object which takes in the currently-accumulated object as its only argument.
 * 
 * @example
 * 
 * const person = build_obj({
 *   first_name: "John",
 *   last_name: "Doe",
 *   age: 27,
 * }, (o) => ({
 *   full_name: `${o.first_name} ${o.last_name}`,
 *   is_adult: o.age >= 18,
 * }), (o) => ({
 *   is_child: !o.is_adult,
 * }));
 */
export const build_obj = (...steps) => {
	let obj = {};

	for (let step of steps) {
		let next = typeof step === "function" ? step(obj) : step;

		obj = {
			...obj,
			...next,
		};
	}

	return obj;
};

export const buildObj = build_obj;
