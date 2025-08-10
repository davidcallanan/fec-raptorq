import { test } from "./test.js";
import { unsuspended_map } from "./unsuspended_map.js";
import { map } from "./map.js"; 

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("unsuspended map", async () => {
	const m = unsuspended_map(async () => {
		await timeout(50);

		return map((input) => {
			if (input === undefined) {
				return "foo";
			}
		});
	});

	return await m() === "foo";
});
