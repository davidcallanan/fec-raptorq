// My old library I used to use for simple parsing.
// Definitely needs to be freshened up.

export function str(string) {
	return (input) => {
		if (input.startsWith(string)) {
			return {
				success: true,
				input: input.substring(string.length),
				data: string,
			};
		} else {
			return {
				success: false,
			};
		}
	};
}

export function reg(re) {
	return (input) => {
		let match = input.match(re);
		if (re.toString() == "/^(?!\n)/s") {
			console.log(re);
			console.log(match);
		}

		if (match) {
			let all = match[0];
			let offset = match.index + all.length;
			let groups = { all: match[0], };

			for (let i = 1; i < match.length; i++) {
				groups[i - 1] = match[i];
			}

			for (let key in match.groups) {
				groups[key] = match.groups[key];
			}
			
			return {
				success: true,
				input: input.substring(offset),
				data: { groups },
			}
		} else {
			return {
				success: false,
			};
		}
	};
}

export function auto(parser) {
	if (typeof parser === "string") {
		return str(parser);
	} else if (parser instanceof RegExp) {
		return reg(parser);
	} else {
		return parser;
	}
}

export function join(...parsers) {
	parsers = parsers.map(parser => auto(parser));

	return (input) => {
		let data = [];

		for (let parser of parsers) {
			let result = parser(input);

			if (result.success) {
				input = result.input;
				data.push(result.data);
			} else {
				return {
					success: false,
				};
			}
		}

		return {
			success: true,
			input,
			data,
		};
	};
}

export function join_collect(...parserFactories) {
	return (input) => {
		let data = [];

		for (let parserFactory of parserFactories) {
			let parser = auto(parserFactory(data[data.length - 1]));
			let result = parser(input);

			if (result.success) {
				input = result.input;
				data.push(result.data);
			} else {
				return {
					success: false,
				};
			}
		}

		return {
			success: true,
			input,
			data,
		};
	};
}

export function opt(parser) {
	parser = auto(parser);

	return (input) => {
		let result = parser(input);

		if (result.success) {
			return result;
		} else {
			return {
				success: true,
				ignored_failure: true,
				input,
				// data: result.data,
			};
		}
	};
}

function internal_multi(parser) {
	parser = auto(parser);

	return (input) => {
		let data = [];

		while (true) {
			let result = parser(input);

			if (result.success) {
				input = result.input;
				data.push(result.data);
			} else {
				if (data.length == 0) {
					return {
						success: false,
						input,
						data,
					};
				} else {
					return {
						success: true,
						input,
						data,
					};
				}
			}
		}
	};
}

export function multi_2(parser, sep) {
	if (!sep) {
		return internal_multi(parser);
	} else {
		// return mapData(opt(join(parser, internal_multi(join(sep, parser)))), result => result ? [
		// 	result[0],
		// 	...result[1].map(r => r[1]),
		// ] : []);
		return mapData(join(parser, opt(internal_multi(join(sep, parser)))), result => [
			// ...result.data ? [result.data[0]] : [],
			// ...result.data ? [result.data[1].map(r => r[1])] : [],
			result[0],
			...result[1] ? result[1].map(r => r[1]) : []
			// ...result[1].map(r => r[1]),
		]);
	}
}

export function multi(parser, sep) {
	return mapData(multi_2(parser, sep), data => {
		return data;
	})
}

export function opt_multi(parser, sep) {
	return map(opt(multi(parser, sep)), result => ({
		...result,
		data: result.ignored_failure ? [] : result.data,
	}));
}

export function grab(parser, count) {
	if (count <= 0) {
		return (input) => {
			return {
				success: true,
				input,
				data: [],
			}
		};
	}

	parser = auto(parser);

	return (input) => {
		let data = [];

		for (let i = 0; i < count; i++) {
			let result = parser(input);

			if (result.success) {
				input = result.input;
				data.push(result.data);
			} else {
				if (data.length < count) {
					return {
						success: false,
						input,
						data,
					};
				}
			}
		}
		
		return {
			success: true,
			input,
			data,
		};
	};
}

export function orv(...parsers) {
	parsers = parsers.map(parser => auto(parser));

	return (input) => {
		for (let i = 0; i < parsers.length; i++) {
			let parser = parsers[i];
			let result = parser(input);

			if (result.success) {
				return {
					success: true,
					input: result.input,
					data: {
						idx: i,
						choice: result.data,
					},
				}
			}
		}

		return {
			success: false,
		};
	};
}

export function or(...parsers) {
	return mapData(orv(...parsers), data => data.choice);
}

export function map(parser, mapper) {
	parser = auto(parser);

	return (input) => {
		return mapper(parser(input));
	}
}

export function lookAhead(parser) {
	parser = auto(parser);
	
	return (input) => {
		return {
			...parser(input),
			input,
		};
	};
}

export function mapData(parser, mapper) {
	parser = auto(parser);

	return map(parser, (result) => ({
		...result,
		...result.success && {
			data: mapper(result.data),
		},
	}));
}

export function declare() {
	let parser;

	let result = (input) => {
		return parser(input);
	};

	result.define = (parser_) => {
		parser = parser_;
	};
	
	return result;
}
