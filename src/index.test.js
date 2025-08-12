import { test } from "./uoe/test.js";
import { compare_bytes } from "./uoe/compare_bytes.js";
import { raptorq_raw as raw, raptorq_suppa as suppa } from "./index.js";

// Helper function to create test data
function createTestData(size = 1000) {
	const data = new Uint8Array(size);
	for (let i = 0; i < size; i++) {
		data[i] = i % 256;
	}
	return data;
}

// Helper function to compare two Uint8Arrays
function arraysEqual(a, b) {
	return compare_bytes(a, b);
}

// Test basic encoding functionality
test("raw.encode - basic encoding returns oti and symbols", async () => {
	const testData = createTestData(100);
	const result = raw.encode({ options: {}, data: testData });

	// Check that result has the expected structure
	if (!result.oti || !result.encoding_packets) {
		return false;
	}

	// Check that oti is a promise
	if (!(result.oti instanceof Promise)) {
		return false;
	}

	// Check that encoding_packets is an async iterable
	if (typeof result.encoding_packets[Symbol.asyncIterator] !== 'function') {
		return false;
	}

	try {
		// Verify OTI is 12 bytes
		const oti = await result.oti;
		if (!(oti instanceof Uint8Array) || oti.length !== 12) {
			return false;
		}

		// Verify we can collect all symbols
		let symbolCount = 0;
		console.log("Test: Starting to iterate over encoding packets...");

		// Calculate expected number of symbols
		// For 100 bytes with default symbol_size (1400), we expect 1 source symbol + 15 repair symbols = 16 total
		const expectedSymbolCount = Math.ceil(testData.length / 1400) + 15; // source symbols + repair symbols

		for await (const symbol of result.encoding_packets) {
			console.log(`Test: Received symbol ${symbolCount + 1}, type: ${typeof symbol}, instance: ${symbol instanceof Uint8Array}, length: ${symbol?.length}`);
			if (!(symbol instanceof Uint8Array)) {
				console.log("Test: Symbol is not Uint8Array, failing test");
				return false;
			}
			symbolCount++;
		}
		// Verify we got the expected number of symbols
		if (symbolCount !== expectedSymbolCount) {
			console.log(`Test: Symbol count mismatch - got ${symbolCount}, expected ${expectedSymbolCount}`);
			return false;
		}
		console.log(`Test: Collected ${symbolCount} symbols total`);

		return symbolCount > 0;
	} catch (error) {
		console.error("Encoding test error:", error);
		return false;
	}
});

// Test encoding with custom configuration
test("raw.encode - custom configuration", async () => {
	const testData = createTestData(500);
	const config = {
		symbol_size: 800,
		num_repair_symbols: 10,
		num_source_blocks: 1,
		num_sub_blocks: 1,
		symbol_alignment: 8
	};

	try {
		const result = raw.encode({ options: config, data: testData });
		const oti = await result.oti;

		// Verify OTI structure
		if (!(oti instanceof Uint8Array) || oti.length !== 12) {
			return false;
		}

		// Verify we can get all symbols
		let symbolCount = 0;

		// Calculate expected number of symbols based on configuration
		// For 500 bytes with symbol_size 800: 1 source symbol + 10 repair symbols = 11 total
		const expectedSymbolCount = Math.ceil(testData.length / config.symbol_size) + config.num_repair_symbols;

		for await (const symbol of result.encoding_packets) {
			symbolCount++;
			// Expected symbol size is symbol_size + 4 (for PayloadId)
			if (symbol.length !== config.symbol_size + 4) {
				return false;
			}
		}

		// Verify we got the expected number of symbols
		if (symbolCount !== expectedSymbolCount) {
			console.log(`Custom config test: Symbol count mismatch - got ${symbolCount}, expected ${expectedSymbolCount}`);
			return false;
		}

		return symbolCount > 0;
	} catch (error) {
		console.error("Custom config test error:", error);
		return false;
	}
});

