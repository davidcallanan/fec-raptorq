/**
 * Uint1Array - A bit-level array backed by Uint8Array
 * Provides bit manipulation with byte-level storage efficiency
 */
class Uint1Array {
	constructor(length_in_bits_or_bigint, bit_count) {
		if (typeof length_in_bits_or_bigint === "bigint") {
			// Constructor from BigInt
			const value = length_in_bits_or_bigint;
			bit_count ??= this._calculate_min_bits_for_bigint(value);
			
			this._length_in_bits = bit_count;
			this._byte_length = Math.ceil(bit_count / 8);
			this._buffer = new Uint8Array(this._byte_length);
			
			// Set bits from BigInt value
			for (let i = 0; i < bit_count; i++) {
				const bit = (value >> BigInt(bit_count - 1 - i)) & 1n;
				this.set_bit(i, Number(bit));
			}
		} else {
			// Original constructor from length
			this._length_in_bits = length_in_bits_or_bigint;
			this._byte_length = Math.ceil(length_in_bits_or_bigint / 8);
			this._buffer = new Uint8Array(this._byte_length);
		}
	}

	_calculate_min_bits_for_bigint(value) {
		if (value === 0n) return 1;
		return value.toString(2).length;
	}

	static from(source) {
		if (source instanceof Uint1Array) {
			const new_array = new Uint1Array(source._length_in_bits);
			new_array._buffer.set(source._buffer);
			return new_array;
		}

		if (Array.isArray(source)) {
			const new_array = new Uint1Array(source.length);
			source.forEach((bit, index) => {
				new_array.set_bit(index, bit);
			});
			return new_array;
		}

		throw new Error("Unsupported source type for Uint1Array.from");
	}

	get length() {
		return this._length_in_bits;
	}

	get byte_length() {
		return this._byte_length;
	}

	// Bit-level operations
	get_bit(bit_index) {
		if (bit_index < 0 || bit_index >= this._length_in_bits) {
			throw new RangeError("Bit index out of range");
		}

		const byte_index = Math.floor(bit_index / 8);
		const bit_offset = bit_index % 8;

		return (this._buffer[byte_index] >> (7 - bit_offset)) & 1;
	}

	set_bit(bit_index, value) {
		if (bit_index < 0 || bit_index >= this._length_in_bits) {
			throw new RangeError("Bit index out of range");
		}

		const byte_index = Math.floor(bit_index / 8);
		const bit_offset = bit_index % 8;
		const bit_mask = 1 << (7 - bit_offset);

		if (value) {
			this._buffer[byte_index] |= bit_mask;
		} else {
			this._buffer[byte_index] &= ~bit_mask;
		}
	}

	toggle_bit(bit_index) {
		if (bit_index < 0 || bit_index >= this._length_in_bits) {
			throw new RangeError("Bit index out of range");
		}

		const byte_index = Math.floor(bit_index / 8);
		const bit_offset = bit_index % 8;
		const bit_mask = 1 << (7 - bit_offset);

		this._buffer[byte_index] ^= bit_mask;
	}

	// Byte-level operations
	get_byte(byte_index) {
		if (byte_index < 0 || byte_index >= this._byte_length) {
			throw new RangeError("Byte index out of range");
		}

		return this._buffer[byte_index];
	}

	set_byte(byte_index, value) {
		if (byte_index < 0 || byte_index >= this._byte_length) {
			throw new RangeError("Byte index out of range");
		}

		this._buffer[byte_index] = value & 0xFF;
	}

	// Get underlying Uint8Array with erroneous bits zeroed
	to_uint8_array() {
		const result = new Uint8Array(this._buffer);

		// Zero out any bits beyond the intended length
		const excess_bits = (this._byte_length * 8) - this._length_in_bits;
		if (excess_bits > 0) {
			const last_byte_index = this._byte_length - 1;
			const mask = 0xFF << excess_bits;
			result[last_byte_index] &= mask;
		}

		return result;
	}

	// Get reference to underlying buffer (use with caution)
	get_underlying_buffer() {
		return this._buffer;
	}

