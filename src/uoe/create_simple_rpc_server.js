// TODO: allow server to call back to client, this can be over websockets.
// (if a websocket connection is already established it can perhaps use that for requests as well).

/**
 * @todo
 */
export const create_simple_rpc_server = (express, cors, intf) => {
	let next_exception = 0;
	
	const app = express();
	app.use(express.json());
	app.use(cors()); // allow all cors (safe provided we don't maintain state.....)
	
	///////////
	// Change: possible methods are technically part of the typings, so this will no longer be incorporated directly in the runtime portion of the code.

	// let methods = [];
	
	// for (let [name, func] of Object.entries(intf)) {
	// 	if (typeof func !== "function") {
	// 		continue;
	// 	}
	
	// 	methods.push(name);
	// }

	// app.get("/methods", (req, res) => {
	// 	res.json({ methods });
	// });
	///////////
	
	app.post("/rpc", async (req, res) => {
		// TODO: this is legacy invocation format.
		// new format uses a single `input` value which can be an enum.
		// this must be changed soon.

		let { method, args } = req.body;
		let result, error;
	
		try {
			result = await intf[method](...args);
		} catch (e) {
			// TODO: this is legacy error format.
			// an enum variant for errors can be returned.
			// only errors that are automatically propogated are exceptions, that is, internal errors.

			if (["UserError", "StateError"].includes(e.name)) {
				error = {
					name: e.name,
					message: e.message,
				};
			} else {
				let exception_id = next_exception++;
	
				console.error(e.name === "InternalError" ? `Hidden exception ${exception_id}` : `Unhandled exception ${exception_id}`);
				console.error(e);
	
				error = {
					name: "InternalError",
					message: e.name === "InternalError" ? `Hidden exception ${exception_id}` : `Unhandled exception ${exception_id}`,
				};
			}
		}
	
		if (error) {
			try {
				var response = JSON.stringify({ error });
			} catch (e) {
				console.error(e);
				console.error(error);
				res.status(200).json({
					error: {
						name: "InternalError",
						message: "Error not serializable",
					},
				});
				return;
			}
	
			res.status(200).end(response);
			return;
		}
	
		try {
			var response = JSON.stringify({ result });
		} catch (e) {
			console.error(e);
			console.error(result);
			res.status(200).json({
				error: {
					name: "InternalError",
					message: "Response not serializable",
				},
			});
			return;
		}
	
		res.status(200).end(response);
	});
	
	return app;
}
