const count_instances = (string, substring) => {
	return string.split(substring).length - 1;
};

const count_once = (string, substring) => {
	return string.includes(substring) ? 1 : 0;
};

/**
 * @todo make a better version of this.
 * 
 * Warning: The past-in objects are mutated, please pass in a copy if necessary.
 */
export const simple_search = (array, query, options) => {
	options ??= {};
	options.portion_size ??= 4;
	options.keys ??= [{
		key: "key",
		weight: 1,
	}];
	options.max_results ??= 5;
	
	const { portion_size, keys, max_results } = options;

	let portions = [];

	for (let i = 0; i < query.length - (portion_size - 1); i++) {
		portions.push(query.substring(i, i + portion_size));
	}

	for (let entry of array) {
		let score = 0;
		for (let portion of portions) {
			for (let key of keys) {
				score += count_once(entry[key.key], portion) * (key.weight ?? 1);
			}
		}
		
		entry.score = score;
	}

	return array.filter(entry => entry.score !== 0).map(entry => ({ ...entry })).sort((a, b) => b.score - a.score).slice(0, max_results);
};
