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
export const create_promise = <T>(): [Promise<T>, (data: T) => void, (error: any) => void] => {
	let res: (data: T) => void;
	let rej: (error: any) => void;
	
	const promise = new Promise((res_: (data: T) => void, rej_ : (error: any) => void) => {
		res = res_;
		rej = rej_;
	});
	
	// @ts-ignore - res and rej are immediately assigned in the Promise constructor
	return [promise, res, rej];
}

export const createPromise = create_promise;
