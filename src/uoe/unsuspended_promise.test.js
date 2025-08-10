import { test } from "./test.js";
import { unsuspended_promise } from "./unsuspended_promise.js";

await test("direct primitive", async () => {
	const symbol = Symbol("test");

	return (true
		&& await unsuspended_promise(27) === 27
		&& await unsuspended_promise("foo") === "foo"
		&& await unsuspended_promise(true) === true
		&& await unsuspended_promise(false) === false
		&& await unsuspended_promise(undefined) === undefined
		&& await unsuspended_promise(symbol) === symbol
		&& await unsuspended_promise(27n) === 27n
		&& isNaN(await unsuspended_promise(NaN))
	);
});

await test("direct non-primitive", async () => {
	const array = [1, 2, 3];
	const object = { foo: "bar" };

	return (true
		&& await unsuspended_promise(array) === array
		&& await unsuspended_promise(object) === object
	);
});

await test("property access", async () => {
	const object = {
		"foo": "bar",
		"baz": "bazium",
	};

	const promise = unsuspended_promise(object);

	return (true
		&& (await promise).foo === "bar"
		&& (await promise).baz === "bazium"
		&& (await promise).foo === await promise.foo
		&& (await promise).baz === await promise.baz
	);
});

await test("function call", async () => {
	const object = () => "foo";
	const promise = unsuspended_promise(object);

	return (true
		&& (await promise)() === "foo"
		&& (await promise)() === await promise()
	);
});

await test("long chain", async () => {
	const object = () => ({
		foo: () => "bar",
	});

	const promise = unsuspended_promise(object);

	return (true
		&& ((await promise)().foo)() === "bar"
		&& ((await promise)().foo)() === await promise().foo()
	);
});

await test("long async chain", async () => {
	const object = Promise.resolve(async () => ({
		foo: Promise.resolve(async () => "bar"),
	}));

	const promise = unsuspended_promise(object);

	return (true
		&& await (await (await (await promise)()).foo)() === "bar"
		&& await (await (await (await promise)()).foo)() === await promise().foo()
	);
});