	// Array-like operations
	fill(bit_value, start = 0, end = this._length_in_bits) {
		const actual_start = Math.max(0, start);
		const actual_end = Math.min(this._length_in_bits, end);

		for (let i = actual_start; i < actual_end; i++) {
			this.set_bit(i, bit_value);
		}

		return this;
	}

	slice(start = 0, end = this._length_in_bits) {
		const actual_start = Math.max(0, start);
		const actual_end = Math.min(this._length_in_bits, end);
		const slice_length = actual_end - actual_start;

		const result = new Uint1Array(slice_length);

		for (let i = 0; i < slice_length; i++) {
			result.set_bit(i, this.get_bit(actual_start + i));
		}

		return result;
	}

	copy_within(target, start = 0, end = this._length_in_bits) {
		const actual_start = Math.max(0, start);
		const actual_end = Math.min(this._length_in_bits, end);
		const copy_length = actual_end - actual_start;

		// Create temporary storage to handle overlapping ranges
		const temp_bits = [];
		for (let i = 0; i < copy_length; i++) {
			temp_bits.push(this.get_bit(actual_start + i));
		}

		for (let i = 0; i < copy_length && (target + i) < this._length_in_bits; i++) {
			this.set_bit(target + i, temp_bits[i]);
		}

		return this;
	}

	// Bitwise operations
	and(other) {
		if (!(other instanceof Uint1Array) || other._length_in_bits !== this._length_in_bits) {
			throw new Error("Other must be Uint1Array of same length");
		}

		const result = new Uint1Array(this._length_in_bits);
		for (let i = 0; i < this._byte_length; i++) {
			result._buffer[i] = this._buffer[i] & other._buffer[i];
		}

		return result;
	}

	or(other) {
		if (!(other instanceof Uint1Array) || other._length_in_bits !== this._length_in_bits) {
			throw new Error("Other must be Uint1Array of same length");
		}

		const result = new Uint1Array(this._length_in_bits);
		for (let i = 0; i < this._byte_length; i++) {
			result._buffer[i] = this._buffer[i] | other._buffer[i];
		}

		return result;
	}

	xor(other) {
		if (!(other instanceof Uint1Array) || other._length_in_bits !== this._length_in_bits) {
			throw new Error("Other must be Uint1Array of same length");
		}

		const result = new Uint1Array(this._length_in_bits);
		for (let i = 0; i < this._byte_length; i++) {
			result._buffer[i] = this._buffer[i] ^ other._buffer[i];
		}

		return result;
	}

	not() {
		const result = new Uint1Array(this._length_in_bits);
		for (let i = 0; i < this._byte_length; i++) {
			result._buffer[i] = ~this._buffer[i];
		}

		// Zero out excess bits in the last byte
		return result.to_uint1_array();
	}

	to_uint1_array() {
		const result = new Uint1Array(this._length_in_bits);
		result._buffer.set(this.to_uint8_array());
		return result;
	}

	// Convert to BigInt
	to_bigint() {
		let result = 0n;
		for (let i = 0; i < this._length_in_bits; i++) {
			result = (result << 1n) | BigInt(this.get_bit(i));
		}
		return result;
	}

	// Utility methods
	count_set_bits() {
		let count = 0;
		for (let i = 0; i < this._length_in_bits; i++) {
			if (this.get_bit(i)) {
				count++;
			}
		}
		return count;
	}

	find_first_set_bit() {
		for (let i = 0; i < this._length_in_bits; i++) {
			if (this.get_bit(i)) {
				return i;
			}
		}
		return -1;
	}

	find_last_set_bit() {
		for (let i = this._length_in_bits - 1; i >= 0; i--) {
			if (this.get_bit(i)) {
				return i;
			}
		}
		return -1;
	}

	// Iterator support
	*[Symbol.iterator]() {
		for (let i = 0; i < this._length_in_bits; i++) {
			yield this.get_bit(i);
		}
	}

	*entries() {
		for (let i = 0; i < this._length_in_bits; i++) {
			yield [i, this.get_bit(i)];
		}
	}

	*keys() {
		for (let i = 0; i < this._length_in_bits; i++) {
			yield i;
		}
	}

	*values() {
		for (let i = 0; i < this._length_in_bits; i++) {
			yield this.get_bit(i);
		}
	}

