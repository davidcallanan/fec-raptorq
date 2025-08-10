/**
 * Tries to run a function and returns an object containing either a value if the function completed or an error if the function threw.
 */
export const simple_try = (func) => {
	try {
		return { value: func() };
	} catch (e) {
		return { error: e };
	}
};

export const simpleTry = simple_try;
