export const test = async (name, test) => {
	let result;

	try {
		result = await test();
	} catch(e) {
		console.error(`💥 ${name}`);
		console.error(e);
	}

	if (result === true) {
		console.log(`✅ ${name}`);
	} else {
		console.error(`❌ ${name}`);
	}
};
