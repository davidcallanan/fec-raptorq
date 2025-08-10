import { download_blob } from "./download_blob.js";

export const download_text = (document, text, filename, options) => {
	options ??= {};
	options.type ??= "text/plain";
	options.charset ??= "utf-8";

	const blob = new Blob([text], {
		type: `${options.type};charset=${options.charset}`,
	});

	download_blob(document, blob, filename);
};

export const downloadText = download_text;
