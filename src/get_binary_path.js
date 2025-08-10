import { throw_error } from "./uoe/throw_error.js";
import { error_internal } from "./uoe/error_internal.js";

export const get_binary_path = (dependencies, root) => {
	const platform = dependencies.os.platform();
	const arch = dependencies.os.arch();
	const pair = `${platform}:${arch}`;

	const [dir, filename] = ({
		"win32:x64": ["x86_64-pc-windows-gnu", "raptorq.exe"],
		"linux:x64": ["x86_64-unknown-linux-gnu", "raptorq"],
		"linux:arm64": ["aarch64-unknown-linux-gnu", "raptorq"]
	})[pair] ?? [];

	if (false
		|| dir === undefined
		|| filename === undefined
	) {
		console.error("Unsupported target. See supported targets:");
		console.error("✅ Linux x86_64");
		console.error("✅ Linux aarch64");
		console.error("✅ Windows x86_64");
		console.error("❌ Windows aarch64 (Submit PR!)");
		console.error("❌ MacOS (Impossible? Licensing restrictions?)");
		console.error("❌ Web (WASM compilation possible? Fast enough? Submit PR!)");

		throw_error(error_internal(
			`Unsupported platform: ${platform}/${arch}. `
		));
	}

	return dependencies.path.join(root, "internal", "bin", dir, filename);
};
