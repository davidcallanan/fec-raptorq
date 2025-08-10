import { test } from "../test.js";
import { e } from "./e.js";
import { is_map } from "../is_map.js";
import { map } from "../map.js";
import { get_enum } from "../get_enum.js";
import { is_enum } from "../is_enum.js";

await test("constant", async () => {
	const number = 123n;
	return await e`${number}`() === number;
});

await test("true", async () => {
	return await e`true`() === true;
});

await test("false", async () => {
	return await e`false`() === false;
});

await test("int", async () => {
	return await e`1`() === 1n;
});

await test("float", async () => {
	return await e`1.23`() === 1.23;
});

await test("string", async () => {
	return await e`"foo"`() === "foo";
});

await test("addition", async () => {
	return await e`1 + 2 - 4 + 8`() === 7n;
});

await test("multiplication", async () => {
	return await e`1 * 2 / 4 * 8`() === 4n;
});

await test("long addition", async () => {
	const opening_balance = e`1000`;
	const sales = e`500`;
	const expenses = e`200`;

	const closing_balance = e`
	  + ${opening_balance}
	  + ${sales} 
	  - ${expenses}
	`;

	return await closing_balance() === 1300n;
});

await test("long multiplication", async () => {
	const gravitational_constant = e`0.67`;
	const mass_a = e`10.0`;
	const mass_b = e`5.0`;
	const distance = e`100.0`;

	const force = e`
	  * ${gravitational_constant}
	  * ${mass_a}
	  * ${mass_b}
	  / ${Math.pow(await distance(), 2)}
	`;

	return (await force()).toFixed(5) === "0.00335";
});

await test("negative number", async () => {
	return await e`-1`() === -1n;
});

await test("inverse number", async () => {
	return await e`/4.0`() === 0.25;
});

await test("logical or 1", async () => {
	return await e`
	  || false
	  || false
	  || false
	`() === false;
});

await test("logical or 2", async () => {
	return await e`
	  || false
	  || true
	  || false
	`() === true;
});

await test("logical and 1", async () => {
	return await e`
	  && false
	  && true
	  && false
	`() === false;
});

await test("logical and 2", async () => {
	return await e`
	  && true
	  && true
	  && true
	`() === true;
});

await test("logical not", async () => {
	return await e`!true`() === false && await e`!false`() === true;
});

await test("bare enum", async () => {
	const foo = await e`:foo`();
	return is_enum(foo) && foo.sym === "foo";
});

await test("nested bare enum", async () => {
	const foo = await e`:foo:bar`();
	return is_enum(foo) && foo.sym === "foo" && is_enum(foo.data) && foo.data.sym === "bar";
});

await test("empty tuple", async () => {
	const foo = e`()`;
	return is_map(foo);
});

await test("empty block", async () => {
	const foo = e`{}`;
	return is_map(foo);
});

await test("enum with empty map", async () => {
	e`:foo()`;
	e`:bar{}`;
	return true;
});

await test("comma positional tuple", async () => {
	const foo = e`("foo", "bar")`;
	return await foo[0]() === "foo" && await foo[1]() === "bar";
});

await test("semi positional tuple", async () => {
	const foo = e`(
		"foo";
		"bar";
	)`;

	return await foo[0]() === "foo" && await foo[1]() === "bar";
});

await test("comma named tuple", async () => {
	const foo = e`(:name "john doe", :age 27)`;
	return await foo.name() === "john doe" && await foo.age() === 27n;
});

await test("semi named tuple", async () => {
	const foo = e`(
		:name "john doe";
		:age 27;
	)`;

	return await foo.name() === "john doe" && await foo.age() === 27n;
});

await test("tuple parenthesis", async () => {
	const foo = e`(: 5 + 5)`;
	return await foo() === 10n;
});

await test("comma nested tuple", async () => {
	const foo = e`(:name:first "john", :name:last "doe", :age 27)`;
	return await foo.name.first() === "john" && await foo.name.last() === "doe" && await foo.age() === 27n;
});

await test("semi nested tuple", async () => {
	const foo = e`(
		:name:first "john";
		:name:last "doe";
		:age 27;
	)`;
	return await foo.name.first() === "john" && await foo.name.last() === "doe" && await foo.age() === 27n;
});

await test("nested tuple 2", async () => {
	const foo = e`(
		:friend:john (:name "doe", :age 27);
		:friend:joe (:name "dohn", :age 27);
	)`;

	return (true
		&& await foo.friend.john.name() === "doe"
		&& await foo.friend.john.age() === 27n
		&& await foo.friend.joe.name() === "dohn"
		&& await foo.friend.joe.age() === 27n
	);
});

await test("nested tuple 3", async () => {
	const foo = e`(
		:friend:john :human(:hair "black");
		:friend:joe :alien(:eyes "green");
	)`;

	return (true
		&& await get_enum(foo.friend.john).sym === "human"
		&& await get_enum(foo.friend.john).data.hair() === "black"
		&& await get_enum(foo.friend.joe).sym === "alien"
		&& await get_enum(foo.friend.joe).data.eyes() === "green"
	);
});

await test("block parenthesis", async () => {
	const foo = e`{: 5 + 5}`;
	return await foo() === 10n;
});

await test("constant map call", async () => {
	const result = e`${map(async (input) => {
		const value = await get_enum(input);
		return value.sym;
	})}:test`;
	
	return await result() === "test";
});

await test("self-referential variables", async () => {
	const foo = e`(
		:name first_name + " " + last_name;
		:first_name "john";
		:last_name "doe";
	)`;

	return await foo.name() === "john doe";
});

await test("variables", async () => {
	const foo = e`(
		x := 5;
		: x * 2;
	)`;

	return await foo() === 10n;
});

// Todo list
// - Variables
// x := 5
// - Map calls
// foo:bar
// foo:baz(5)
// - Api calls
// foo:bar!
// foo:baz(5)!
// - Self call
// - Owned contract calls
// - Tuple pattern match
// :foo(x, y, z) {...}
// :foo(: bar) {...}
// - Block pattern match
// - If statement
// if component == :position(x, y, z) {...}
// if component == :position {...}
// else if component == :velocity(x, y, z) {...}
// - Match statement
// - For loop
// - Break and continue
// - Return
// - Block syntax
