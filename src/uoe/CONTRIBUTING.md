# Contributing

Contributions that fix bugs are very much welcome and appreciated. This document sets out the programming guidelines for contributions.

Where contributions add functionality to existing features, they will undergo strict evaluation. I am very particular about the architectural considerations that motivative new functionality, so there is no guarantee that a contribution will be accepted.

Where contributions add entirely new features, they are unlikely to be considered.

## Style Guidelines

### Language

Both JavaScript and TypeScript files are acceptable.

### Imports

Imports must include the extension of the file being imported.

### Filenames

The name of a `.js` or `.ts` file must be in `snake_case` and must exactly match the primary named-export of the file.

### Naming convention

Abbreviations should be seldom used, unless widely understood.

Acronyms that are in camel-case must be written like `Http` instead of `HTTP`.

Internally, all variables must be in `snake_case`.

However, classes and types should be in `UpperCamelCase`.

Constants at the top level should usually be in `UPPER_SNAKE_CASE` but can sometimes be in `lower_snake_case`. In particular, if the programmer-inferred type of the constant is just the value itself, it should be in `UPPER_SNAKE_CASE`. If other values are expected to work with the constant without modification to the rest of the code, and its programmer-inferred type is reasonably obvious, it may be written in `lower_snake_case`.

Exported variables must be in both `snake_case` and `lowerCamelCase` to favour developer choice for library users.

### Operations

For associative or [boundly associative](https://medium.com/@davidcallanan/rethinking-operation-order-the-illusion-of-ambiguity-and-the-introduction-of-bound-pairs-ceef5242a941) expressions (involving e.g. `+`/`-`, `*`/`/`, `&&`/`||`), at most two operands may be included on one line.

Otherwise, the expression must be formatted as one entry per line, where an operator-operand pair is considered one entry.

The identity element must be included at the beginning of the expression, except for additive expressions which have favourable language support.

**Example: Additive expressions**

```
const total =
   + income
   - income_tax
   - expenditure
;
```
**Example: Multiplicative expressions**

```
const gravitational_force = (1
	* gravitational_constant
	* mass_a
	* mass_b
	/ Math.pow(distance, 2)
);
```

**Example: Logical AND expressions**

```
if (true
	&& is_legal
	&& is_ethical
	&& is_constructive
) {
}
```

**Example: Logical OR expressions**

```
if (false
	|| is_illegal
	|| is_unethical
	|| is_destructive
) {
}
```

### Trailing commas

Trailing commas are required in all legal places provided the expression is being formatted as one entry per line.

This includes, but is not limited to, array literals, object literals and function arguments that span multiple lines.