// Test decoding functionality
test("raw.decode - basic decoding", async () => {
	const testData = createTestData(200);

	try {
		// First encode the data
		const encoded = raw.encode({ options: { symbol_size: 104 }, data: testData }); // 104 is divisible by 8

		// Collect the encoded data
		const oti = await encoded.oti;
		const symbols = [];
		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
		}

		// Create mock async iterator for symbols
		const symbolIterator = {
			async *[Symbol.asyncIterator]() {
				for (const symbol of symbols) {
					yield symbol;
				}
			}
		};

		// Now decode
		const decoded = raw.decode({
			oti: oti,
			encoding_packets: symbolIterator
		});

		// Wait for the decoded data
		const decodedData = await decoded;

		// Verify the decoded data matches original
		return arraysEqual(testData, decodedData);

	} catch (error) {
		console.error("Decoding test error:", error);
		return false;
	}
});

// Test round-trip encoding and decoding
test("raw encode/decode - round trip with small data", async () => {
	const originalData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

	try {
		// Encode
		const encoded = raw.encode({ options: { symbol_size: 48, num_repair_symbols: 5 }, data: originalData }); // 48 is divisible by 8
		const oti = await encoded.oti;

		// Collect symbols
		const symbols = [];
		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
		}

		// Decode
		const symbolIterator = {
			async *[Symbol.asyncIterator]() {
				for (const symbol of symbols) {
					yield symbol;
				}
			}
		};

		const decoded = raw.decode({
			oti: oti,
			encoding_packets: symbolIterator
		});

		// Wait for decoded data and verify
		const decodedData = await decoded;

		return arraysEqual(originalData, decodedData);

	} catch (error) {
		console.error("Round trip test error:", error);
		return false;
	}
});

// Test block-by-block decoding
test("raw decode - block output format", async () => {
	const originalData = createTestData(200);

	try {
		// Encode the data with multiple source blocks for better testing
		const encoded = raw.encode({
			options: {
				symbol_size: 48,
				num_repair_symbols: 5,
				num_source_blocks: 2  // Use 2 blocks to test block output
			},
			data: originalData
		});

		// Collect the encoded data
		const oti = await encoded.oti;
		const symbols = [];
		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
		}

		// Create mock async iterator for symbols
		const symbolIterator = {
			async *[Symbol.asyncIterator]() {
				for (const symbol of symbols) {
					yield symbol;
				}
			}
		};

		// Decode with block format
		const decoded = raw.decode({
			usage: {
				output_format: "blocks"
			},
			oti,
			encoding_packets: symbolIterator
		});

		// Verify result has blocks async iterable
		if (!decoded.blocks || typeof decoded.blocks[Symbol.asyncIterator] !== 'function') {
			return false;
		}

		// Collect blocks
		const blocks = [];
		for await (const block of decoded.blocks) {
			if (typeof block.sbn !== 'number' || !(block.data instanceof Uint8Array)) {
				return false;
			}
			blocks.push(block);
		}

		// Should have received at least one block
		if (blocks.length === 0) {
			return false;
		}

		// Verify block SBNs are valid (0-based)
		for (const block of blocks) {
			if (block.sbn < 0 || block.sbn > 255) {
				return false;
			}
		}

		return true;

	} catch (error) {
		console.error("Block decoding test error:", error);
		return false;
	}
});

// Test invalid output format
test("raw decode - invalid output format", () => {
	try {
		const testData = createTestData(100);

		// This should throw
		try {
			raw.decode({
				usage: {
					output_format: "invalid"
				},
				oti: new Uint8Array(12),
				encoding_packets: {
					async *[Symbol.asyncIterator]() {
						yield new Uint8Array(10);
					}
				}
			});
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes('output_format must be')) return false;
		}

		return true;
	} catch (error) {
		console.error("Invalid format test error:", error);
		return false;
	}
});

