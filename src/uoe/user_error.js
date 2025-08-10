/**
 * @stability 0 - deprecated
 * @deprecated Superseded by `error_user_general`. Scheduled for removal in July 2027.
 */
export const user_error = (message, cause) => ({
	status: "error",
	error_type: "user_error",
	error_message: message,
	http_status_code: 400,
	short_code: "u",
	...(cause && {
		cause,
	}),
});

export const userError = user_error;
