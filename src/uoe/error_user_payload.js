import { enm } from "./enm.js";

/**
 * @stability 1 - experimental
 * 
 * Produces an `:error` enum instance representing an error caused by the user (programmer) who is supposed to be responsible for interacting with the interface in a cooperative and legal manner. While this implementation may have caught this error, the interface contract might not preclude undefined behaviour as an acceptable outcome. The user must check the policy of the interface contract to seek clarity in that regard.
 * 
 * In particular, an error is produced that is understood to be caused by the payload provided by the user being corrupt or malformed in some way. This error should only be produced if the interface always finds this payload to be illegal irrespective of the current state of the system. That is, the error should be produced if it is one that a better type system could have encoded at compile-time by only analyzing the payload and not the current state of the system or any external factors.
 * 
 * The optional `cause` allows the developer to keep track of the origin of the error and maintain an error chain. This must be another uoe-error. The optional `ref` allows the user to obtain details for this error in a supplementary interface if available and must be universally unique. The user is expected to know how to interact with such a supplementary interface if one is provided. A supplementary interface is especially useful if a cause chain must be maintained that does not involve uoe-errors, such as native JavaScript exceptions.
 */
export const error_user_payload = (message, options) => {
	const { cause, ref } = options ?? {};

	return enm.error({
		short_code: "eup",
		type: "user",
		class: "payload",
		message: `EU User (Programmer) Error.\n400 EUP Malformed Payload.\nThe payload is illegal in all states.\n${message}`,
		http_status_code: 400,
		...(cause !== undefined && {
			cause,
		}),
		...(ref !== undefined && {
			ref,
		}),
	});
};

export const errorUserPayload = error_user_payload;
