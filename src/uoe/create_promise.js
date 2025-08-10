/**
 * @stability 4 - locked
 * 
 * A nicer way to create promises. No-one can disagree.
 * 
 * @example
 * 
 * const [promise, res, rej] = create_promise();
 * 
 * (async () => {
 *   console.log(await promise);
 * })();
 * 
 * if (Math.random() > 0.5) {
 *   res("Hello, world!");
 * } else {
 *   rej(new Error());
 * }
 */
export const create_promise = () => {
	let res;
	let rej;
	
	const promise = new Promise((res_, rej_) => {
		res = res_;
		rej = rej_;
	});
	
	// @ts-ignore - res and rej are immediately assigned in the Promise constructor
	return [promise, res, rej];
}

export const createPromise = create_promise;
