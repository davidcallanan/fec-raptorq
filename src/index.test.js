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

// Test raptorq_suppa basic functionality with strategy.sbn default (behaves like old enable mode)
test("suppa.encode/decode - strategy.sbn default", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with default strategy (should behave like raptorq_raw)
		const encoded = suppa.encode({
			options: { symbol_size: 104 },
			data: test_data,
			strategy: {} // Use all defaults
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

		// Decode with default strategy
		const decoded = await suppa.decode({
			oti: oti,
			encoding_packets: symbol_iterator,
			strategy: {} // Use all defaults
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("Suppa default strategy test error:", error);
		return false;
	}
});

// Test raptorq_suppa with strategy.sbn custom remap (equivalent to old override)
test("suppa.encode/decode - strategy.sbn custom remap", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with custom SBN remap that overrides SBN to constant value
		const strategy = {
			sbn: {
				external_bits: 8,
				max_internal_value: 0, // Only allow 1 source block (internal value 0)
				remap: {
					to_internal: (_external) => 0, // Always map to internal 0
					to_external: (_internal) => 42, // Always output 42 externally
				},
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 104,
				num_source_blocks: 1, // Must be 1 since max_internal_value is 0
			},
			data: test_data,
			strategy: strategy,
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

		// Decode with same strategy
		const decoded = await suppa.decode({
			oti: oti,
			encoding_packets: symbol_iterator,
			strategy: strategy,
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("Suppa custom remap test error:", error);
		return false;
	}
});

// Test raptorq_suppa with strategy.sbn disabled (equivalent to old disable mode)
test("suppa.encode/decode - strategy.sbn disabled", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with SBN disabled (external_bits = 0)
		const strategy = {
			sbn: {
				external_bits: 0, // Disable SBN output
				max_internal_value: 0, // Only allow 1 source block
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 104,
				num_source_blocks: 1, // Must be 1 since max_internal_value is 0
			},
			data: test_data,
			strategy: strategy,
		});

		const oti = await encoded.oti;
		const symbols = [];
		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
			// Verify that symbol is shorter than standard (SBN removed)
			// Standard packet: SBN (1 byte) + ESI (3 bytes) + symbol_size (104) = 108 bytes
			// With SBN disabled: ESI (3 bytes) + symbol_size (104) = 107 bytes
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

		// Decode with same strategy
		const decoded = await suppa.decode({
			oti: oti,
			encoding_packets: symbol_iterator,
			strategy: strategy,
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("Suppa disabled SBN test error:", error);
		return false;
	}
});

// Test raptorq_suppa with strategy.esi custom configuration
test("suppa.encode/decode - strategy.esi custom bits", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with custom ESI configuration (16 bits instead of 24)
		const strategy = {
			esi: {
				external_bits: 16,
				max_internal_value: 65535, // 2^16 - 1
				remap: {
					to_internal: (external) => external,
					to_external: (internal) => internal,
				},
			},
		};

		const encoded = suppa.encode({
			options: { symbol_size: 104 },
			data: test_data,
			strategy: strategy,
		});

		const oti = await encoded.oti;
		const symbols = [];
		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
			// Verify that symbol has correct length:
			// SBN (1 byte) + ESI (2 bytes instead of 3) + symbol_size (104) = 107 bytes
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

		// Decode with same strategy
		const decoded = await suppa.decode({
			oti: oti,
			encoding_packets: symbol_iterator,
			strategy: strategy,
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("Suppa ESI custom bits test error:", error);
		return false;
	}
});

// Test raptorq_suppa with both strategy.sbn and strategy.esi customization
test("suppa.encode/decode - both sbn and esi customized", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with both SBN and ESI customized
		const strategy = {
			sbn: {
				external_bits: 4, // 4 bits for SBN
				max_internal_value: 0, // Only 1 source block allowed
				remap: {
					to_internal: (_external) => 0,
					to_external: (_internal) => 7, // Use value 7 in 4-bit field
				},
			},
			esi: {
				external_bits: 12, // 12 bits for ESI
				max_internal_value: 4095, // 2^12 - 1
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 104,
				num_source_blocks: 1,
			},
			data: test_data,
			strategy: strategy,
		});

		const oti = await encoded.oti;
		const symbols = [];
		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
			// Verify packet structure with bit packing:
			// SBN (4 bits) + ESI (12 bits) = 16 bits = 2 bytes + symbol_size (104) = 106 bytes
			if (symbol.length !== 106) {
				console.error(`Expected symbol length to be 106, got ${symbol.length}`);
				return false;
			}

			// Verify SBN value is remapped correctly (should be 7)
			// With bit packing, SBN is in the first 4 bits of the packed header
			const packed_header = (symbol[0] << 8) | symbol[1]; // Get first 2 bytes as 16-bit value
			const sbn_value = (packed_header >> 12) & 0x0F; // Extract upper 4 bits
			if (sbn_value !== 7) {
				console.error(`Expected SBN to be 7, got ${sbn_value}`);
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

		// Decode with same strategy
		const decoded = await suppa.decode({
			oti: oti,
			encoding_packets: symbol_iterator,
			strategy: strategy,
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("Suppa both SBN and ESI customized test error:", error);
		return false;
	}
});

// Test strategy validation errors
test("suppa.encode - strategy validation errors", () => {
	const test_data = createTestData(100);

	try {
		// Test invalid strategy.sbn.external_bits
		try {
			suppa.encode({
				options: { symbol_size: 104 },
				data: test_data,
				strategy: { sbn: { external_bits: 9 } }, // Invalid: > 8
			});
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("external_bits must be integer between 0 and 8")) {
				return false;
			}
		}

		// Test invalid strategy.esi.external_bits
		try {
			suppa.encode({
				options: { symbol_size: 104 },
				data: test_data,
				strategy: { esi: { external_bits: 1 } }, // Invalid: < 2
			});
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("external_bits must be integer between 2 and 24")) {
				return false;
			}
		}

		return true;
	} catch (error) {
		console.error("Strategy validation test error:", error);
		return false;
	}
});

