import { create_promise } from "./create_promise.js";

/**
 * Creates a pub-sub where values are discarded for a subscriber if the subscriber is not actively consuming values.
 * However, the latest value will not be discarded and will remain available for when consumption resumes.
 * 
 * This is useul when a subscriber needs to continuously process latest values sequentially, but does not need to process intermediate values produced during active processing.
 * In some sense, you can think of the newer values as being "debounced" until the subscriber has finished processing the previous value.
 *
 * @example
 * 
 * const { subscribe, publish } = create_discarding_pub_sub();
 * 
 * (async () => {
 *   await timeout(500);
 *   publish({ value: 1 });
 *   await timeout(500);
 *   publish({ value: 2, done: true });
 * })();
 * 
 * for await (let value of subscribe()) {
 *   console.log(value);
 * }
 */
export const create_discarding_pub_sub = () => {
	let last_data;
	let resolvers = [];

	const subscribe = async function* () {
		let last_seen_data;

		const set_last_seen_data = (value) => {
			last_seen_data = value;
		};

		while (true) {
			if (last_seen_data !== last_data) {
				last_seen_data = last_data;
				let { value, done } = last_data;

				if (done) {
					return;
				}

				yield value;
				continue;
			}

			let [promise, res, _rej] = create_promise();
			resolvers.push([res, set_last_seen_data]);
			let { value, done } = await promise;

			if (done) {
				return;
			}

			yield value;
		}
	};

	const publish = ({ value, done }) => {
		done ?? false;
		let data = { value, done };
		last_data = data;
		
		for (let [res, set_last_seen_data] of resolvers) {
			set_last_seen_data(data);
			res(data);
		}

		resolvers = [];
	};

	return { subscribe, publish };
};

export const createDiscardingPubSub = create_discarding_pub_sub;
