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
		let process_closed = false;

		// Track when process closes so we can stop writing
		process.on('close', () => {
			process_closed = true;
		});

		process.on('exit', () => {
			process_closed = true;
		});

		// Handle stdin errors (like EPIPE when process closes early)
		process.stdin.on('error', (error) => {
			if (error.code === 'EPIPE') {
				// Process closed early (likely finished decoding) - this is normal
				console.log('RaptorQ decoder closed stdin (decoding complete)');
				process_closed = true;
			} else {
				// Other errors should be propagated
				const wrapped_error = new Error(`Error writing to RaptorQ decoder stdin: ${error.message}`);
				block_rej(wrapped_error);
			}
		});

		try {
			const oti = input.oti;
			if (!(oti instanceof Uint8Array) || oti.length !== 12) {
				throw new Error('OTI must be a 12-byte Uint8Array');
			}

			// Write OTI
			if (!process_closed && !process.stdin.destroyed) {
				process.stdin.write(oti);
			}

			// Write symbols, but stop if process closes
			for await (const symbol of input.encoding_packets) {
				// Check if process has closed before writing each symbol
				if (process_closed || process.stdin.destroyed) {
					console.log('Stopping symbol writing - decoder process closed');
					break;
				}

				if (!(symbol instanceof Uint8Array)) {
					throw new Error('Each symbol must be a Uint8Array');
				}

				// Use a promise to detect write failures
				try {
					const write_successful = process.stdin.write(symbol);
					if (!write_successful) {
						// Wait for drain event or process close
						await new Promise((resolve) => {
							const onDrain = () => {
								process.stdin.removeListener('close', onClose);
								resolve();
							};
							const onClose = () => {
								process.stdin.removeListener('drain', onDrain);
								process_closed = true;
								resolve();
							};
							process.stdin.once('drain', onDrain);
							process.stdin.once('close', onClose);
						});
					}
				} catch (write_error) {
					if (write_error.code === 'EPIPE') {
						console.log('EPIPE detected - decoder finished, stopping symbol feed');
						break;
					}
					throw write_error;
				}
			}

			// Only end stdin if process is still running and stdin is not destroyed
			if (!process_closed && !process.stdin.destroyed) {
				process.stdin.end();
			}
		} catch (error) {
			// Don't log EPIPE errors as they're expected when decoder finishes early
			if (error.code !== 'EPIPE') {
				console.error('Error in RaptorQ decoder symbol writer:', error);
				const wrapped_error = new Error(`Error writing to RaptorQ decoder: ${error.message}`);
				block_rej(wrapped_error);
			}

			// Try to kill process if it's still running
			if (!process_closed && !process.killed) {
				process.kill();
			}
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