// Test OTI customization - strategy.oti with reduced bits
test("suppa.encode/decode - strategy.oti custom bits", async () => {
	try {
		const test_data = createTestData(500);

		// Test configuration: reduce transfer_length to 24 bits, omit fec_encoding_id, reduce symbol_size to 12 bits
		const strategy = {
			oti: {
				transfer_length: {
					external_bits: 24, // Reduced from 40 bits
				},
				fec_encoding_id: {
					external_bits: 0, // Remove 8 bits (omit)
				},
				symbol_size: {
					external_bits: 12, // Reduced from 16 bits
				},
				// Keep other fields at default sizes: num_source_blocks (8), num_sub_blocks (16), symbol_alignment (8)
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 64,
			},
			data: test_data,
			strategy,
		});

		const oti = await encoded.oti;
		const oti_spec = await encoded.oti_spec;

		// Verify that oti_spec is still 12 bytes (original format)
		if (oti_spec.length !== 12) {
			return false;
		}

		// Verify that custom OTI has the expected byte length
		// Expected bits: 24 (transfer_length) + 0 (fec_encoding_id omitted) + 12 (symbol_size) + 8 (num_source_blocks) + 16 (num_sub_blocks) + 8 (symbol_alignment) = 68 bits
		// 68 bits = 9 bytes (rounded up)
		const expected_oti_bytes = Math.ceil((24 + 0 + 12 + 8 + 16 + 8) / 8);
		if (oti.length !== expected_oti_bytes) {
			console.error(`Expected OTI length: ${expected_oti_bytes}, actual: ${oti.length}`);
			return false;
		}

		// Collect some packets
		const packets = [];
		let packet_count = 0;
		for await (const packet of encoded.encoding_packets) {
			packets.push(packet);
			packet_count++;
			if (packet_count >= 20) break; // Collect enough packets for decoding
		}

		// Test decoding with the same strategy
		const decoded = await suppa.decode({
			oti,
			encoding_packets: (async function* () {
				for (const packet of packets) {
					yield packet;
				}
			})(),
			strategy,
		});

		return arraysEqual(decoded, test_data);

	} catch (error) {
		console.error("OTI custom bits test error:", error);
		return false;
	}
});

