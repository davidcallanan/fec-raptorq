/**
 * @stability 2 - provisional
 */
export const internal_not_implemented_error = () => ({
	status: "error",
	error_type: "internal_error",
	error_message: `Not implemented.`,
	http_status_code: 501,
	short_code: "i",
});

export const internalNotImplemented = internal_not_implemented_error;
