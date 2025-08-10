/**
 * @stability 4 - locked
 * 
 * This function will bind the `this` value of a callable during invocation, but will still let through access to properties of the original callable.
 * 
 * Motivation: Normal binding of a function will prevent access to custom properties defined on the function. Binding a function this way will allow continued access to properties defined on your function.
 * 
 * @example
 * 
 * const person = () => console.log("Hello");
 * person.name = "tejohnst";
 * 
 * console.log(person.bind({}).name); // undefined
 * console.log(bind_callable(person, {}).name); // "tejohnst"
 */
export const bind_callable = (callable, this_value) => {
	// Note: Reflect is used to ensure the safe administration of native behaviour.
	
	return new Proxy(callable, {
		get: (target, prop) => {
			return target[prop];
		},
		apply: (target, _this_value, args) => {
			return Reflect.apply(target, this_value, args);
		},
	});
};

export const bindCallable = bind_callable;
