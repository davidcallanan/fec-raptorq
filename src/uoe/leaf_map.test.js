import { test } from "./test.js";
import { leaf_map } from "./leaf_map.js";
import { unsuspended_promise } from "./unsuspended_promise.js";

await test("direct", async () => {
	return await leaf_map("foo")() === "foo";
});

await test("promise", async () => {
	return await leaf_map(Promise.resolve("foo"))() === "foo";
});

await test("unsuspended promise", async () => {
	return await leaf_map(unsuspended_promise("foo"))() === "foo";
});