// Test various symbol_alignment values (removed 1 or 8 restriction)
test("raw.encode - various symbol_alignment values", async () => {
	const testData = createTestData(200);
	const alignmentValues = [1, 2, 4, 5, 8, 16, 25, 40]; // Test various alignments including non-power-of-2

	for (const alignment of alignmentValues) {
		try {
			const config = {
				symbol_size: alignment * 10, // Ensure divisible by alignment
				num_repair_symbols: 5,
				num_source_blocks: 1,
				num_sub_blocks: 1,
				symbol_alignment: alignment
			};

			const result = raw.encode({ options: config, data: testData });
			const oti = await result.oti;

			// Verify OTI structure is valid
			if (!(oti instanceof Uint8Array) || oti.length !== 12) {
				return false;
			}

			// Verify we can get at least one symbol
			const iterator = result.encoding_packets[Symbol.asyncIterator]();
			const firstSymbol = await iterator.next();
			if (firstSymbol.done) {
				return false; // Should have at least one symbol
			}

		} catch (error) {
			console.error(`Symbol alignment ${alignment} failed:`, error);
			return false;
		}
	}

	return true;
});

console.log("🧪 Running RaptorQ tests...");

// Test raptorq_suppa basic functionality with strategy.sbn enabled
test("suppa.encode/decode - strategy.sbn mode enable", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with enable mode (should behave like raptorq_raw)
		const encoded = suppa.encode({
			options: { symbol_size: 104 },
			data: test_data,
			strategy: { sbn: { mode: "enable" } }
		});

		const oti = await encoded.oti;
		const symbols = [];
		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
		}

		// Create async iterator for symbols
		const symbol_iterator = {
			async *[Symbol.asyncIterator]() {
				for (const symbol of symbols) {
					yield symbol;
				}
			}
		};

		// Decode with enable mode
		const decoded = await suppa.decode({
			oti: oti,
			encoding_packets: symbol_iterator,
			strategy: { sbn: { mode: "enable" } }
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("Suppa enable mode test error:", error);
		return false;
	}
});

// Test raptorq_suppa with strategy.sbn override
test("suppa.encode/decode - strategy.sbn mode override", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with override mode
		const encoded = suppa.encode({
			options: {
				symbol_size: 104,
				num_source_blocks: 1, // Must be 1 for override mode
			},
			data: test_data,
			strategy: { sbn: { mode: "override", value: 42 } }
		});

		const oti = await encoded.oti;
		const symbols = [];
		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
			// Verify that SBN (first byte) is overridden to 42
			if (symbol[0] !== 42) {
				console.error(`Expected SBN to be 42, got ${symbol[0]}`);
				return false;
			}
		}

		// Create async iterator for symbols
		const symbol_iterator = {
			async *[Symbol.asyncIterator]() {
				for (const symbol of symbols) {
					yield symbol;
				}
			}
		};

		// Decode with override mode
		const decoded = await suppa.decode({
			oti: oti,
			encoding_packets: symbol_iterator,
			strategy: { sbn: { mode: "override", value: 42 } }
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("Suppa override mode test error:", error);
		return false;
	}
});

// Test raptorq_suppa with strategy.sbn disable
test("suppa.encode/decode - strategy.sbn mode disable", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with disable mode
		const encoded = suppa.encode({
			options: {
				symbol_size: 104,
				num_source_blocks: 1, // Must be 1 for disable mode
			},
			data: test_data,
			strategy: { sbn: { mode: "disable" } }
		});

		const oti = await encoded.oti;
		const symbols = [];
		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
			// Verify that symbol is 1 byte shorter (SBN removed)
			// Expected: symbol_size (104) + ESI (3 bytes) = 107 bytes
			if (symbol.length !== 107) {
				console.error(`Expected symbol length to be 107, got ${symbol.length}`);
				return false;
			}
		}

		// Create async iterator for symbols
		const symbol_iterator = {
			async *[Symbol.asyncIterator]() {
				for (const symbol of symbols) {
					yield symbol;
				}
			}
		};

		// Decode with disable mode
		const decoded = await suppa.decode({
			oti: oti,
			encoding_packets: symbol_iterator,
			strategy: { sbn: { mode: "disable" } }
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("Suppa disable mode test error:", error);
		return false;
	}
});
