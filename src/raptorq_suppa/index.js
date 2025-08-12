import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { get_binary_path } from "../get_binary_path.js";
import { raptorq_raw } from "../raptorq_raw/index.js";
import { encode } from "./encode.js";
import { decode } from "./decode.js";

export const raptorq_suppa = {
	encode: (...args) => encode({
		raptorq_raw,
	}, ...args),
	decode: (...args) => decode({
		raptorq_raw,
	}, ...args),
};
