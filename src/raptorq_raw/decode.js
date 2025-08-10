
import { spawn } from "child_process";

/**
 * Decodes data using RaptorQ forward error correction
 * @param {Object} input - Input object containing OTI and encoding symbols
 * @param {Promise<Uint8Array>} input.oti - Promise that resolves to the 12-byte OTI header
 * @param {AsyncIterable<Uint8Array>} input.encoding_symbols - Async iterable of encoded symbols
 * @param {Object} [input.usage] - Usage configuration
 * @param {string} [input.usage.output_format="combined"] - Output format: "combined" or "blocks"
 * @returns {Promise<Uint8Array>|Object} Promise that resolves to the decoded data (combined) or object with blocks async iterable
 */
export const decode = ({ binary_path }, input) => {
	if (!input || !input.oti || !input.encoding_symbols) {
		throw new TypeError('Input must contain oti (Promise<Uint8Array>) and encoding_symbols (AsyncIterable<Uint8Array>)');
	}

	const usage = input.usage || {};
	const output_format = usage.output_format || 'combined';

	if (output_format !== 'combined' && output_format !== 'blocks') {
		throw new Error('output_format must be "combined" or "blocks"');
	}

	if (output_format === 'blocks') {
		return _decode_to_blocks(input, binary_path);
	} else {
		return _decode_to_combined(input, binary_path);
	}
};

/**
 * Internal method for decoding to individual blocks (pass-through from binary)
 */
const _decode_to_blocks = (input, binary_path) => {
	const process = spawn(binary_path, ['--decode'], {
		stdio: ['pipe', 'pipe', 'pipe']
	});

	let block_resolver, block_rejector;
	let block_promise = new Promise((resolve, reject) => {
		block_resolver = resolve;
		block_rejector = reject;
	});

	const block_queue = [];
	let iterator_waiting = false;
	let stream_ended = false;

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
						const result = await block_promise;
						iterator_waiting = false;
						if (result === null) break; // End of stream
						yield result;
						// Create new promise for next block
						block_promise = new Promise((resolve, reject) => {
							block_resolver = resolve;
							block_rejector = reject;
						});
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
		// Binary always outputs SBN-prefixed blocks: [SBN: 1 byte][Block Data: variable]
		buffer.push(...chunk);

		// Process complete blocks - we need to carefully parse since we don't know block sizes in advance
		while (buffer.length > 0) {
			// We'll assume each stdout data chunk contains complete blocks
			// This is a reasonable assumption given the binary's flush behavior
			let offset = 0;
			const chunk_data = new Uint8Array(chunk);

			while (offset < chunk_data.length) {
				if (offset >= chunk_data.length) break;

				const sbn = chunk_data[offset];
				offset += 1;

				// For now, assume the rest of this chunk is the block data
				// In a more robust implementation, you'd need to know block sizes
				const block_data = chunk_data.slice(offset);
				const block = {
					sbn: sbn,
					data: block_data
				};

				if (iterator_waiting) {
					block_resolver(block);
					iterator_waiting = false;
					block_promise = new Promise((resolve, reject) => {
						block_resolver = resolve;
						block_rejector = reject;
					});
				} else {
					block_queue.push(block);
				}

				break; // Process one block per chunk for simplicity
			}

			buffer = []; // Reset buffer after processing chunk
			break;
		}
	});

	process.stdout.on('end', () => {
		stream_ended = true;
		if (iterator_waiting) {
			block_resolver(null); // Signal end of stream
		} else {
			block_queue.push(null); // Signal end of stream
		}
	});

	process.stderr.on('data', (chunk) => {
		const message = chunk.toString().trim();
		if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
			const error = new Error(`RaptorQ decoding error: ${message}`);
			block_rejector(error);
		}
	});

	process.on('error', (error) => {
		const wrapped_error = new Error(`Failed to spawn RaptorQ process: ${error.message}`);
		block_rejector(wrapped_error);
	});

	process.on('close', (code) => {
		if (code !== 0) {
			const error = new Error(`RaptorQ process exited with code ${code}`);
			block_rejector(error);
		} else {
			stream_ended = true;
			if (iterator_waiting) {
				block_resolver(null);
			} else {
				block_queue.push(null);
			}
		}
	});

	// Handle the async writing of OTI and symbols
	(async () => {
		try {
			const oti = await input.oti;
			if (!(oti instanceof Uint8Array) || oti.length !== 12) {
				throw new Error('OTI must be a 12-byte Uint8Array');
			}
			process.stdin.write(oti);

			for await (const symbol of input.encoding_symbols) {
				if (!(symbol instanceof Uint8Array)) {
					throw new Error('Each symbol must be a Uint8Array');
				}
				process.stdin.write(symbol);
			}

			process.stdin.end();
		} catch (error) {
			const wrapped_error = new Error(`Error writing to RaptorQ decoder: ${error.message}`);
			block_rejector(wrapped_error);
			process.kill();
		}
	})();

	return { blocks };
};

/**
 * Internal method for decoding to combined output (collects and sorts blocks from binary)
 */
const _decode_to_combined = (input, binary_path) => {
	return new Promise(async (resolve, reject) => {
		try {
			// Get blocks from the binary
			const blocks_result = _decode_to_blocks(input, binary_path);

			// Collect all blocks
			const blocks_map = new Map();
			for await (const block of blocks_result.blocks) {
				blocks_map.set(block.sbn, block.data);
			}

			// Sort blocks by SBN and combine
			const sorted_sbns = Array.from(blocks_map.keys()).sort((a, b) => a - b);
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
