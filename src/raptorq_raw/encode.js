import { spawn } from "child_process";
import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";

export const encode = ({ binary_path }, { options, data }) => {
	options ??= {};
	options.symbol_size ??= 1400;
	options.num_repair_symbols ??= 15;
	options.num_source_blocks ??= 1;
	options.num_sub_blocks ??= 1;
	options.symbol_alignment ??= 8;

	if (!(data instanceof Uint8Array)) {
		throw_error(error_user_payload("Provided data must be Uint8Array."));
	}

	if (false
		|| typeof options.symbol_size !== "number"
		|| !Number.isInteger(options.symbol_size)
		|| options.symbol_size <= 0
		|| options.symbol_size > 65535
	) {
		throw_error(error_user_payload("Provided symbol_size must be non-zero uint16."));
	}

	// repair symbols should have no maximum!! i thought it was a fountain code! is rust package limiting me?

	if (false
		|| typeof options.num_repair_symbols !== "number"
		|| !Number.isInteger(options.num_repair_symbols)
		|| options.num_repair_symbols < 0
	) {
		throw_error(error_user_payload("Provided num_repair_symbols must be uint8."));
	}

	if (false
		|| typeof options.num_source_blocks !== "number"
		|| !Number.isInteger(options.num_source_blocks)
		|| options.num_source_blocks <= 0
		|| options.num_source_blocks > 255
	) {
		throw_error(error_user_payload("Provided num_source_blocks must be non-zero uint8."));
	}

	if (false
		|| typeof options.num_sub_blocks !== "number"
		|| !Number.isInteger(options.num_sub_blocks)
		|| options.num_sub_blocks <= 0
		|| options.num_sub_blocks > 65535
	) {
		throw_error(error_user_payload("Provided num_sub_blocks must be non-zero uint16."));
	}

	if (false
		|| typeof options.symbol_alignment !== "number"
		|| !Number.isInteger(options.symbol_alignment)
		|| options.symbol_alignment <= 0
		|| options.symbol_alignment > 255
	) {
		throw_error(error_user_payload("Provided symbol_alignment must be non-zero uint8."));
	}

	const args = [
		'--encode',
		'--symbol-size', options.symbol_size.toString(),
		'--repair-symbols', options.num_repair_symbols.toString(),
		'--source-blocks', options.num_source_blocks.toString(),
		'--sub-blocks', options.num_sub_blocks.toString(),
		'--symbol-alignment', options.symbol_alignment.toString()
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

	const encoding_symbol_size = options.symbol_size + 4; // PayloadId size is 4 bytes

	process.stdout.on('data', (chunk) => {
		if (!oti_resolved) {
			// Accumulate data until we have the full OTI
			oti_buffer.push(...chunk);
			received_bytes += chunk.length;

			if (oti_buffer.length >= OTI_SIZE) {
				// Extract OTI header
				const oti_data = new Uint8Array(oti_buffer.slice(0, OTI_SIZE));
				oti_resolver(oti_data);
				oti_resolved = true;

				// The rest is symbol data
				const remaining_data = oti_buffer.slice(OTI_SIZE);
				if (remaining_data.length > 0) {
					symbol_buffer.push(...remaining_data);

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
			}
		} else {
			// Process symbol data
			symbol_buffer.push(...chunk);

			const encoding_symbol_size = options.symbol_size + 4; // PayloadId size is 4 bytes per RFC 6330 and main.rs

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
