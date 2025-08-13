import Uint1Array from "./Uint1Array.js";

/**
 * Test suite for Uint1Array class
 */

// Basic construction and bit operations
console.log("=== Basic Construction and Bit Operations ===");

const bit_array = new Uint1Array(12);
console.log(`Created Uint1Array with length ${bit_array.length}`);
console.log(`Byte length: ${bit_array.byte_length}`);

// Set some bits
bit_array.set_bit(0, 1);
bit_array.set_bit(3, 1);
bit_array.set_bit(7, 1);
bit_array.set_bit(11, 1);

console.log("Set bits at positions 0, 3, 7, 11");
console.log(`Bit string: ${bit_array.to_string()}`);
console.log(`Debug: ${bit_array.to_debug_string()}`);

// Test bit getting
console.log("\n=== Bit Reading ===");
for (let i = 0; i < bit_array.length; i++) {
    console.log(`Bit ${i}: ${bit_array.get_bit(i)}`);
}

// Test underlying Uint8Array
console.log("\n=== Underlying Uint8Array ===");
const underlying = bit_array.to_uint8_array();
console.log("Underlying bytes:", Array.from(underlying).map(b => `0x${b.toString(16).padStart(2, "0")}`).join(" "));

// Test byte operations
console.log("\n=== Byte Operations ===");
const byte_test = new Uint1Array(16);
byte_test.set_byte(0, 0b10101010);
byte_test.set_byte(1, 0b01010101);

console.log("Set bytes to 0b10101010 and 0b01010101");
console.log(`Bit string: ${byte_test.to_string()}`);
console.log(`Byte 0: 0x${byte_test.get_byte(0).toString(16)}`);
console.log(`Byte 1: 0x${byte_test.get_byte(1).toString(16)}`);

// Test bitwise operations
console.log("\n=== Bitwise Operations ===");
const array1 = new Uint1Array(8);
const array2 = new Uint1Array(8);

array1.set_byte(0, 0b11001100);
array2.set_byte(0, 0b10101010);

console.log(`Array1: ${array1.to_string()}`);
console.log(`Array2: ${array2.to_string()}`);

const and_result = array1.and(array2);
const or_result = array1.or(array2);
const xor_result = array1.xor(array2);
const not_result = array1.not();

console.log(`AND:    ${and_result.to_string()}`);
console.log(`OR:     ${or_result.to_string()}`);
console.log(`XOR:    ${xor_result.to_string()}`);
console.log(`NOT:    ${not_result.to_string()}`);

// Test array-like methods
console.log("\n=== Array-like Methods ===");
const test_array = new Uint1Array(10);
test_array.fill(1, 2, 7);
console.log(`Filled positions 2-6 with 1: ${test_array.to_string()}`);

const slice_result = test_array.slice(1, 8);
console.log(`Slice [1:8]: ${slice_result.to_string()}`);

// Test iteration
console.log("\n=== Iteration ===");
const iter_test = new Uint1Array(6);
iter_test.set_byte(0, 0b101010);

console.log("Using for...of:");
let index = 0;
for (const bit of iter_test) {
    console.log(`  Position ${index}: ${bit}`);
    index++;
}

console.log("Using entries():");
for (const [pos, bit] of iter_test.entries()) {
    console.log(`  Position ${pos}: ${bit}`);
}

// Test utility methods
console.log("\n=== Utility Methods ===");
const util_test = new Uint1Array(8);
util_test.set_byte(0, 0b10110100);

console.log(`Pattern: ${util_test.to_string()}`);
console.log(`Set bits count: ${util_test.count_set_bits()}`);
console.log(`First set bit: ${util_test.find_first_set_bit()}`);
console.log(`Last set bit: ${util_test.find_last_set_bit()}`);
console.log(`Index of bit 1: ${util_test.index_of(1)}`);
console.log(`Last index of bit 1: ${util_test.last_index_of(1)}`);
console.log(`Includes bit 0: ${util_test.includes(0)}`);

// Test edge cases
console.log("\n=== Edge Cases ===");
const edge_test = new Uint1Array(10); // 10 bits, so 6 bits in last byte should be zero
edge_test.fill(1);

console.log(`10-bit array filled with 1s: ${edge_test.to_string()}`);
const clean_bytes = edge_test.to_uint8_array();
console.log("Clean bytes:", Array.from(clean_bytes).map(b => `0b${b.toString(2).padStart(8, "0")}`).join(" "));

// Test from static method
console.log("\n=== Static from() Method ===");
const from_array = Uint1Array.from([1, 0, 1, 1, 0, 0, 1, 0]);
console.log(`From array [1,0,1,1,0,0,1,0]: ${from_array.to_string()}`);

const from_copy = Uint1Array.from(from_array);
console.log(`Copy equality: ${from_array.equals(from_copy)}`);

// Test functional methods
console.log("\n=== Functional Methods ===");
const func_test = new Uint1Array(6);
func_test.set_byte(0, 0b101100);

console.log(`Original: ${func_test.to_string()}`);

const mapped = func_test.map((bit, index) => (index % 2 === 0) ? 1 - bit : bit);
console.log(`Mapped (flip even positions): ${mapped.to_string()}`);

const filtered = func_test.filter(bit => bit === 1);
console.log(`Filtered (only 1s): ${filtered.to_string()}`);

const all_ones = func_test.every(bit => bit === 1);
const has_ones = func_test.some(bit => bit === 1);
console.log(`All ones: ${all_ones}, Has ones: ${has_ones}`);

const sum = func_test.reduce((acc, bit) => acc + bit, 0);
console.log(`Sum of bits: ${sum}`);

// Performance test
console.log("\n=== Performance Test ===");
const perf_size = 10000;
const perf_array = new Uint1Array(perf_size);

console.time("Fill large array");
perf_array.fill(1);
console.timeEnd("Fill large array");

console.time("Count set bits");
const set_count = perf_array.count_set_bits();
console.timeEnd("Count set bits");
console.log(`Set bits in ${perf_size}-bit array: ${set_count}`);

console.log("\n=== All tests completed! ===");