	// Array-like methods
	every(callback, this_arg) {
		for (let i = 0; i < this._length_in_bits; i++) {
			if (!callback.call(this_arg, this.get_bit(i), i, this)) {
				return false;
			}
		}
		return true;
	}

	some(callback, this_arg) {
		for (let i = 0; i < this._length_in_bits; i++) {
			if (callback.call(this_arg, this.get_bit(i), i, this)) {
				return true;
			}
		}
		return false;
	}

	for_each(callback, this_arg) {
		for (let i = 0; i < this._length_in_bits; i++) {
			callback.call(this_arg, this.get_bit(i), i, this);
		}
	}

	map(callback, this_arg) {
		const result = new Uint1Array(this._length_in_bits);
		for (let i = 0; i < this._length_in_bits; i++) {
			const mapped_value = callback.call(this_arg, this.get_bit(i), i, this);
			result.set_bit(i, mapped_value);
		}
		return result;
	}

	filter(callback, this_arg) {
		const temp_results = [];
		for (let i = 0; i < this._length_in_bits; i++) {
			const bit_value = this.get_bit(i);
			if (callback.call(this_arg, bit_value, i, this)) {
				temp_results.push(bit_value);
			}
		}

		const result = new Uint1Array(temp_results.length);
		temp_results.forEach((bit, index) => {
			result.set_bit(index, bit);
		});

		return result;
	}

	reduce(callback, initial_value) {
		let accumulator = initial_value;
		const start_index = initial_value === undefined ? 1 : 0;

		if (initial_value === undefined && this._length_in_bits === 0) {
			throw new TypeError("Reduce of empty array with no initial value");
		}

		if (initial_value === undefined) {
			accumulator = this.get_bit(0);
		}

		for (let i = start_index; i < this._length_in_bits; i++) {
			accumulator = callback(accumulator, this.get_bit(i), i, this);
		}

		return accumulator;
	}

	index_of(search_bit, from_index = 0) {
		const start = Math.max(0, from_index);
		for (let i = start; i < this._length_in_bits; i++) {
			if (this.get_bit(i) === search_bit) {
				return i;
			}
		}
		return -1;
	}

	last_index_of(search_bit, from_index = this._length_in_bits - 1) {
		const start = Math.min(this._length_in_bits - 1, from_index);
		for (let i = start; i >= 0; i--) {
			if (this.get_bit(i) === search_bit) {
				return i;
			}
		}
		return -1;
	}

	includes(search_bit, from_index = 0) {
		return this.index_of(search_bit, from_index) !== -1;
	}

	// String conversion
	to_string(radix = 2) {
		if (radix !== 2) {
			throw new Error("Only binary (radix 2) is supported");
		}

		let result = "";
		for (let i = 0; i < this._length_in_bits; i++) {
			result += this.get_bit(i).toString();
		}
		return result;
	}

	// Debug representation
	to_debug_string() {
		const bit_string = this.to_string();
		const byte_representation = Array.from(this._buffer)
			.map(byte => byte.toString(16).padStart(2, "0"))
			.join(" ");

		return `Uint1Array(${this._length_in_bits} bits): ${bit_string} [${byte_representation}]`;
	}

	// Equality check
	equals(other) {
		if (!(other instanceof Uint1Array) || other._length_in_bits !== this._length_in_bits) {
			return false;
		}

		// Compare the cleaned versions to handle excess bits properly
		const this_clean = this.to_uint8_array();
		const other_clean = other.to_uint8_array();

		for (let i = 0; i < this._byte_length; i++) {
			if (this_clean[i] !== other_clean[i]) {
				return false;
			}
		}

		return true;
	}

	// Set another Uint1Array into this one at the specified offset
	set(source, offset = 0) {
		if (!(source instanceof Uint1Array)) {
			throw new TypeError("Source must be a Uint1Array");
		}

		if (offset < 0 || offset >= this._length_in_bits) {
			throw new RangeError("Offset out of range");
		}

		const copy_length = Math.min(
			source._length_in_bits,
			this._length_in_bits - offset,
		);

		for (let i = 0; i < copy_length; i++) {
			this.set_bit(offset + i, source.get_bit(i));
		}

		return this;
	}
}

export default Uint1Array;
