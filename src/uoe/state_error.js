import { state_not_found_error } from "./state_not_found_error.js";

/**
 * @stability 2 - provisional
 */
export const state_error = (name, message, cause) => {
	if (name === "not_found") {
		return state_not_found_error(name, message, cause);
	}
	
	return {
		status: "error",
		error_type: "state_error",
		error_name: name,
		error_message: `This action could not be processed in the current state.\n${message}`,
		http_status_code: 409,
		short_code: "s",
		...(cause && {
			cause,
		}),
	}
};

export const stateError = state_error;
