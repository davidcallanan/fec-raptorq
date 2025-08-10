export const create_interval = (period_ms, callback) => {
	const handle = setInterval(callback, period_ms);
	
	return {
		destroy: () => {
			clearInterval(handle);
		},
	};
};
