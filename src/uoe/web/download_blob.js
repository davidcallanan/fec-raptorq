import { download_url } from "./download_url.js";

export const download_blob = (document, blob, filename) => {
	const url = URL.createObjectURL(blob);
	download_url(document, url, filename);
	URL.revokeObjectURL(url);
};
