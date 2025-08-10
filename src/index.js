import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Determines the correct binary path based on the current platform and architecture
 * @returns {string} The path to the appropriate RaptorQ binary
 * @throws {Error} If no suitable binary is found for the current platform
 */
function get_binary_path() {
	const platform = os.platform();
	const arch = os.arch();

	let target_dir;
	let binary_name;

	if (platform === 'win32' && arch === 'x64') {
		target_dir = 'x86_64-pc-windows-gnu';
		binary_name = 'raptorq.exe';
	} else if (platform === 'linux' && arch === 'x64') {
		target_dir = 'x86_64-unknown-linux-gnu';
		binary_name = 'raptorq';
	} else if (platform === 'linux' && arch === 'arm64') {
		target_dir = 'aarch64-unknown-linux-gnu';
		binary_name = 'raptorq';
	} else {
		console.error("Unsupported target. See supported targets:");
		console.error("✅ Linux x86_64");
		console.error("✅ Linux aarch64");
		console.error("✅ Windows x86_64");
		console.error("❌ Windows aarch64 (Submit PR!)");
		console.error("❌ MacOS (Impossible? Licensing restrictions?)");
		console.error("❌ Web (WASM compilation possible? Fast enough? Submit PR!)");
		throw new Error(
			`Unsupported platform/architecture: ${platform}/${arch}. `
		);
	}

	return path.join(__dirname, '..', 'internal', 'bin', target_dir, binary_name);
}

/**
 * Creates a readable stream from an async iterator
 */
class AsyncIteratorReadableStream {
	constructor(async_iterator) {
		this.iterator = async_iterator;
		this.reading = false;
	}

	async *[Symbol.asyncIterator]() {
		for await (const chunk of this.iterator) {
			yield chunk;
		}
	}
}

/**
 * Raw namespace containing low-level RaptorQ encoding and decoding functions
 */
