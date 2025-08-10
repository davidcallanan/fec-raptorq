import { test } from "./test.js";
import { map } from "./map.js";
import { unsuspended_promise } from "./unsuspended_promise.js";

await test("basic test", async () => {
	const m = map((input) => {
		if (input === undefined) {
			return "hello";
		}

		return "world";
	});

	return await m() === "hello" && await m.foo() === "world";
});

await test("unsuspension", async () => {
	const m = map((input) => {
		if (input === undefined) {
			return "hello";
		}

		return "world";
	});

	const m2 = unsuspended_promise(m);

	return await m2() === "hello" && await m2.foo() === "world";
});

await test("complex test", async () => {
	const m = map((input) => {
		if (input === undefined) {
			return undefined;
		}

		return map((input) => {
			if (input === undefined) {
				return "hello";
			}
		});
	});

	return await m.test() === "hello";
});

await test("complex test 2", async () => {
	const m = map((input) => {
		if (input === undefined) {
			return undefined;
		}

		return map((input) => {
			if (input === undefined) {
				return undefined;
			}

			return map((input) => {
				if (input === undefined) {
					return "hello";
				}
			});
		})
	});

	return await m.test.test() === "hello";
});
