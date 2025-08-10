import { test } from "./test.js";
import { map } from "./map.js";
import { is_map } from "./is_map.js";
import { unsuspended_promise } from "./unsuspended_promise.js";

test("primitive", () => {
	return (true
		&& is_map(27) === false
		&& is_map("foo") === false
		&& is_map(true) === false
		&& is_map(false) === false
		&& is_map(undefined) === false
		&& is_map(Symbol("test")) === false
		&& is_map(27n) === false
		&& is_map(NaN) === false
	);
});

test("non-primitive", () => {
	return (true
		&& is_map([1, 2, 3]) === false
		&& is_map({ foo: "bar" }) === false
	);
});

test("map", () => {
	return is_map(map(() => {})) === true;
});

test("unsuspended promise", () => {
	const promise = unsuspended_promise(map(() => {}));
	return is_map(promise) === false;
});
