import { deferred_api } from "./deferred_api.js";
import { user_error, internal_error } from "./error.js";

/**
 * @todo
 */
export const create_simple_rpc_client = (fetch, url) => {
	// TODO: api no longer needs to be deferred.
	return deferred_api(async () => {
		// const res = await fetch(url + "/methods");
		// const data = await res.json();
		// const methods = [...data.methods];

		return new Proxy({}, {
			get: (_target, method) => {
				if (method === "then") {
					return undefined;
				}

				return async (...args) => {
					let body, response, data;
		
					try {
						body = JSON.stringify({ method, args });
					} catch (e) {
						throw user_error("Parameters not serializable", e);
					}
		
					try {
						response = await fetch(url + "/rpc", {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
							},
							body,
						});
					} catch (e) {
						throw internal_error("Network error: Unable to fetch from remote", e);
					}
		
					try {
						data = await response.json();
					} catch (e) {
						let err = new Error("Broken response format from remote");
						err.name = "InternalError";
						err.cause = e;
						throw err;
					}
		
					if (data.error) {
						let err = new Error(data.error.message);
						err.name = data.error.name;
						throw err;
					}
		
					return data.result;
				};
			},
		});
	});
}
