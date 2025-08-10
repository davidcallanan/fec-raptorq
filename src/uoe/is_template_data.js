/**
 * @stability 2 - provisional
 * 
 * Checks if function parameter data likely originated from a template literal.
 * 
 * Note that a regular function call can behave so close to a template literal that the difference is undetectable. Ensure your use-case is ok with this.
 */
export const is_template_data = (data) => {
	return (true
		&& Array.isArray(data)
		&& data.hasOwnProperty("raw")
	);
};

export const isTemplateData = is_template_data;
