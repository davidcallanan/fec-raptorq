/**
 * @stability 2 - provisional
 * 
 * Converts a uoe-error into a JavaScript error and throws it.
 */
export const throw_error = (error) => {
	if (error?.sym === "error") {
		console.log("actually found error");
		throw_error(error.data);
	}

	throw (() => {
		if (error.type === "user") {
			let err = new Error(
				`
type   ${error.type}
class  ${error.class}
${error.message}
`);
			err.name = "UserError";
			err.details = error;
			return err;
		}

		if (error.type === "state") {
			let err = new Error(
				`
type   ${error.type}
name   ${error.name}
${error.message}
`);
			err.name = "StateError";
			err.details = error;
			return err;
		}
		if (error.type === "internal") {
			let err = new Error(
				`
type   ${error.type}
${error.message}
`);
			err.name = "InternalError";
			err.details = error;
			return err;
		}
	})();
};