// Test OTI customization - hardcoded values (minimal OTI)
test("suppa.encode/decode - strategy.oti hardcoded values", async () => {
	try {
		const test_data = createTestData(300);

		// Test configuration: hardcode most values to minimize OTI size
		const strategy = {
			oti: {
				transfer_length: {
					external_bits: 0, // Hardcoded - omit from OTI
					remap: {
						to_internal: () => test_data.length, // Hardcode to actual data length
						to_external: undefined,
					},
				},
				fec_encoding_id: {
					external_bits: 0, // Remove from OTI (omit)
				},
				symbol_size: {
					external_bits: 0, // Hardcoded - omit from OTI
					remap: {
						to_internal: () => 64, // Hardcode symbol size
						to_external: undefined,
					},
				},
				num_source_blocks: {
					external_bits: 0, // Hardcoded - omit from OTI
					remap: {
						to_internal: () => 1, // Hardcode to 1 block
						to_external: undefined,
					},
				},
				num_sub_blocks: {
					external_bits: 0, // Hardcoded - omit from OTI
					remap: {
						to_internal: () => 1, // Hardcode to 1 sub-block
						to_external: undefined,
					},
				},
				symbol_alignment: {
					external_bits: 0, // Hardcoded - omit from OTI
					remap: {
						to_internal: () => 1, // Hardcode alignment
						to_external: undefined,
					},
				},
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 64, // Must match hardcoded value
			},
			data: test_data,
			strategy,
		});

		const oti = await encoded.oti;
		const oti_spec = await encoded.oti_spec;

		// Verify that oti_spec is still 12 bytes (original format)
		if (oti_spec.length !== 12) {
			return false;
		}

		// Verify that custom OTI is undefined (all values hardcoded)
		if (oti !== undefined) {
			console.error(`Expected undefined OTI for fully hardcoded strategy, got ${oti?.length} bytes`);
			return false;
		}

		// Collect some packets
		const packets = [];
		let packet_count = 0;
		for await (const packet of encoded.encoding_packets) {
			packets.push(packet);
			packet_count++;
			if (packet_count >= 15) break; // Collect enough packets for decoding
		}

		// Test decoding with the same strategy and undefined OTI
		const decoded = await suppa.decode({
			oti, // This will be undefined
			encoding_packets: (async function* () {
				for (const packet of packets) {
					yield packet;
				}
			})(),
			strategy,
		});

		return arraysEqual(decoded, test_data);

	} catch (error) {
		console.error("OTI hardcoded values test error:", error);
		return false;
	}
});

// Test OTI customization - custom remap functions
test("suppa.encode/decode - strategy.oti custom remap", async () => {
	try {
		const test_data = createTestData(400);

		// Test configuration: use custom remap for symbol_size (divide by 8 to compress representation)
		const strategy = {
			oti: {
				symbol_size: {
					external_bits: 8, // Reduced from 16 bits
					remap: {
						to_internal: (external) => external * 8, // Multiply by 8 to get actual size
						to_external: (internal) => internal / 8, // Divide by 8 to compress
					},
				},
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 128, // Should be represented as 128/8 = 16 in external form
			},
			data: test_data,
			strategy,
		});

		const oti = await encoded.oti;

		// Expected bits: 40 (transfer_length) + 8 (fec_encoding_id) + 8 (symbol_size custom) + 8 (num_source_blocks) + 16 (num_sub_blocks) + 8 (symbol_alignment) = 88 bits
		// 88 bits = 11 bytes
		const expected_oti_bytes = Math.ceil((40 + 8 + 8 + 8 + 16 + 8) / 8);
		if (oti.length !== expected_oti_bytes) {
			console.error(`Expected OTI length: ${expected_oti_bytes}, actual: ${oti.length}`);
			return false;
		}

		// Collect some packets
		const packets = [];
		let packet_count = 0;
		for await (const packet of encoded.encoding_packets) {
			packets.push(packet);
			packet_count++;
			if (packet_count >= 20) break;
		}

		// Test decoding with the same strategy
		const decoded = await suppa.decode({
			oti,
			encoding_packets: (async function* () {
				for (const packet of packets) {
					yield packet;
				}
			})(),
			strategy,
		});

		return arraysEqual(decoded, test_data);

	} catch (error) {
		console.error("OTI custom remap test error:", error);
		return false;
	}
});
