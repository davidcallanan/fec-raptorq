import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { get_binary_path } from "../get_binary_path.js";
import { encode } from "./encode.js";
import { decode } from "./decode.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, "..", "..");
const binary_path = get_binary_path({ os, path }, root);

export const raptorq_raw = {
	encode: (...args) => encode({
		binary_path,
	}, ...args),
	decode: (...args) => decode({
		binary_path,
	}, ...args),
};
