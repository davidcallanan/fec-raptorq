import { create_promise } from "../create_promise.js";

export const request_upload = (document, options) => {
	options ??= {};
	options.allow_multiple ??= false;

	const input = document.createElement("input");
	input.style.display = "none";
	input.setAttribute("type", "file");

	if (options.allow_multiple) {
		input.setAttribute("multiple", "multiple");
	}

	document.body.appendChild(input);
	input.click();

	const [promise, res] = create_promise();

	input.addEventListener("change", (event) => {
		res(Array.from(event.target.files));
	});

	input.addEventListener("cancel", () => {
		res([]);
	});

	return promise;
};
