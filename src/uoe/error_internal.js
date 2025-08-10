/**
 * @stability 1 - experimental
 * 
 * Produces an `:error` enum instance representing an error caused by an implementation detail. It cannot be determined whether partial execution has occured unless there is a policy that specifies otherwise in this interface's contract. While the error is considered an implementation detail through this interface, there is nothing preventing a different error type from being emitted in a supplementary or alternative interface where this error might not be treated as an implementation detail.
 * 
 * The optional `cause` allows the developer to keep track of the origin of the error and maintain an error chain. This must be another uoe-error. The optional `ref` allows the user to obtain details for this error in a supplementary interface if available and must be universally unique. The user is expected to know how to interact with such a supplementary interface if one is provided. A supplementary interface is especially useful if a cause chain must be maintained that does not involve uoe-errors, such as native JavaScript exceptions.
 */
export const error_internal = (message, { cause, ref }) => enm.error({
	short_code: "ei",
	type: "internal",
	message: `500 EI Internal Error.\n${message ?? ""}`,
	http_status_code: 500,
	...(cause !== undefined && {
		cause,
	}),
	...(ref !== undefined && {
		ref,
	}),
});

export const errorInternal = error_internal;
