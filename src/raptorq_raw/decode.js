import { spawn } from "child_process";
import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import { create_promise } from "../uoe/create_promise.js";

const decode_blocks = ({ binary_path }, input) => {
	const process = spawn(binary_path, ["--decode"], {
		stdio: ["pipe", "pipe", "pipe"],
	});

	let [block_prom, block_res, block_rej] = create_promise();

	const block_queue = [];
	let iterator_waiting = false;
	let stream_ended = false;
	const seen_sbns = new Set(); // Track duplicate SBNs

	const blocks = {
		async *[Symbol.asyncIterator]() {
			while (true) {
				if (block_queue.length > 0) {
					const block = block_queue.shift();
					if (block === null) break; // End of stream
					yield block;
				} else if (stream_ended) {
					break;
				} else {
					iterator_waiting = true;
					try {
						const result = await block_prom;
						iterator_waiting = false;
						if (result === null) break; // End of stream
						yield result;
						// Create new promise for next block
						[block_prom, block_res, block_rej] = create_promise();
					} catch (error) {
						iterator_waiting = false;
						throw error;
					}
				}
			}
		}
	};

	let buffer = [];

	process.stdout.on('data', (chunk) => {
		// Binary now outputs blocks with format: [SBN: 1 byte][Block Size: 4 bytes, little-endian][Block Data: variable]
		buffer.push(...chunk);

		// Process complete blocks - we now know exact block sizes from the size header
		while (buffer.length >= 5) { // Need at least SBN + size header
			// Read SBN (1 byte)
			const sbn = BigInt(buffer[0]);

			// Read block size (4 bytes, little-endian) using BigInt for safe operations
			const block_size = BigInt(buffer[1]) | (BigInt(buffer[2]) << 8n) | (BigInt(buffer[3]) << 16n) | (BigInt(buffer[4]) << 24n);

			// Check if we have the complete block
			const total_block_length = 5n + block_size; // 1 (SBN) + 4 (size) + block_size (data)
			if (BigInt(buffer.length) < total_block_length) {
				break; // Wait for more data
			}

			// Extract block data
			const block_data = new Uint8Array(buffer.slice(5, Number(total_block_length)));

			// Check for duplicate SBNs
			if (seen_sbns.has(sbn)) {
				console.warn(`⚠️  DUPLICATE SBN DETECTED: SBN ${sbn} already processed! This should never happen in RaptorQ. Skipping duplicate.`);
				console.warn(`Previous SBNs seen: ${Array.from(seen_sbns).join(", ")}`);

				// Skip the duplicate block - remove the processed bytes and continue
				buffer = buffer.slice(Number(total_block_length));
				continue;
			} else {
				seen_sbns.add(sbn);
			}

			const block = {
				sbn: sbn,
				data: block_data,
			};

			// Send block to iterator
			if (iterator_waiting) {
				block_res(block);
				iterator_waiting = false;
				[block_prom, block_res, block_rej] = create_promise();
			} else {
				block_queue.push(block);
			}

			// Remove processed block from buffer
			buffer.splice(0, Number(total_block_length));
		}
	});

	process.stdout.on('end', () => {
		stream_ended = true;
		if (iterator_waiting) {
			block_res(null); // Signal end of stream
		} else {
			block_queue.push(null); // Signal end of stream
		}
	});

	process.stderr.on('data', (chunk) => {
		const message = chunk.toString().trim();
		if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
			const error = new Error(`RaptorQ decoding error: ${message}`);
			block_rej(error);
		}
	});

	process.on('error', (error) => {
		const wrapped_error = new Error(`Failed to spawn RaptorQ process: ${error.message}`);
		block_rej(wrapped_error);
	});

	process.on('close', (code) => {
		if (code !== 0) {
			const error = new Error(`RaptorQ process exited with code ${code}`);
			block_rej(error);
		} else {
			stream_ended = true;
			if (iterator_waiting) {
				block_res(null);
			} else {
				block_queue.push(null);
			}
		}
	});

	// Handle the async writing of OTI and symbols
	(async () => {
		try {
			const oti = input.oti;
			if (!(oti instanceof Uint8Array) || oti.length !== 12) {
				throw new Error('OTI must be a 12-byte Uint8Array');
			}
			process.stdin.write(oti);

			for await (const symbol of input.encoding_packets) {
				if (!(symbol instanceof Uint8Array)) {
					throw new Error('Each symbol must be a Uint8Array');
				}
				process.stdin.write(symbol);
			}

			process.stdin.end();
		} catch (error) {
			console.error(error);
			const wrapped_error = new Error(`Error writing to RaptorQ decoder: ${error.message}`);
			block_rej(wrapped_error);
			process.kill();
		}
	})();

	return { blocks };
};

const decode_combined = ({ binary_path }, input) => {
	return new Promise(async (resolve, reject) => {
		try {
			// Get blocks from the binary
			const blocks_result = decode_blocks({ binary_path }, input);

			// Collect all blocks
			const blocks_map = new Map();
			for await (const block of blocks_result.blocks) {
				blocks_map.set(block.sbn, block.data);
			}

			// Sort blocks by SBN and combine
			const sorted_sbns = Array.from(blocks_map.keys()).sort((a, b) => Number(a - b));
			const combined_blocks = sorted_sbns.map(sbn => blocks_map.get(sbn));

			// Calculate total length and combine
			const total_length = combined_blocks.reduce((sum, block) => sum + block.length, 0);
			const result = new Uint8Array(total_length);
			let offset = 0;

			for (const block of combined_blocks) {
				result.set(block, offset);
				offset += block.length;
			}

			resolve(result);
		} catch (error) {
			reject(error);
		}
	});
};

export const decode = ({ binary_path }, { usage, oti, encoding_packets }) => {
	usage ??= {};
	usage.output_format ??= "combined";

	if (false
		|| !(oti instanceof Uint8Array)
		|| oti.length !== 12
	) {
		throw_error(error_user_payload("Provided oti must be 12-byte Uint8Array."));
	}

	if (false
		|| !encoding_packets
		|| typeof encoding_packets[Symbol.asyncIterator] !== "function"
	) {
		throw_error(error_user_payload("Provided encoding_packets must be iterable."));
	}

	if (false
		|| !["combined", "blocks"].includes(usage.output_format)
	) {
		throw_error(error_user_payload("Provided output_format must be \"combined\" or \"blocks\"."));
	}

	if (usage.output_format === "blocks") {
		return decode_blocks({ binary_path }, { oti, encoding_packets });
	} else {
		return decode_combined({ binary_path }, { oti, encoding_packets });
	}
};