const raptorq_raw = {
	/**
	 * Encodes data using RaptorQ forward error correction
	 * @param {Object} params - Parameters object
	 * @param {Object} [params.options] - Configuration object for encoding
	 * @param {number} [params.options.symbol_size=1400] - Size of each symbol in bytes (max: 65535)
	 * @param {number} [params.options.repair_symbols=15] - Number of repair symbols per source block
	 * @param {number} [params.options.source_blocks=1] - Number of source blocks (max: 255)
	 * @param {number} [params.options.sub_blocks=1] - Number of sub-blocks per source block (max: 65535)
	 * @param {number} [params.options.symbol_alignment=8] - Symbol alignment in bytes (1 or 8)
	 * @param {Uint8Array} params.data - The data to encode
	 * @returns {Object} An object containing oti (Promise<Uint8Array>) and encoding_symbols (AsyncIterable<Uint8Array>)
	 */
	encode({ options, data }) {
		// Default options to empty object if not provided
		options ??= {};

		if (!(data instanceof Uint8Array)) {
			throw new TypeError('Data must be a Uint8Array');
		}

		const {
			symbol_size = 1400,
			repair_symbols = 15,
			source_blocks = 1,
			sub_blocks = 1,
			symbol_alignment = 8
		} = options;

		// Validate parameters
		if (symbol_size > 65535) throw new Error('Symbol size cannot exceed 65535 bytes');
		if (source_blocks > 255) throw new Error('Source blocks cannot exceed 255');
		if (sub_blocks > 65535) throw new Error('Sub-blocks cannot exceed 65535');
		if (![1, 8].includes(symbol_alignment)) throw new Error('Symbol alignment must be 1 or 8');

		const binary_path = get_binary_path();

		const args = [
			'--encode',
			'--symbol-size', symbol_size.toString(),
			'--repair-symbols', repair_symbols.toString(),
			'--source-blocks', source_blocks.toString(),
			'--sub-blocks', sub_blocks.toString(),
			'--symbol-alignment', symbol_alignment.toString()
		];

		const process = spawn(binary_path, args, {
			stdio: ['pipe', 'pipe', 'pipe']
		});

		let oti_resolved = false;
		let oti_resolver, oti_rejector;
		const oti_promise = new Promise((resolve, reject) => {
			oti_resolver = resolve;
			oti_rejector = reject;
		});

		const symbol_buffer = [];
		let symbol_resolver, symbol_rejector;
		let symbol_promise = new Promise((resolve, reject) => {
			symbol_resolver = resolve;
			symbol_rejector = reject;
		});

		const symbol_queue = [];
		let iterator_waiting = false;

		const symbols = {
			async *[Symbol.asyncIterator]() {
				while (true) {
					if (symbol_queue.length > 0) {
						const symbol = symbol_queue.shift();
						if (symbol === null) break; // End of stream
						yield symbol;
					} else {
						iterator_waiting = true;
						try {
							const result = await symbol_promise;
							iterator_waiting = false;
							if (result === null) break; // End of stream
							yield result;
							// Create new promise for next symbol
							symbol_promise = new Promise((resolve, reject) => {
								symbol_resolver = resolve;
								symbol_rejector = reject;
							});
						} catch (error) {
							iterator_waiting = false;
							throw error;
						}
					}
				}
			}
		};

		let received_bytes = 0;
		let oti_buffer = [];
		const OTI_SIZE = 12;

		const encoding_symbol_size = symbol_size + 4; // PayloadId size is 4 bytes

		process.stdout.on('data', (chunk) => {
			console.log(`Encoder stdout received ${chunk.length} bytes:`, chunk);
			if (!oti_resolved) {
				// Accumulate data until we have the full OTI
				oti_buffer.push(...chunk);
				received_bytes += chunk.length;

				if (oti_buffer.length >= OTI_SIZE) {
					// Extract OTI header
					const oti_data = new Uint8Array(oti_buffer.slice(0, OTI_SIZE));
					console.log(`OTI extracted:`, oti_data);
					oti_resolver(oti_data);
					oti_resolved = true;

					// The rest is symbol data
					const remaining_data = oti_buffer.slice(OTI_SIZE);
					console.log(`Remaining data after OTI: ${remaining_data.length} bytes`);
					if (remaining_data.length > 0) {
						symbol_buffer.push(...remaining_data);
						console.log(`Symbol buffer now has ${symbol_buffer.length} bytes, need ${encoding_symbol_size} per symbol`);

						// Process complete symbols
						while (symbol_buffer.length >= encoding_symbol_size) {
							const symbol_data = symbol_buffer.splice(0, encoding_symbol_size);
							const symbol = new Uint8Array(symbol_data);
							console.log(`Yielding symbol of ${symbol.length} bytes`);

							if (iterator_waiting) {
								symbol_resolver(symbol);
								iterator_waiting = false;
								symbol_promise = new Promise((resolve, reject) => {
									symbol_resolver = resolve;
									symbol_rejector = reject;
								});
							} else {
								symbol_queue.push(symbol);
							}
						}
					}
				}
			} else {
				// Process symbol data
				symbol_buffer.push(...chunk);

				const encoding_symbol_size = symbol_size + 4; // PayloadId size is 4 bytes per RFC 6330 and main.rs

				// Process complete symbols
				while (symbol_buffer.length >= encoding_symbol_size) {
					const symbol_data = symbol_buffer.splice(0, encoding_symbol_size);
					const symbol = new Uint8Array(symbol_data);

					if (iterator_waiting) {
						symbol_resolver(symbol);
						iterator_waiting = false;
						symbol_promise = new Promise((resolve, reject) => {
							symbol_resolver = resolve;
							symbol_rejector = reject;
						});
					} else {
						symbol_queue.push(symbol);
					}
				}
			}
		});

		process.stdout.on('end', () => {
			symbol_resolver(null); // Signal end of stream
		});

		process.stderr.on('data', (chunk) => {
			// RaptorQ writes status messages to stderr, not errors
			// Only treat as error if the message looks like an actual error
			const message = chunk.toString().trim();
			if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
				const error = new Error(`RaptorQ encoding error: ${message}`);
				if (!oti_resolved) {
					oti_rejector(error);
				}
				symbol_rejector(error);
			}
			// Otherwise ignore status messages
		});

		process.on('error', (error) => {
			const wrapped_error = new Error(`Failed to spawn RaptorQ process: ${error.message}`);
			if (!oti_resolved) {
				oti_rejector(wrapped_error);
			}
			symbol_rejector(wrapped_error);
		});

		process.on('close', (code) => {
			if (code !== 0) {
				const error = new Error(`RaptorQ process exited with code ${code}`);
				if (!oti_resolved) {
					oti_rejector(error);
				}
				symbol_rejector(error);
			} else {
				// Process completed successfully, end the symbol stream
				symbol_resolver(null); // null signals end of stream
			}
		});

		// Write data to process stdin immediately
		process.stdin.write(data);
		process.stdin.end();

		return {
			oti: oti_promise,
			encoding_symbols: symbols
		};
	},

	/**
	 * Decodes data using RaptorQ forward error correction
	 * @param {Object} input - Input object containing OTI and encoding symbols
	 * @param {Promise<Uint8Array>} input.oti - Promise that resolves to the 12-byte OTI header
	 * @param {AsyncIterable<Uint8Array>} input.encoding_symbols - Async iterable of encoded symbols
	 * @returns {Promise<Uint8Array>} Promise that resolves to the decoded data
	 */
	decode(input) {
		if (!input || !input.oti || !input.encoding_symbols) {
			throw new TypeError('Input must contain oti (Promise<Uint8Array>) and encoding_symbols (AsyncIterable<Uint8Array>)');
		}

		const binary_path = get_binary_path();

		return new Promise(async (resolve, reject) => {
			const process = spawn(binary_path, ['--decode'], {
				stdio: ['pipe', 'pipe', 'pipe']
			});

			const output_chunks = [];

			process.stdout.on('data', (chunk) => {
				output_chunks.push(new Uint8Array(chunk));
			});

			process.stdout.on('end', () => {
				// Combine all chunks into a single Uint8Array
				const total_length = output_chunks.reduce((sum, chunk) => sum + chunk.length, 0);
				const result = new Uint8Array(total_length);
				let offset = 0;
				for (const chunk of output_chunks) {
					result.set(chunk, offset);
					offset += chunk.length;
				}
				resolve(result);
			});

			process.stderr.on('data', (chunk) => {
				// RaptorQ writes status messages to stderr, not errors
				// Only treat as error if the message looks like an actual error
				const message = chunk.toString().trim();
				if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
					reject(new Error(`RaptorQ decoding error: ${message}`));
				}
				// Otherwise ignore status messages
			});

			process.on('error', (error) => {
				reject(new Error(`Failed to spawn RaptorQ process: ${error.message}`));
			});

			process.on('close', (code) => {
				if (code !== 0) {
					reject(new Error(`RaptorQ process exited with code ${code}`));
				}
			});

			// Handle the async writing of OTI and symbols
			try {
				// First, write the OTI header
				const oti = await input.oti;
				if (!(oti instanceof Uint8Array) || oti.length !== 12) {
					throw new Error('OTI must be a 12-byte Uint8Array');
				}
				process.stdin.write(oti);

				// Then, write all the encoding symbols
				for await (const symbol of input.encoding_symbols) {
					if (!(symbol instanceof Uint8Array)) {
						throw new Error('Each symbol must be a Uint8Array');
					}
					process.stdin.write(symbol);
				}

				// Close the input stream
				process.stdin.end();
			} catch (error) {
				reject(new Error(`Error writing to RaptorQ decoder: ${error.message}`));
				process.kill();
			}
		});
	}
};

export { raptorq_raw };
