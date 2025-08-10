import { test } from "./test.js";
import { is_template_data } from "./is_template_data.js";

test("template data", () => {
	const foo = (data) => is_template_data(data);
	return foo`bar` === true;
});

test("non-template data", () => {
	const foo = (data) => is_template_data(data);
	return foo(`bar`) === false;
});

test("syntactic beauty", () => {
	return (true
		&& is_template_data`foo` === true
		&& is_template_data(`bar`) === false
	);
});
