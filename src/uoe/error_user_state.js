/**
 * @stability 1 - experimental
 * 
 * Produces an `:error` enum instance representing an error caused by the user (programmer) who is supposed to be responsible for interacting with the interface in a cooperative and legal manner. While this implementation may have caught this error, the interface contract might not preclude undefined behaviour as an acceptable outcome. The user must check the policy of the interface contract to seek clarity in that regard.
 * 
 * In particular, an error is produced that is understood to be caused by the user providing a payload that is illegal in the current state of the system. This error should only be produced if the state of the system can be inferred by the user, that is, if a representation of the current state of the system is expected to be maintained by the user (whether at run-time or compile-time). If the state in question faces external influence, e.g. indeterministicity or other users, then the user should not be accountable for a state mismatch and this error should not be produced.
 * 
 * The optional `cause` allows the developer to keep track of the origin of the error and maintain an error chain. This must be another uoe-error. The optional `ref` allows the user to obtain details for this error in a supplementary interface if available and must be universally unique. The user is expected to know how to interact with such a supplementary interface if one is provided. A supplementary interface is especially useful if a cause chain must be maintained that does not involve uoe-errors, such as native JavaScript exceptions.
 */
export const error_user_state = (message, { cause, ref }) => enm.error({
	short_code: "eus",
	type: "user",
	class: "state",
	message: `EU User (Programmer) Error.\n409 EUS Inferable State Mismatch.\nThe payload is illegal in the implied state.\n${message}`,
	http_status_code: 409,
	...(cause !== undefined && {
		cause,
	}),
	...(ref !== undefined && {
		ref,
	}),
});

export const errorUserState = error_user_state;
