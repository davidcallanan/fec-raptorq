import { collect_async } from "./collect_async.js";

/**
 * @stability 1 - experimental
 */
export const mutate_variables = async (coordinator, variables, callback) => {
	const scopes = await collect_async(variables.map((variable) => variable.get_scope()));
	const solo_variables = variables.map((variable) => variable.solo());
	
	await coordinator.run_transaction(scopes, async () => {
		try {
			await callback(solo_variables);
		} catch (e) {
			console.error(e);
			// TODO: determine appropriate interface for error propagation.
			return false;
		}
		
		await Promise.all(variables.map((variable, i) => variable.man$force_swap(solo_variables[i])));
		return true;
	});
};

export const mutateVariables = mutate_variables;
