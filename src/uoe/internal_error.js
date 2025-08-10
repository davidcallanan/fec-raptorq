/**
 * @stability 2 - provisional
 */
export const internal_error = (message, cause) => ({
	status: "error",
	error_type: "internal_error",
	error_message: message,
	http_status_code: 500,
	short_code: "i",
	...(cause && {
		cause,
	}),
});

export const internalError = internal_error;
