import { spawn } from "child_process";

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
export const encode = ({ binary_path }, { options, data }) => {
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
};
