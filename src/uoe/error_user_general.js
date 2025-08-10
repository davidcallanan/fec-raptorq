/**
 * @stability 1 - experimental
 * 
 * Produces an `:error` enum instance representing an error caused by the user (programmer) who is supposed to be responsible for interacting with the interface in a cooperative and legal manner. While this implementation may have caught this error, the interface contract might not preclude undefined behaviour as an acceptable outcome. The user must check the policy of the interface contract to seek clarity in that regard.
 * 
 * In particular, an error is produced that is understood to be caused by the user's interaction being off-spec and thus not falling under the categories of "payload" or "state". This is typically due to the user's communication process or method of interaction being so off-protocol that a specific "payload" or "state" error could not even be detected. This could be due to issues in the underlying communication channel, considered an implementation detail from the perspective of errors exposed in this interface.
 * 
 * The optional `cause` allows the developer to keep track of the origin of the error and maintain an error chain. This must be another uoe-error. The optional `ref` allows the user to obtain details for this error in a supplementary interface if available and must be universally unique. The user is expected to know how to interact with such a supplementary interface if one is provided. A supplementary interface is especially useful if a cause chain must be maintained that does not involve uoe-errors, such as native JavaScript exceptions.
 */
export const error_user_general = (message, { cause, ref }) => enm.error({
	short_code: "eug",
	type: "user",
	class: "general",
	message: `EU User (Programmer) Error.\n403 EUG General Refusal.\nThe user's interaction process or communication method is fundamentally amiss.\n${message}`,
	http_status_code: 403,
	...(cause !== undefined && {
		cause,
	}),
	...(ref !== undefined && {
		ref,
	}),
});

export const errorUserPayload = error_user_payload;
