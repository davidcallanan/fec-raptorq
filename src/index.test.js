import { test } from "./uoe/test.js";
import { compare_bytes } from "./uoe/compare_bytes.js";
import { raptorq_raw as raw } from "./index.js";

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
	if (!result.oti || !result.encoding_symbols) {
		return false;
	}

	// Check that oti is a promise
	if (!(result.oti instanceof Promise)) {
		return false;
	}

	// Check that encoding_symbols is an async iterable
	if (typeof result.encoding_symbols[Symbol.asyncIterator] !== 'function') {
		return false;
	}

	try {
		// Verify OTI is 12 bytes
		const oti = await result.oti;
		if (!(oti instanceof Uint8Array) || oti.length !== 12) {
			return false;
		}

		// Verify we can collect at least one symbol
		let symbolCount = 0;
		console.log("Test: Starting to iterate over encoding symbols...");
		for await (const symbol of result.encoding_symbols) {
			console.log(`Test: Received symbol ${symbolCount + 1}, type: ${typeof symbol}, instance: ${symbol instanceof Uint8Array}, length: ${symbol?.length}`);
			if (!(symbol instanceof Uint8Array)) {
				console.log("Test: Symbol is not Uint8Array, failing test");
				return false;
			}
			symbolCount++;
			// Only check first few symbols to avoid long test
			if (symbolCount >= 3) {
				console.log("Test: Got 3 symbols, breaking");
				break;
			}
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
		repair_symbols: 10,
		source_blocks: 1,
		sub_blocks: 1,
		symbol_alignment: 8
	};

	try {
		const result = raw.encode({ options: config, data: testData });
		const oti = await result.oti;

		// Verify OTI structure
		if (!(oti instanceof Uint8Array) || oti.length !== 12) {
			return false;
		}

		// Verify we can get symbols
		let symbolCount = 0;
		for await (const symbol of result.encoding_symbols) {
			symbolCount++;		// Expected symbol size is symbol_size + 4 (for PayloadId)
			if (symbol.length !== config.symbol_size + 4) {
				return false;
			}
			if (symbolCount >= 2) break; // Just check a few
		}

		return symbolCount > 0;
	} catch (error) {
		console.error("Custom config test error:", error);
		return false;
	}
});

// Test parameter validation
test("raw.encode - parameter validation", () => {
	const testData = createTestData(100);

	try {
		// Test invalid symbol size
		try {
			raw.encode({ options: { symbol_size: 70000 }, data: testData });
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("Symbol size")) return false;
		}

		// Test invalid source blocks
		try {
			raw.encode({ options: { source_blocks: 300 }, data: testData });
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("Source blocks")) return false;
		}

		// Test invalid symbol alignment
		try {
			raw.encode({ options: { symbol_alignment: 5 }, data: testData });
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("Symbol alignment")) return false;
		}

		// Test invalid data type
		try {
			raw.encode({ options: {}, data: "not a uint8array" });
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("Uint8Array")) return false;
		}

		return true;
	} catch (error) {
		console.error("Validation test error:", error);
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
		for await (const symbol of encoded.encoding_symbols) {
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
			oti: Promise.resolve(oti),
			encoding_symbols: symbolIterator
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

// Test decoding input validation
test("raw.decode - input validation", () => {
	try {
		// Test missing input
		try {
			raw.decode();
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("Input must contain")) return false;
		}

		// Test missing oti
		try {
			raw.decode({ encoding_symbols: [] });
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("Input must contain")) return false;
		}

		// Test missing encoding_symbols
		try {
			raw.decode({ oti: Promise.resolve(new Uint8Array(12)) });
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("Input must contain")) return false;
		}

		return true;
	} catch (error) {
		console.error("Decode validation test error:", error);
		return false;
	}
});

// Test round-trip encoding and decoding
test("raw encode/decode - round trip with small data", async () => {
	const originalData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

	try {
		// Encode
		const encoded = raw.encode({ options: { symbol_size: 48, repair_symbols: 5 }, data: originalData }); // 48 is divisible by 8
		const oti = await encoded.oti;

		// Collect symbols
		const symbols = [];
		for await (const symbol of encoded.encoding_symbols) {
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
			oti: Promise.resolve(oti),
			encoding_symbols: symbolIterator
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
				repair_symbols: 5,
				source_blocks: 2  // Use 2 blocks to test block output
			},
			data: originalData
		});

		// Collect the encoded data
		const oti = await encoded.oti;
		const symbols = [];
		for await (const symbol of encoded.encoding_symbols) {
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
			oti: Promise.resolve(oti),
			encoding_symbols: symbolIterator
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
				oti: Promise.resolve(new Uint8Array(12)),
				encoding_symbols: {
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

console.log("🧪 Running RaptorQ tests...");
