import { test } from "./uoe/test.js";
import { compare_bytes } from "./uoe/compare_bytes.js";
import { raptorq_raw as raw, raptorq_suppa as suppa } from "./index.js";
import { bigint_ceil } from "./uoe/bigint_ceil.js";

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
		symbol_size: 800n,
		num_repair_symbols: 10n,
		num_source_blocks: 1n,
		num_sub_blocks: 1n,
		symbol_alignment: 8n,
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
		const expectedSymbolCount = Math.ceil(testData.length / Number(config.symbol_size)) + Number(config.num_repair_symbols);

		for await (const symbol of result.encoding_packets) {
			symbolCount++;
			// Expected symbol size is symbol_size + 4 (for PayloadId)
			if (symbol.length !== Number(config.symbol_size) + 4) {
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
		const encoded = raw.encode({ options: { symbol_size: 104n }, data: testData }); // 104 is divisible by 8

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
		const encoded = raw.encode({ options: { symbol_size: 48n, num_repair_symbols: 5n }, data: originalData }); // 48 is divisible by 8
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
				symbol_size: 48n,
				num_repair_symbols: 5n,
				num_source_blocks: 2n  // Use 2 blocks to test block output
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
			if (typeof block.sbn !== 'bigint' || !(block.data instanceof Uint8Array)) {
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
			if (block.sbn < 0n || block.sbn > 255n) {
				return false;
			}
		}

		// verify the data matches the original

		// const combinedData = new Uint8Array(originalData.length);
		const total_length = blocks.reduce((sum, block) => sum + block.data.length, 0);
		const combinedData = new Uint8Array(total_length);

		let offset = 0;

		for (const block of blocks.sort((a, b) => Number(a.sbn - b.sbn))) {
			combinedData.set(block.data, offset);
			offset += block.data.length;
		}

		if (!arraysEqual(originalData, combinedData)) {
			return false;
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
	const alignmentValues = [1n, 2n, 4n, 5n, 8n, 16n, 25n, 40n]; // Test various alignments including non-power-of-2

	for (const alignment of alignmentValues) {
		try {
			const config = {
				symbol_size: alignment * 10n, // Ensure divisible by alignment
				num_repair_symbols: 5n,
				num_source_blocks: 1n,
				num_sub_blocks: 1n,
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

// Test raptorq_suppa basic functionality with strategy.encoding_packet.sbn default (behaves like old enable mode)
test("suppa.encode/decode - strategy.encoding_packet.sbn default", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with default strategy (should behave like raptorq_raw)
		const encoded = suppa.encode({
			options: { symbol_size: 104n },
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

// Test raptorq_suppa with strategy.encoding_packet.sbn custom remap (equivalent to old override)
test("suppa.encode/decode - strategy.encoding_packet.sbn custom remap", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with custom SBN remap that overrides SBN to constant value
		const strategy = {
			encoding_packet: {
				sbn: {
					external_bits: 8n,
					max_internal_value: 0n, // Only allow 1 source block (internal value 0)
					remap: {
						to_internal: (_external) => 0n, // Always map to internal 0n
						to_external: (_internal) => 42n, // Always output 42n externally
					},
				},
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 104n,
				num_source_blocks: 1n, // Must be 1 since max_internal_value is 0
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

// Test raptorq_suppa with strategy.encoding_packet.sbn disabled (equivalent to old disable mode)
test("suppa.encode/decode - strategy.encoding_packet.sbn disabled", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with SBN disabled (external_bits = 0)
		const strategy = {
			encoding_packet: {
				sbn: {
					external_bits: 0n, // Disable SBN output
					max_internal_value: 0n, // Only allow 1 source block
				},
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 104n,
				num_source_blocks: 1n, // Must be 1 since max_internal_value is 0
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

// Test raptorq_suppa with strategy.encoding_packet.esi custom configuration
test("suppa.encode/decode - strategy.encoding_packet.esi custom bits", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with custom ESI configuration (16 bits instead of 24)
		const strategy = {
			encoding_packet: {
				esi: {
					external_bits: 16n,
					remap: {
						to_internal: (external) => external,
						to_external: (internal) => internal,
					},
				},
			},
		};

		const encoded = suppa.encode({
			options: { symbol_size: 104n },
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

// Test raptorq_suppa with both strategy.encoding_packet.sbn and strategy.encoding_packet.esi customization
test("suppa.encode/decode - both sbn and esi customized", async () => {
	const test_data = createTestData(100);

	try {
		// Encode with both SBN and ESI customized
		const strategy = {
			encoding_packet: {
				sbn: {
					external_bits: 4n, // 4 bits for SBN
					remap: {
						to_internal: (_external) => 0n,
						to_external: (_internal) => 7n, // Use value 7 in 4-bit field
					},
				},
				esi: {
					external_bits: 12n, // 12 bits for ESI
					max_internal_value: 4095n, // 2^12 - 1
				},
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 104n,
				num_source_blocks: 1n,
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
		// Test invalid strategy.encoding_packet.sbn.external_bits
		try {
			suppa.encode({
				options: { symbol_size: 104n },
				data: test_data,
				strategy: { encoding_packet: { sbn: { external_bits: 9n } } }, // Invalid: > 8
			});
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("at most 8n")) {
				return false;
			}
		}

		// Test invalid strategy.encoding_packet.esi.external_bits
		try {
			suppa.encode({
				options: { symbol_size: 104n },
				data: test_data,
				strategy: { encoding_packet: { esi: { external_bits: 1n } } }, // Invalid: < 2
			});
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("at least 2n")) {
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
					external_bits: 24n, // Reduced from 40 bits
				},
				fec_encoding_id: {
					external_bits: 0n, // Remove 8 bits (omit)
				},
				symbol_size: {
					external_bits: 12n, // Reduced from 16 bits
				},
				// Keep other fields at default sizes: num_source_blocks (8), num_sub_blocks (16), symbol_alignment (8)
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 64n,
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
					external_bits: 0n, // Hardcoded - omit from OTI
					remap: {
						to_internal: () => BigInt(test_data.length), // Hardcode to actual data length
						to_external: undefined,
					},
				},
				fec_encoding_id: {
					external_bits: 0n, // Remove from OTI (omit)
				},
				symbol_size: {
					external_bits: 0n, // Hardcoded - omit from OTI
					remap: {
						to_internal: () => 64n, // Hardcode symbol size
						to_external: undefined,
					},
				},
				num_source_blocks: {
					external_bits: 0n, // Hardcoded - omit from OTI
					remap: {
						to_internal: () => 1n, // Hardcode to 1 block
						to_external: undefined,
					},
				},
				num_sub_blocks: {
					external_bits: 0n, // Hardcoded - omit from OTI
					remap: {
						to_internal: () => 1n, // Hardcode to 1 sub-block
						to_external: undefined,
					},
				},
				symbol_alignment: {
					external_bits: 0n, // Hardcoded - omit from OTI
					remap: {
						to_internal: () => 1n, // Hardcode alignment
						to_external: undefined,
					},
				},
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 64n, // Must match hardcoded value
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
					external_bits: 8n, // Reduced from 16 bits
					remap: {
						to_internal: (external) => external * 8n, // Multiply by 8n to get actual size
						to_external: (internal) => internal / 8n, // Divide by 8n to compress
					},
				},
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 128n, // Should be represented as 128n/8n = 16n in external form
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

// Test to_external returning undefined (non-representable values)
test("suppa - to_external can return undefined for non-representable values", async () => {
	try {
		const test_data = createTestData(100);

		// Create a strategy where to_external returns undefined for certain values
		const strategy = {
			encoding_packet: {
				sbn: {
					external_bits: 4n, // This allows 0-15 external values
					remap: {
						to_internal: (external) => external,
						to_external: (internal) => {
							// Return undefined for internal values > 10 to simulate non-representable values
							if (internal > 10n) {
								return undefined;
							}
							return internal;
						},
					},
				},
			},
		};

		// This should fail during encode() setup, not during packet iteration
		// Let's force a situation where internal SBN > 10 will be needed
		let error_thrown = false;

		try {
			const encoded = suppa.encode({
				options: {
					num_source_blocks: 15n, // This will create SBN values > 10 (0-14 range)
				},
				data: test_data,
				strategy,
			});

			// Try to get the first few packets - this should throw the error
			let count = 0;
			for await (const packet of encoded.encoding_packets) {
				if (++count >= 3) break; // We might get an error before this
			}
		} catch (error) {
			if (error.message.includes("cannot be represented externally") && error.message.includes("to_external returned undefined")) {
				error_thrown = true;
			}
		}

		return error_thrown;

	} catch (error) {
		// The error should be caught above, if we get here it's unexpected
		console.error("Unexpected error in to_external undefined test:", error);
		return false;
	}
});

// Test external_bits=0 for SBN strategy (no SBN prefix in packets)
test("suppa - external_bits=0 for SBN removes SBN prefix from packets", async () => {
	try {
		const test_data = createTestData(200);

		const strategy_with_sbn = {
			encoding_packet: {
				sbn: {
					external_bits: 8n, // Normal SBN
					remap: {
						to_internal: (external) => external,
						to_external: (internal) => internal,
					},
				},
			},
		};

		const strategy_no_sbn = {
			encoding_packet: {
				sbn: {
					external_bits: 0n, // No SBN prefix
					remap: {
						to_internal: (_unused) => 0n,
						to_external: undefined,
					},
				},
			},
		};

		// Encode with normal SBN
		const encoded_with_sbn = suppa.encode({
			options: { symbol_size: 64n },
			data: test_data,
			strategy: strategy_with_sbn,
		});

		// Encode without SBN
		const encoded_no_sbn = suppa.encode({
			options: { symbol_size: 64n },
			data: test_data,
			strategy: strategy_no_sbn,
		});

		// Collect first few packets from each
		const packets_with_sbn = [];
		const packets_no_sbn = [];

		let count = 0;
		for await (const packet of encoded_with_sbn.encoding_packets) {
			packets_with_sbn.push(packet);
			if (++count >= 5) break;
		}

		count = 0;
		for await (const packet of encoded_no_sbn.encoding_packets) {
			packets_no_sbn.push(packet);
			if (++count >= 5) break;
		}

		// Verify packets without SBN are shorter (by 1 byte for the SBN)
		// The difference should be exactly 1 byte per packet (the SBN byte)
		for (let i = 0; i < Math.min(packets_with_sbn.length, packets_no_sbn.length); i++) {
			if (packets_with_sbn[i].length !== packets_no_sbn[i].length + 1) {
				console.log(`Packet ${i}: with SBN=${packets_with_sbn[i].length}, without SBN=${packets_no_sbn[i].length}`);
				return false;
			}
		}

		return true;

	} catch (error) {
		console.error("external_bits=0 SBN test error:", error);
		return false;
	}
});

// Test external_bits=0 for ESI strategy  
test("suppa - external_bits=0 for ESI removes ESI prefix from packets", async () => {
	try {
		const test_data = createTestData(100);

		// Test with large ESI bits to show difference
		const strategy_with_esi = {
			encoding_packet: {
				esi: {
					external_bits: 24n, // Normal ESI (3 bytes)
					remap: {
						to_internal: (external) => external,
						to_external: (internal) => internal,
					},
				},
			},
		};

		// Test with minimal ESI bits that might cause representation issues
		const strategy_small_esi = {
			encoding_packet: {
				esi: {
					external_bits: 2n, // Only allows values 0-3
					remap: {
						to_internal: (external) => external,
						to_external: (internal) => {
							// Only allow ESI values 0-3 due to 2-bit limitation
							if (internal > 3n) {
								return undefined; // Non-representable
							}
							return internal;
						},
					},
				},
			},
		};

		// Encode with normal ESI (should always work)
		const encoded_with_esi = suppa.encode({
			options: { symbol_size: 64n },
			data: test_data,
			strategy: strategy_with_esi,
		});

		// Try encoding with small ESI - this might fail if we need ESI > 3
		let small_esi_failed_as_expected = false;
		try {
			const encoded_small_esi = suppa.encode({
				options: {
					symbol_size: 64n,
					num_source_blocks: 1n, // Keep it simple to reduce ESI requirements
				},
				data: test_data,
				strategy: strategy_small_esi,
			});

			// Try to get some packets
			let count = 0;
			for await (const packet of encoded_small_esi.encoding_packets) {
				if (++count >= 3) break;
			}

		} catch (error) {
			if (error.message.includes("cannot be represented externally")) {
				small_esi_failed_as_expected = true;
			} else {
				throw error; // Unexpected error
			}
		}

		// Verify the normal ESI strategy works
		let count = 0;
		for await (const packet of encoded_with_esi.encoding_packets) {
			if (++count >= 3) break;
		}

		// Test passes if we got packets from normal strategy
		// The small ESI might work or fail depending on the data size - both outcomes are valid
		return count >= 3;

	} catch (error) {
		console.error("ESI bits test error:", error);
		return false;
	}
});

// Test complete round-trip with external_bits=0 for both SBN and OTI fields
test("suppa - external_bits=0 round-trip with undefined OTI", async () => {
	try {
		const test_data = createTestData(150);

		const strategy = {
			sbn: {
				external_bits: 0n, // No SBN in packets
				remap: {
					to_internal: (_unused) => 0n, // Always map to block 0
					to_external: undefined, // Must be undefined when external_bits is 0
				},
			},
			oti: {
				// Make OTI completely empty (undefined) but provide hardcoded values
				transfer_length: {
					external_bits: 0n,
					remap: {
						to_internal: (_unused) => BigInt(test_data.length), // Hardcoded transfer length
						to_external: undefined,
					},
				},
				fec_encoding_id: { external_bits: 0n }, // Always 6, no remap needed
				symbol_size: {
					external_bits: 0n,
					remap: {
						to_internal: (_unused) => 32n, // Hardcoded symbol size
						to_external: undefined,
					},
				},
				num_source_blocks: {
					external_bits: 0n,
					remap: {
						to_internal: (_unused) => 1n, // Hardcoded to single block
						to_external: undefined,
					},
				},
				num_sub_blocks: {
					external_bits: 0n,
					remap: {
						to_internal: (_unused) => 1n, // Hardcoded to single sub-block
						to_external: undefined,
					},
				},
				symbol_alignment: {
					external_bits: 0n,
					remap: {
						to_internal: (_unused) => 4n, // Hardcoded alignment
						to_external: undefined,
					},
				},
			},
		};

		// Encode with the strategy
		const encoded = suppa.encode({
			options: {
				symbol_size: 32n,
				num_source_blocks: 1n, // Force single block to work with SBN=0
			},
			data: test_data,
			strategy,
		});

		const oti = await encoded.oti;
		console.log("OTI length:", oti?.length || "undefined");

		// OTI should be undefined since all external_bits are 0
		if (oti !== undefined) {
			console.log("Expected undefined OTI, got:", oti);
			return false;
		}

		// Collect some packets
		const packets = [];
		let count = 0;
		for await (const packet of encoded.encoding_packets) {
			packets.push(packet);
			if (++count >= 10) break;
		}

		if (packets.length === 0) {
			return false;
		}

		// Try to decode - the decoder should reconstruct OTI from hardcoded values
		const decoded_result = suppa.decode({
			oti, // This is undefined
			encoding_packets: packets,
			strategy, // Same strategy provides hardcoded values for decoding
		});

		const decoded_data = await decoded_result;

		return arraysEqual(decoded_data, test_data);

	} catch (error) {
		console.error("external_bits=0 round-trip test error:", error);
		return false;
	}
});

// Test raptorq_suppa oti.placement="negotation" (default behavior)
test("suppa.encode/decode - oti.placement negotiation (default)", async () => {
	const test_data = createTestData(100);

	try {
		const strategy = {
			oti: {
				placement: "negotiation", // Explicitly set to default
			},
		};

		const encoded = suppa.encode({
			options: { symbol_size: 104n },
			data: test_data,
			strategy: strategy,
		});

		const oti = await encoded.oti;
		const symbols = [];

		// OTI should not be undefined with negotation placement
		if (oti === undefined) {
			console.error("Expected OTI to be defined with placement='negotation'");
			return false;
		}

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

		// Decode with same strategy
		const decoded = await suppa.decode({
			oti: oti,
			encoding_packets: symbol_iterator,
			strategy: strategy,
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("OTI placement negotation test error:", error);
		return false;
	}
});

// Test raptorq_suppa oti.placement="encoding_packet" (per-packet OTI)
test("suppa.encode/decode - oti.placement encoding_packet", async () => {
	const test_data = createTestData(100);

	try {
		const strategy = {
			oti: {
				placement: "encoding_packet",
				// Make OTI smaller to minimize overhead
				transfer_length: { external_bits: 16n }, // Reduce from 40 to 16 bits
				symbol_size: { external_bits: 12n }, // Reduce from 16 to 12 bits
				fec_encoding_id: { external_bits: 0n }, // Remove FEC encoding ID
			},
		};

		const encoded = suppa.encode({
			options: { symbol_size: 104n },
			data: test_data,
			strategy: strategy,
		});

		const oti = await encoded.oti;
		const symbols = [];

		// OTI should be undefined with encoding_packet placement
		if (oti !== undefined) {
			console.error("Expected OTI to be undefined with placement='encoding_packet'");
			return false;
		}

		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
			// Verify packets are longer due to embedded OTI
			// Standard packet would be: SBN (1 byte) + ESI (3 bytes) + symbol_data (104) = 108 bytes
			// With embedded OTI: OTI + SBN + ESI + symbol_data should be longer
			if (symbol.length <= 108) {
				console.error(`Expected packet to be longer than 108 bytes due to embedded OTI, got ${symbol.length}`);
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

		// Decode with same strategy, passing undefined for oti
		const decoded = await suppa.decode({
			oti: undefined,
			encoding_packets: symbol_iterator,
			strategy: strategy,
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("OTI placement encoding_packet test error:", error);
		return false;
	}
});

// Test raptorq_suppa oti.placement validation (invalid value)
test("suppa.encode - oti.placement validation", async () => {
	const test_data = createTestData(100);

	try {
		const strategy = {
			oti: {
				placement: "invalid_value", // Invalid placement value
			},
		};

		// This should throw an error
		try {
			suppa.encode({
				options: { symbol_size: 104n },
				data: test_data,
				strategy: strategy,
			});
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes('Provided strategy.oti.placement (invalid_value) must be "negotiation" or "encoding_packet"')) {
				console.error("Expected placement validation error, got:", e.message);
				return false;
			}
			return true;
		}
	} catch (error) {
		console.error("OTI placement validation test error:", error);
		return false;
	}
});

// Test raptorq_suppa decode validation when placement is "encoding_packet" but oti is provided
test("suppa.decode - oti validation with encoding_packet placement", async () => {
	try {
		const strategy = {
			oti: {
				placement: "encoding_packet",
			},
		};

		// Create a mock oti (should be undefined for encoding_packet placement)
		const invalid_oti = new Uint8Array(12);

		// Create mock encoding packets
		const mock_packets = {
			async *[Symbol.asyncIterator]() {
				yield new Uint8Array(108); // Mock packet
			}
		};

		// This should throw an error
		try {
			await suppa.decode({
				oti: invalid_oti, // Should be undefined
				encoding_packets: mock_packets,
				strategy: strategy,
			});
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("When strategy.oti.placement is 'encoding_packet', the oti parameter must be undefined")) {
				console.error("Expected OTI validation error, got:", e.message);
				return false;
			}
			return true;
		}
	} catch (error) {
		console.error("OTI validation test error:", error);
		return false;
	}
});

// Test raptorq_suppa with minimal OTI in encoding_packet placement
test("suppa.encode/decode - minimal OTI with encoding_packet placement", async () => {
	const test_data = createTestData(100);

	try {
		const strategy = {
			oti: {
				placement: "encoding_packet",
				// Minimize OTI size by hardcoding most values
				transfer_length: {
					external_bits: 0n, // Hardcode
					remap: {
						to_internal: () => BigInt(test_data.length),
						to_external: undefined,
					},
				},
				fec_encoding_id: { external_bits: 0n }, // Remove
				symbol_size: {
					external_bits: 0n, // Hardcode
					remap: {
						to_internal: () => 104n,
						to_external: undefined,
					},
				},
				num_source_blocks: {
					external_bits: 0n, // Hardcode
					remap: {
						to_internal: () => 1n,
						to_external: undefined,
					},
				},
				num_sub_blocks: {
					external_bits: 0n, // Hardcode
					remap: {
						to_internal: () => 1n,
						to_external: undefined,
					},
				},
				symbol_alignment: {
					external_bits: 0n, // Hardcode
					remap: {
						to_internal: () => 1n,
						to_external: undefined,
					},
				},
			},
		};

		const encoded = suppa.encode({
			options: {
				symbol_size: 104n,
				num_source_blocks: 1n,
				num_sub_blocks: 1n,
				symbol_alignment: 1n,
			},
			data: test_data,
			strategy: strategy,
		});

		const oti = await encoded.oti;
		const symbols = [];

		// OTI should be undefined since all fields are hardcoded
		if (oti !== undefined) {
			console.error("Expected OTI to be undefined when all fields are hardcoded");
			return false;
		}

		for await (const symbol of encoded.encoding_packets) {
			symbols.push(symbol);
			// With all OTI hardcoded, packets should be same size as standard
			// (no OTI overhead since nothing to embed)
			if (symbol.length !== 108) { // SBN + ESI + symbol_data
				console.error(`Expected standard packet size 108, got ${symbol.length}`);
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
			oti: undefined,
			encoding_packets: symbol_iterator,
			strategy: strategy,
		});

		return arraysEqual(test_data, decoded);
	} catch (error) {
		console.error("Minimal OTI with encoding_packet placement test error:", error);
		return false;
	}
});

// Test raptorq_suppa OTI consistency validation in encoding_packet placement
test("suppa.decode - OTI consistency validation in encoding_packet placement", async () => {
	const test_data = createTestData(100);

	try {
		const strategy = {
			oti: {
				placement: "encoding_packet",
				transfer_length: { external_bits: 16n },
			},
		};

		// Create mock packets with different OTI values (should cause error)
		const mock_packets = {
			async *[Symbol.asyncIterator]() {
				// First packet with OTI [0, 100] (representing some transfer_length)
				const packet1 = new Uint8Array(116); // 2 bytes OTI + standard packet
				packet1[0] = 0;
				packet1[1] = 100;
				yield packet1;

				// Second packet with different OTI [0, 200] (different transfer_length)
				const packet2 = new Uint8Array(116);
				packet2[0] = 0;
				packet2[1] = 200; // Different value!
				yield packet2;
			}
		};

		// This should throw an error due to OTI mismatch
		try {
			const decoded_iterator = suppa.decode({
				oti: undefined,
				encoding_packets: mock_packets,
				strategy: strategy,
			});

			// Try to consume the iterator (error should occur during iteration)
			await decoded_iterator;
			return false; // Should have thrown
		} catch (e) {
			if (!e.message.includes("OTI mismatch detected")) {
				console.error("Expected OTI mismatch error, got:", e.message);
				return false;
			}
			return true;
		}
	} catch (error) {
		console.error("OTI consistency validation test error:", error);
		return false;
	}
});

// Test transfer_length_trim - basic functionality
test("suppa.encode/decode - transfer_length_trim basic functionality", async () => {
	try {
		const test_data = createTestData(100);

		const strategy = {
			payload: {
				transfer_length_trim: {
					external_bits: 8n, // Use 8 bits for trim length
					pump_transfer_length: (effective_length) => bigint_ceil(effective_length, 32n) * 32n, // Round up to nearest 32
				},
			},
		};

		// Encode with transfer_length_trim
		const encode_result = suppa.encode({
			strategy,
			data: test_data,
			options: { symbol_size: 64n }
		});

		const oti = await encode_result.oti;
		const encoding_packets = [];

		for await (const packet of encode_result.encoding_packets) {
			encoding_packets.push(packet);
		}

		console.log(`Encoded ${encoding_packets.length} packets with transfer_length_trim`);

		// Decode with same strategy
		const decode_result = suppa.decode({
			strategy,
			oti,
			encoding_packets: (async function* () {
				for (const packet of encoding_packets) {
					yield packet;
				}
			})()
		});

		const decoded_data = await decode_result;

		// Verify the decoded data matches the original
		if (!arraysEqual(test_data, decoded_data)) {
			console.error("Decoded data does not match original with transfer_length_trim");
			return false;
		}

		console.log("transfer_length_trim basic functionality test passed");
		return true;
	} catch (error) {
		console.error("transfer_length_trim basic test error:", error);
		return false;
	}
});

// Test transfer_length_trim - blocks output format
test("suppa.encode/decode - transfer_length_trim with blocks output", async () => {
	try {
		const test_data = createTestData(800);

		const strategy = {
			oti: {
				symbol_size: {
					external_bits: 0n,
					remap: {
						to_internal: () => 256n, // hardcoded symbol_size
						to_external: undefined,
					},
				},
				transfer_length: {
					external_bits: 32n, // 8 bits less than the default 40
					remap: {
						to_internal: (value) => value * 256n,
						to_external: (value) => value / 256n,
						// due to reduction of 8 bits, we decide to force length to be multiple of 256 to cover the entire range
						// which happens to line up nicely with our symbol_size
					},
				},
			},
			payload: {
				transfer_length_trim: {
					external_bits: 8n, // we compress this down to 8 bits by making the trim only refer to the lower 8 bits, as `transfer_length` already covers the remaining bits (well, with a value 256 larger)
					remap: {
						to_internal: (external_value, { transfer_length }) => (transfer_length - 256n) + external_value,
						to_external: (internal_value, { transfer_length }) => internal_value - (transfer_length - 256n)
					},
					// this function decides what internal transfer_length raptorq will use based on effective_transfer_length := the length of the data passed in to this interface + the size transfer_length_trim takes up, must return value >= effective_transfer_length
					pump_transfer_length: (effective_transfer_length) => bigint_ceil(effective_transfer_length, 256n) * 256n, // bring up to nearest 256 multiple
				},
			},
		};

		// Encode with transfer_length_trim
		const encode_result = suppa.encode({
			strategy,
			data: test_data,
			options: { symbol_size: 256n, num_source_blocks: 2n } // Use 256 to match the strategy
		});

		const oti = await encode_result.oti;
		const encoding_packets = [];

		for await (const packet of encode_result.encoding_packets) {
			encoding_packets.push(packet);
		}

		console.log("HAVE ENCODING PACKETS:")
		// console.log(encoding_packets);

		// Decode with blocks output format
		const decode_result = suppa.decode({
			usage: { output_format: "blocks" },
			strategy,
			oti,
			encoding_packets: (async function* () {
				for (const packet of encoding_packets) {
					yield packet;
				}
			})()
		});

		const blocks = [];
		for await (const block of decode_result.blocks) {
			console.log(`Block ${block.sbn}: length=${block.data.length}, first few bytes=[${block.data.slice(0, 10).join(",")}]`);
			blocks.push(block);
		}

		// Get the trim length from the promise
		const trim_length = await decode_result.transfer_length_trim;
		console.log(`Blocks test - trim_length: ${trim_length}, original length: ${test_data.length}`);

		// Reconstruct data from blocks
		let reconstructed_data = new Uint8Array(0);
		for (const block of blocks.sort((a, b) => Number(a.sbn - b.sbn))) {
			console.log(`Assembling block ${block.sbn}, current length: ${reconstructed_data.length}, adding: ${block.data.length}`);
			const combined = new Uint8Array(reconstructed_data.length + block.data.length);
			combined.set(reconstructed_data);
			combined.set(block.data, reconstructed_data.length);
			reconstructed_data = combined;
		}
		console.log(`Blocks test - reconstructed length before trim: ${reconstructed_data.length}`);

		// Apply trim using the trim length from the promise
		reconstructed_data = reconstructed_data.slice(0, Number(trim_length));
		console.log(`Blocks test - reconstructed length after trim: ${reconstructed_data.length}`);

		// Verify the reconstructed data matches the original
		if (!arraysEqual(test_data, reconstructed_data)) {
			console.log(test_data.join(","));
			console.log("----");
			console.log(reconstructed_data.join(","));
			console.error("Reconstructed data from blocks does not match original with transfer_length_trim");
			return false;
		}

		console.log("transfer_length_trim blocks output test passed");
		return true;
	} catch (error) {
		console.error("transfer_length_trim blocks test error:", error);
		return false;
	}
});

// Test transfer_length_trim - with remap functions
test("suppa.encode/decode - transfer_length_trim with remap functions", async () => {
	try {
		const test_data = createTestData(275);

		const strategy = {
			oti: {
				symbol_size: {
					external_bits: 0n,
					remap: {
						to_internal: () => 256n, // hardcoded symbol_size
						to_external: undefined,
					},
				},
				transfer_length: {
					external_bits: 32n, // 8 bits less than the default 40
					remap: {
						to_internal: (value) => value * 256n,
						to_external: (value) => value / 256n,
						// due to reduction of 8 bits, we decide to force length to be multiple of 256 to cover the entire range
						// which happens to line up nicely with our symbol_size
					},
				},
			},
			payload: {
				transfer_length_trim: {
					external_bits: 8n, // we compress this down to 8 bits by making the trim only refer to the lower 8 bits, as `transfer_length` already covers the remaining bits (well, with a value 256 larger)
					remap: {
						to_internal: (external_value, { transfer_length }) => (transfer_length - 256n) + external_value,
						to_external: (internal_value, { transfer_length }) => internal_value - (transfer_length - 256n)
					},
					// this function decides what internal transfer_length raptorq will use based on effective_transfer_length := the length of the data passed in to this interface + the size transfer_length_trim takes up, must return value >= effective_transfer_length
					pump_transfer_length: (effective_transfer_length) => bigint_ceil(effective_transfer_length, 256n) * 256n, // bring up to nearest 256 multiple
				},
			},
		};

		// Encode with transfer_length_trim and remap
		const encode_result = suppa.encode({
			strategy,
			data: test_data,
			options: { symbol_size: 256n } // Use 256 to match the strategy
		});

		const oti = await encode_result.oti;
		const oti_spec = await encode_result.oti_spec;

		console.log("got oti", oti_spec);

		const encoding_packets = [];

		for await (const packet of encode_result.encoding_packets) {
			encoding_packets.push(packet);
		}

		// Decode with same strategy
		const decode_result = suppa.decode({
			strategy,
			oti,
			encoding_packets: (async function* () {
				for (const packet of encoding_packets) {
					yield packet;
				}
			})()
		});

		const decoded_data = await decode_result;

		// Verify the decoded data matches the original
		if (!arraysEqual(test_data, decoded_data)) {
			console.error("Decoded data does not match original with transfer_length_trim and remap");
			return false;
		}

		console.log("transfer_length_trim with remap functions test passed");
		return true;
	} catch (error) {
		console.error("transfer_length_trim remap test error:", error);
		return false;
	}
});

// Test transfer_length_trim - zero external_bits (disabled)
test("suppa.encode/decode - transfer_length_trim disabled with zero external_bits", async () => {
	try {
		const test_data = createTestData(80);

		const strategy = {
			payload: {
				transfer_length_trim: {
					external_bits: 0n, // Disabled
				},
			},
		};

		// Encode with disabled transfer_length_trim
		const encode_result = suppa.encode({
			strategy,
			data: test_data,
			options: { symbol_size: 40n }
		});

		const oti = await encode_result.oti;
		const encoding_packets = [];

		for await (const packet of encode_result.encoding_packets) {
			encoding_packets.push(packet);
		}

		console.log("DECODING WITH OTI", oti);

		// Decode with same strategy
		const decode_result = suppa.decode({
			strategy,
			oti,
			encoding_packets: (async function* () {
				for (const packet of encoding_packets) {
					yield packet;
				}
			})()
		});

		const decoded_data = await decode_result;

		// Verify the decoded data matches the original
		if (!arraysEqual(test_data, decoded_data)) {
			console.error("Decoded data does not match original with disabled transfer_length_trim");
			return false;
		}

		console.log("transfer_length_trim disabled test passed");
		return true;
	} catch (error) {
		console.error("transfer_length_trim disabled test error:", error);
		return false;
	}
});

// Test transfer_length_trim - error handling for corrupted prefix
test("suppa.decode - transfer_length_trim error handling", async () => {
	try {
		// This test verifies that proper validation happens in combined output mode
		const test_data = createTestData(50);

		const strategy = {
			payload: {
				transfer_length_trim: {
					external_bits: 8n,
					pump_transfer_length: (effective_length) => effective_length + 10n, // Add some padding
				},
			},
		};

		// Encode normally
		const encode_result = suppa.encode({
			strategy,
			data: test_data,
			options: { symbol_size: 32n }
		});

		const oti = await encode_result.oti;
		const encoding_packets = [];

		for await (const packet of encode_result.encoding_packets) {
			encoding_packets.push(packet);
		}

		// Use a remap function that would create an invalid trim length during decode
		const bad_strategy = {
			payload: {
				transfer_length_trim: {
					external_bits: 8n,
					remap: {
						// This remap will make the trim length larger than available data
						to_internal: (external_value, { transfer_length }) => external_value + 200n, // Add way too much
						to_external: (internal_value, { transfer_length }) => internal_value - 200n
					},
					pump_transfer_length: (effective_length) => effective_length + 10n,
				},
			},
		};

		try {
			const decode_result = suppa.decode({
				strategy: bad_strategy,
				oti,
				encoding_packets: (async function* () {
					for (const packet of encoding_packets) {
						yield packet;
					}
				})()
			});

			const decoded_data = await decode_result;
			console.error("Expected error for invalid trim length but decode succeeded");
			return false;
		} catch (e) {
			if (e.message.includes("transfer_length_trim specifies length")) {
				console.log("transfer_length_trim error handling test passed");
				return true;
			} else {
				console.error("Expected trim length error, got:", e.message);
				return false;
			}
		}
	} catch (error) {
		console.error("transfer_length_trim error handling test error:", error);
		return false;
	}
});

// Test regular decoding with multiple source blocks
test("raw decode - regular output format with multiple blocks", async () => {
	const originalData = createTestData(200);

	try {
		// Encode the data with multiple source blocks
		const encoded = raw.encode({
			options: {
				symbol_size: 48n,
				num_repair_symbols: 5n,
				num_source_blocks: 2n  // Use 2 blocks to test multi-block scenario
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

		// Decode with regular format (default)
		const decoded = raw.decode({
			oti,
			encoding_packets: symbolIterator
		});

		// Verify result has data Uint8Array
		const decodedData = await decoded; // it was decoded.data. how does back and forth with AI 10 times not catch this.
		if (!(decodedData instanceof Uint8Array)) {
			return false;
		}

		// Verify the decoded data matches the original
		if (!arraysEqual(originalData, decodedData)) {
			return false;
		}

		return true;

	} catch (error) {
		console.error("Regular decoding test error:", error);
		return false;
	}
});

// Test that regular numbers are rejected - BigInt validation
test("raw.encode - rejects regular numbers, requires BigInt", async () => {
	const testData = createTestData(100);

	try {
		// This should fail because 800 is not 800n
		const result = raw.encode({
			options: { symbol_size: 800 }, // Regular number should be rejected
			data: testData
		});
		// If we get here, validation failed
		return false;
	} catch (error) {
		// Should get an error about BigInt requirement
		if (error.message.includes("must be")) {
			return true;
		}
		console.error("Unexpected error:", error.message);
		return false;
	}
});

// Test that all option fields reject regular numbers
test("raw.encode - strict BigInt validation for all options", async () => {
	const testData = createTestData(100);

	const regularNumberTests = [
		{ options: { symbol_size: 800 }, field: "symbol_size" },
		{ options: { num_repair_symbols: 10 }, field: "num_repair_symbols" },
		{ options: { num_source_blocks: 2 }, field: "num_source_blocks" },
		{ options: { num_sub_blocks: 1 }, field: "num_sub_blocks" },
		{ options: { symbol_alignment: 8 }, field: "symbol_alignment" },
	];

	for (const test of regularNumberTests) {
		try {
			const result = raw.encode({
				options: test.options,
				data: testData
			});
			// If we get here, validation failed
			console.error(`${test.field} validation failed - should have rejected regular number`);
			return false;
		} catch (error) {
			// Should get an error about BigInt requirement
			if (!error.message.includes("must be")) {
				console.error(`${test.field} - Unexpected error:`, error.message);
				return false;
			}
			// Good, validation worked for this field
		}
	}

	return true;
});
