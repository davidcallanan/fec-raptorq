/**
 * @stability 2 - provisional
 * 
 * Creates a file with the desired data if it does not already exist.
 */
export const create_default_file = async (dependencies, path, data) => {
	try {
		await dependencies.fs.writeFile(path, data, { flag: "wx" });
	} catch (e) {
		if (e.code === "EEXIST") {
			return;
		}

		throw e;
	}
};

export const createDefaultFile = create_default_file;
