export const state_not_found_error = (message, cause) => ({
	status: "error",
	error_type: "state_error",
	error_name: "not_found",
	error_message: `Not found.\nThe target entity does not exist.\n${message}`,
	http_status_code: 404,
	short_code: "un",
	...(cause && {
		cause,
	}),
});

export const stateNotFoundError = state_not_found_error;
