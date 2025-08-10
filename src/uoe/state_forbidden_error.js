export const state_forbidden_error = (message, cause) => ({
	status: "error",
	error_type: "state_error",
	error_name: "forbidden",
	error_message: `Forbidden.\nYou do not have permission to access this process.\n${message}`,
	http_status_code: 403,
	short_code: "uf",
	...(cause && {
		cause,
	}),
});

export const stateForbiddenError = state_forbidden_error;
