import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import Uint1Array from "../Uint1Array.js";
import { create_unsuspended_promise, unsuspended_promise } from "unsuspended-promise";

// Safe wrapper functions that validate transformations
const safe_max_value = (bits) => {
	if (bits === 0) return 0n;
	return (1n << BigInt(bits)) - 1n;
};

const create_safe_wrappers = (remap, external_bits, max_internal_bits) => {
	const max_external_value = external_bits === 0 ? 0n : safe_max_value(external_bits);
	const max_internal_value = safe_max_value(max_internal_bits);

	const to_internal_safe = (external_value) => {
		const internal_value = remap.to_internal(external_value);

		if (false
			|| typeof internal_value !== "number"
			|| !Number.isInteger(internal_value)
			|| internal_value < 0
			|| BigInt(internal_value) > max_internal_value
		) {
			throw_error(error_user_payload(`to_internal returned invalid value ${internal_value}. Must be integer between 0 and ${max_internal_value}.`));
		}

		// Double-check round-trip consistency (only if external_bits > 0)
		if (external_bits > 0) {
			const round_trip_external = remap.to_external(internal_value);

			if (round_trip_external === undefined) {
				throw_error(error_user_payload(`Internal value ${internal_value} cannot be represented externally (to_external returned undefined).`));
			}

			if (round_trip_external !== external_value) {
				throw_error(error_user_payload(`to_internal / to_external are not consistent.${external_value} -> ${internal_value} -> ${round_trip_external}`));
			}
		}

		return internal_value;
	};

	const to_external_safe = (internal_value) => {
		if (external_bits === 0) {
			if (remap.to_external !== undefined) {
				throw_error(error_user_payload("to_external must be undefined when external_bits is 0"));
			}
			return undefined;
		}

		const external_value = remap.to_external(internal_value);

		// Allow to_external to return undefined to indicate non-representable values
		if (external_value === undefined) {
			throw_error(error_user_payload(`Internal value ${internal_value} cannot be represented externally(to_external returned undefined).`));
		}

		if (false
			|| typeof external_value !== "number"
			|| !Number.isInteger(external_value)
			|| external_value < 0
			|| BigInt(external_value) > max_external_value
		) {
			throw_error(error_user_payload(`to_external returned invalid value ${external_value}.Must be integer between 0 and ${max_external_value}.`));
		}

		// Double-check round-trip consistency
		const round_trip_internal = remap.to_internal(external_value);
		if (round_trip_internal !== internal_value) {
			throw_error(error_user_payload(`to_internal / to_external are not consistent.${internal_value} -> ${external_value} -> ${round_trip_internal}`));
		}

		return external_value;
	};

	return { to_internal_safe, to_external_safe };
};

const obtain_async_iterator = (promise_like) => {
	return async function* () {
		const iterator = await promise_like;

		for await (const entry of iterator) {
			yield entry;
		}
	};
};


export const _decode = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
	strategy ??= {};
	strategy.encoding_packet ??= {};
	strategy.encoding_packet.sbn ??= {};
	strategy.encoding_packet.esi ??= {};
	strategy.oti ??= {};

	// Set defaults for strategy.encoding_packet.sbn
	strategy.encoding_packet.sbn.external_bits ??= 8;
	strategy.encoding_packet.sbn.remap ??= {};

	// Validate strategy.encoding_packet.sbn
	if (false
		|| typeof strategy.encoding_packet.sbn.external_bits !== "number"
		|| !Number.isInteger(strategy.encoding_packet.sbn.external_bits)
		|| strategy.encoding_packet.sbn.external_bits < 0
		|| strategy.encoding_packet.sbn.external_bits > 8
	) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.external_bits must be integer between 0 and 8."));
	}

	// Set defaults for remap functions
	if (strategy.encoding_packet.sbn.external_bits === 0) {
		strategy.encoding_packet.sbn.remap.to_internal ??= (_unused) => 0;
		strategy.encoding_packet.sbn.remap.to_external = undefined; // Cannot be present if max_bits is 0
	} else {
		strategy.encoding_packet.sbn.remap.to_internal ??= (external) => external;
		strategy.encoding_packet.sbn.remap.to_external ??= (internal) => internal;
	}

	// Validate remap functions
	if (typeof strategy.encoding_packet.sbn.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_internal must be a function."));
	}

	if (strategy.encoding_packet.sbn.external_bits > 0) {
		if (typeof strategy.encoding_packet.sbn.remap.to_external !== "function") {
			throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_external must be a function when external_bits > 0."));
		}
	} else if (strategy.encoding_packet.sbn.remap.to_external !== undefined) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_external cannot be present when external_bits is 0."));
	}

	// Create safe wrappers for SBN (8 bits is the default max for internal SBN)
	const sbn_wrappers = create_safe_wrappers(strategy.encoding_packet.sbn.remap, strategy.encoding_packet.sbn.external_bits, 8);

	// Set defaults for strategy.encoding_packet.esi
	strategy.encoding_packet.esi.external_bits ??= 24;
	strategy.encoding_packet.esi.remap ??= {};

	// Validate strategy.encoding_packet.esi
	if (false
		|| typeof strategy.encoding_packet.esi.external_bits !== "number"
		|| !Number.isInteger(strategy.encoding_packet.esi.external_bits)
		|| strategy.encoding_packet.esi.external_bits < 2
		|| strategy.encoding_packet.esi.external_bits > 24
	) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.external_bits must be integer between 2 and 24."));
	}

	// Set defaults for ESI remap functions
	strategy.encoding_packet.esi.remap.to_internal ??= (external) => external;
	strategy.encoding_packet.esi.remap.to_external ??= (internal) => internal;

	// Validate ESI remap functions
	if (typeof strategy.encoding_packet.esi.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.remap.to_internal must be a function."));
	}

	if (typeof strategy.encoding_packet.esi.remap.to_external !== "function") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.remap.to_external must be a function."));
	}

	// Create safe wrappers for ESI (24 bits is the default max for internal ESI)
	const esi_wrappers = create_safe_wrappers(strategy.encoding_packet.esi.remap, strategy.encoding_packet.esi.external_bits, 24);
	// Process OTI if strategy.oti is configured
	const process_oti = (input_oti) => {
		if (input_oti !== undefined && !(input_oti instanceof Uint8Array)) {
			throw new Error("why is input_oti not a Uint8Array?");
		}

		// If no OTI strategy is configured, return the input OTI
		if (Object.keys(strategy.oti).length === 0) {
			return input_oti;
		}

		// Set defaults for all OTI fields when any OTI strategy is configured
		strategy.oti.transfer_length ??= {};
		strategy.oti.transfer_length.external_bits ??= 40;
		strategy.oti.transfer_length.remap ??= {};
		strategy.oti.transfer_length.remap.to_internal ??= (external) => external;
		strategy.oti.transfer_length.remap.to_external ??= (internal) => internal;

		strategy.oti.fec_encoding_id ??= {};
		strategy.oti.fec_encoding_id.external_bits ??= 8;
		// No remap functions for fec_encoding_id

		strategy.oti.symbol_size ??= {};
		strategy.oti.symbol_size.external_bits ??= 16;
		strategy.oti.symbol_size.remap ??= {};
		strategy.oti.symbol_size.remap.to_internal ??= (external) => external;
		strategy.oti.symbol_size.remap.to_external ??= (internal) => internal;

		strategy.oti.num_source_blocks ??= {};
		strategy.oti.num_source_blocks.external_bits ??= 8;
		strategy.oti.num_source_blocks.remap ??= {};
		strategy.oti.num_source_blocks.remap.to_internal ??= (external) => external;
		strategy.oti.num_source_blocks.remap.to_external ??= (internal) => internal;

		strategy.oti.num_sub_blocks ??= {};
		strategy.oti.num_sub_blocks.external_bits ??= 16;
		strategy.oti.num_sub_blocks.remap ??= {};
		strategy.oti.num_sub_blocks.remap.to_internal ??= (external) => external;
		strategy.oti.num_sub_blocks.remap.to_external ??= (internal) => internal;

		strategy.oti.symbol_alignment ??= {};
		strategy.oti.symbol_alignment.external_bits ??= 8;
		strategy.oti.symbol_alignment.remap ??= {};
		strategy.oti.symbol_alignment.remap.to_internal ??= (external) => external;
		strategy.oti.symbol_alignment.remap.to_external ??= (internal) => internal;

		// If input_oti is undefined, all values are hardcoded
		if (input_oti === undefined) {
			// Need to reconstruct the 12-byte OTI using hardcoded values from remap.to_internal()
			const reconstructed_oti = new Uint8Array(12);

			// Get hardcoded values - these MUST be provided by the strategy
			const transfer_length = strategy.oti.transfer_length?.remap?.to_internal?.(undefined);
			// fec_encoding_id is always hardcoded to 6, no remap functions allowed
			const fec_encoding_id = 6;
			const symbol_size = strategy.oti.symbol_size?.remap?.to_internal?.(undefined);
			const num_source_blocks = strategy.oti.num_source_blocks?.remap?.to_internal?.(undefined);
			const num_sub_blocks = strategy.oti.num_sub_blocks?.remap?.to_internal?.(undefined);
			const symbol_alignment = strategy.oti.symbol_alignment?.remap?.to_internal?.(undefined);

			// All hardcoded values must be provided and valid - no defaults!
			if (strategy.oti.transfer_length && (transfer_length === undefined || transfer_length === null)) {
				throw_error(error_user_payload("strategy.oti.transfer_length.remap.to_internal must return a valid value when external_bits is 0"));
			}
			// fec_encoding_id has no validation since it's always 6 and has no remap functions
			if (strategy.oti.symbol_size && (symbol_size === undefined || symbol_size === null)) {
				throw_error(error_user_payload("strategy.oti.symbol_size.remap.to_internal must return a valid value when external_bits is 0"));
			}
			if (strategy.oti.num_source_blocks && (num_source_blocks === undefined || num_source_blocks === null)) {
				throw_error(error_user_payload("strategy.oti.num_source_blocks.remap.to_internal must return a valid value when external_bits is 0"));
			}
			if (strategy.oti.num_sub_blocks && (num_sub_blocks === undefined || num_sub_blocks === null)) {
				throw_error(error_user_payload("strategy.oti.num_sub_blocks.remap.to_internal must return a valid value when external_bits is 0"));
			}
			if (strategy.oti.symbol_alignment && (symbol_alignment === undefined || symbol_alignment === null)) {
				throw_error(error_user_payload("strategy.oti.symbol_alignment.remap.to_internal must return a valid value when external_bits is 0"));
			}

			// Use actual hardcoded values (not defaults)
			const actual_transfer_length = transfer_length;
			const actual_fec_encoding_id = fec_encoding_id; // Always 6
			const actual_symbol_size = symbol_size;
			const actual_num_source_blocks = num_source_blocks;
			const actual_num_sub_blocks = num_sub_blocks;
			const actual_symbol_alignment = symbol_alignment;

			// Validate hardcoded values before packing
			if (false
				|| typeof actual_transfer_length !== "number"
				|| !Number.isInteger(actual_transfer_length)
				|| actual_transfer_length < 1
				|| actual_transfer_length > 942574504275
			) {
				throw_error(error_user_payload(`Invalid hardcoded transfer_length ${actual_transfer_length}.Must be integer between 1 and 942574504275.`));
			}

			if (false
				|| typeof actual_fec_encoding_id !== "number"
				|| !Number.isInteger(actual_fec_encoding_id)
				|| actual_fec_encoding_id < 0
				|| actual_fec_encoding_id > 255
			) {
				throw_error(error_user_payload(`Invalid hardcoded fec_encoding_id ${actual_fec_encoding_id}.Must be integer between 0 and 255.`));
			}

			if (false
				|| typeof actual_symbol_size !== "number"
				|| !Number.isInteger(actual_symbol_size)
				|| actual_symbol_size < 1
				|| actual_symbol_size > 65535
			) {
				throw_error(error_user_payload(`Invalid hardcoded symbol_size ${actual_symbol_size}.Must be integer between 1 and 65535.`));
			}

			if (false
				|| typeof actual_num_source_blocks !== "number"
				|| !Number.isInteger(actual_num_source_blocks)
				|| actual_num_source_blocks < 1
				|| actual_num_source_blocks > 256
			) {
				throw_error(error_user_payload(`Invalid hardcoded num_source_blocks ${actual_num_source_blocks}.Must be integer between 1 and 256.`));
			}

			if (false
				|| typeof actual_num_sub_blocks !== "number"
				|| !Number.isInteger(actual_num_sub_blocks)
				|| actual_num_sub_blocks < 1
				|| actual_num_sub_blocks > 65535
			) {
				throw_error(error_user_payload(`Invalid hardcoded num_sub_blocks ${actual_num_sub_blocks}.Must be integer between 1 and 65535.`));
			}

			if (false
				|| typeof actual_symbol_alignment !== "number"
				|| !Number.isInteger(actual_symbol_alignment)
				|| actual_symbol_alignment < 1
				|| actual_symbol_alignment > 255
			) {
				throw_error(error_user_payload(`Invalid hardcoded symbol_alignment ${actual_symbol_alignment}.Must be integer between 1 and 255.`));
			}

			// Validate symbols per block for hardcoded values
			const symbols_per_block = Math.ceil(actual_transfer_length / (actual_symbol_size * actual_num_source_blocks));
			const MAX_SOURCE_SYMBOLS_PER_BLOCK = 8192;
			if (symbols_per_block > MAX_SOURCE_SYMBOLS_PER_BLOCK) {
				throw_error(error_user_payload(`Hardcoded values would require ${symbols_per_block} symbols per block, exceeding limit of ${MAX_SOURCE_SYMBOLS_PER_BLOCK}.Adjust hardcoded symbol_size or num_source_blocks.`));
			}

			// Pack into 12-byte format
			const tl_big = BigInt(actual_transfer_length);
			reconstructed_oti[0] = Number((tl_big >> 32n) & 0xFFn);
			reconstructed_oti[1] = Number((tl_big >> 24n) & 0xFFn);
			reconstructed_oti[2] = Number((tl_big >> 16n) & 0xFFn);
			reconstructed_oti[3] = Number((tl_big >> 8n) & 0xFFn);
			reconstructed_oti[4] = Number(tl_big & 0xFFn);
			reconstructed_oti[5] = actual_fec_encoding_id & 0xFF;
			reconstructed_oti[6] = (actual_symbol_size >> 8) & 0xFF;
			reconstructed_oti[7] = actual_symbol_size & 0xFF;
			reconstructed_oti[8] = actual_num_source_blocks & 0xFF;
			reconstructed_oti[9] = (actual_num_sub_blocks >> 8) & 0xFF;
			reconstructed_oti[10] = actual_num_sub_blocks & 0xFF;
			reconstructed_oti[11] = actual_symbol_alignment & 0xFF;

			return reconstructed_oti;
		}

		// Parse the custom OTI and reconstruct the 12-byte standard OTI
		const custom_bits = input_oti.length * 8;
		const custom_oti_array = new Uint1Array(custom_bits);
		custom_oti_array.set_uint8array(input_oti);

		let bit_offset = 0;
		const reconstructed_oti = new Uint8Array(12);

		// Extract transfer_length
		let transfer_length;
		if (strategy.oti.transfer_length) {
			const bits = strategy.oti.transfer_length.external_bits;
			if (bits > 0) {
				const field_array = custom_oti_array.slice(bit_offset, bit_offset + bits);
				const external_value = Number(field_array.to_bigint());
				transfer_length = strategy.oti.transfer_length.remap?.to_internal
					? strategy.oti.transfer_length.remap.to_internal(external_value)
					: external_value;
				bit_offset += bits;
			} else {
				// Hardcoded value - must be provided by strategy
				if (!strategy.oti.transfer_length?.remap?.to_internal) {
					throw_error(error_user_payload("strategy.oti.transfer_length.remap.to_internal is required when external_bits is 0"));
				}
				transfer_length = strategy.oti.transfer_length.remap.to_internal(undefined);
			}
		}

		// Pack transfer_length (40 bits = 5 bytes)
		const tl_big = BigInt(transfer_length);
		reconstructed_oti[0] = Number((tl_big >> 32n) & 0xFFn);
		reconstructed_oti[1] = Number((tl_big >> 24n) & 0xFFn);
		reconstructed_oti[2] = Number((tl_big >> 16n) & 0xFFn);
		reconstructed_oti[3] = Number((tl_big >> 8n) & 0xFFn);
		reconstructed_oti[4] = Number(tl_big & 0xFFn);

		// Extract fec_encoding_id
		let fec_encoding_id;
		if (strategy.oti.fec_encoding_id && strategy.oti.fec_encoding_id.external_bits > 0) {
			if (strategy.oti.fec_encoding_id.external_bits !== 8) {
				throw_error(error_user_payload(`fec_encoding_id.external_bits must be 0(omitted) or 8(present), got ${strategy.oti.fec_encoding_id.external_bits}`));
			}
			const field_array = custom_oti_array.slice(bit_offset, bit_offset + 8);
			const external_value = Number(field_array.to_bigint());
			// fec_encoding_id has no remap functions, should always be 6
			fec_encoding_id = external_value;
			bit_offset += 8;
		} else {
			// FEC encoding ID is omitted - always hardcoded to 6
			fec_encoding_id = 6;
		}
		reconstructed_oti[5] = fec_encoding_id & 0xFF;

		// Extract symbol_size
		let symbol_size;
		if (strategy.oti.symbol_size) {
			const bits = strategy.oti.symbol_size.external_bits ?? 16;
			if (bits > 0) {
				const field_array = custom_oti_array.slice(bit_offset, bit_offset + bits);
				const external_value = Number(field_array.to_bigint());
				symbol_size = strategy.oti.symbol_size.remap?.to_internal
					? strategy.oti.symbol_size.remap.to_internal(external_value)
					: external_value;
				bit_offset += bits;
			} else {
				// Hardcoded value - must be provided by strategy
				if (!strategy.oti.symbol_size?.remap?.to_internal) {
					throw_error(error_user_payload("strategy.oti.symbol_size.remap.to_internal is required when external_bits is 0"));
				}
				symbol_size = strategy.oti.symbol_size.remap.to_internal(undefined);
			}
		}

		// Pack symbol_size (16 bits = 2 bytes)
		reconstructed_oti[6] = (symbol_size >> 8) & 0xFF;
		reconstructed_oti[7] = symbol_size & 0xFF;

		// Extract num_source_blocks
		let num_source_blocks;
		if (strategy.oti.num_source_blocks) {
			const bits = strategy.oti.num_source_blocks.external_bits ?? 8;
			if (bits > 0) {
				const field_array = custom_oti_array.slice(bit_offset, bit_offset + bits);
				const external_value = Number(field_array.to_bigint());
				num_source_blocks = strategy.oti.num_source_blocks.remap?.to_internal
					? strategy.oti.num_source_blocks.remap.to_internal(external_value)
					: external_value;
				bit_offset += bits;
			} else {
				// Hardcoded value - must be provided by strategy
				if (!strategy.oti.num_source_blocks?.remap?.to_internal) {
					throw_error(error_user_payload("strategy.oti.num_source_blocks.remap.to_internal is required when external_bits is 0"));
				}
				num_source_blocks = strategy.oti.num_source_blocks.remap.to_internal(undefined);
			}
		}
		reconstructed_oti[8] = num_source_blocks & 0xFF;

		// Extract num_sub_blocks
		let num_sub_blocks;
		if (strategy.oti.num_sub_blocks) {
			const bits = strategy.oti.num_sub_blocks.external_bits ?? 16;
			if (bits > 0) {
				const field_array = custom_oti_array.slice(bit_offset, bit_offset + bits);
				const external_value = Number(field_array.to_bigint());
				num_sub_blocks = strategy.oti.num_sub_blocks.remap?.to_internal
					? strategy.oti.num_sub_blocks.remap.to_internal(external_value)
					: external_value;
				bit_offset += bits;
			} else {
				// Hardcoded value - must be provided by strategy
				if (!strategy.oti.num_sub_blocks?.remap?.to_internal) {
					throw_error(error_user_payload("strategy.oti.num_sub_blocks.remap.to_internal is required when external_bits is 0"));
				}
				num_sub_blocks = strategy.oti.num_sub_blocks.remap.to_internal(undefined);
			}
		}

		// Pack num_sub_blocks (16 bits = 2 bytes)
		reconstructed_oti[9] = (num_sub_blocks >> 8) & 0xFF;
		reconstructed_oti[10] = num_sub_blocks & 0xFF;

		// Extract symbol_alignment
		let symbol_alignment;
		if (strategy.oti.symbol_alignment) {
			const bits = strategy.oti.symbol_alignment.external_bits ?? 8;
			if (bits > 0) {
				const field_array = custom_oti_array.slice(bit_offset, bit_offset + bits);
				const external_value = Number(field_array.to_bigint());
				symbol_alignment = strategy.oti.symbol_alignment.remap?.to_internal
					? strategy.oti.symbol_alignment.remap.to_internal(external_value)
					: external_value;
				bit_offset += bits;
			} else {
				// Hardcoded value - must be provided by strategy
				if (!strategy.oti.symbol_alignment?.remap?.to_internal) {
					throw_error(error_user_payload("strategy.oti.symbol_alignment.remap.to_internal is required when external_bits is 0"));
				}
				symbol_alignment = strategy.oti.symbol_alignment.remap.to_internal(undefined);
			}
		}
		reconstructed_oti[11] = symbol_alignment & 0xFF;

		// Validate the reconstructed OTI values before returning to prevent Rust panics
		if (false
			|| typeof transfer_length !== "number"
			|| !Number.isInteger(transfer_length)
			|| transfer_length < 1
			|| transfer_length > 942574504275 // Max value from Rust assertion
		) {
			throw_error(error_user_payload(`Invalid transfer_length ${transfer_length}.Must be integer between 1 and 942574504275.`));
		}

		if (false
			|| typeof fec_encoding_id !== "number"
			|| !Number.isInteger(fec_encoding_id)
			|| fec_encoding_id < 0
			|| fec_encoding_id > 255
		) {
			throw_error(error_user_payload(`Invalid fec_encoding_id ${fec_encoding_id}.Must be integer between 0 and 255.`));
		}

		if (false
			|| typeof symbol_size !== "number"
			|| !Number.isInteger(symbol_size)
			|| symbol_size < 1
			|| symbol_size > 65535 // 16-bit max
		) {
			throw_error(error_user_payload(`Invalid symbol_size ${symbol_size}.Must be integer between 1 and 65535.`));
		}

		if (false
			|| typeof num_source_blocks !== "number"
			|| !Number.isInteger(num_source_blocks)
			|| num_source_blocks < 1
			|| num_source_blocks > 256 // RaptorQ max
		) {
			throw_error(error_user_payload(`Invalid num_source_blocks ${num_source_blocks}.Must be integer between 1 and 256.`));
		}

		if (false
			|| typeof num_sub_blocks !== "number"
			|| !Number.isInteger(num_sub_blocks)
			|| num_sub_blocks < 1
			|| num_sub_blocks > 65535 // 16-bit max
		) {
			throw_error(error_user_payload(`Invalid num_sub_blocks ${num_sub_blocks}.Must be integer between 1 and 65535.`));
		}

		if (false
			|| typeof symbol_alignment !== "number"
			|| !Number.isInteger(symbol_alignment)
			|| symbol_alignment < 1
			|| symbol_alignment > 255 // 8-bit max
		) {
			throw_error(error_user_payload(`Invalid symbol_alignment ${symbol_alignment}.Must be integer between 1 and 255.`));
		}

		// Additional validation: check that symbols_required doesn't exceed limits
		// symbols_required is roughly transfer_length / symbol_size per source block
		const symbols_per_block = Math.ceil(transfer_length / (symbol_size * num_source_blocks));
		const MAX_SOURCE_SYMBOLS_PER_BLOCK = 8192; // Common RaptorQ limit
		if (symbols_per_block > MAX_SOURCE_SYMBOLS_PER_BLOCK) {
			throw_error(error_user_payload(`Symbol configuration would require ${symbols_per_block} symbols per block, exceeding limit of ${MAX_SOURCE_SYMBOLS_PER_BLOCK}.Try increasing symbol_size or num_source_blocks.`));
		}

		return reconstructed_oti;
	};

	const processed_oti = process_oti(oti);

	// Transform the encoding packets based on strategy before passing to raw decode
	const transformed_encoding_packets = {
		async *[Symbol.asyncIterator]() {
			for await (const packet of encoding_packets) {
				let transformed_packet;

				if (strategy.encoding_packet.sbn.external_bits === 0) {
					// Extract ESI from packed bits using Uint1Array
					const esi_bits = strategy.encoding_packet.esi.external_bits;
					const esi_bytes_needed = Math.ceil(esi_bits / 8);
					const esi_packed_bytes = packet.slice(0, esi_bytes_needed);

					// Create Uint1Array from packed bytes to extract ESI bits
					const combined_array = new Uint1Array(esi_bits);
					combined_array.get_underlying_buffer().set(esi_packed_bytes);

					// Extract ESI array (entire array in this case)
					const esi_array = combined_array.slice(0, esi_bits);
					const external_esi = Number(esi_array.to_bigint());

					// Apply ESI remap to get internal ESI value using safe wrapper
					const internal_esi = esi_wrappers.to_internal_safe(external_esi);

					// Convert internal ESI to 3-byte format
					const internal_esi_bytes = new Uint8Array(3);
					internal_esi_bytes[0] = (internal_esi >> 16) & 0xFF;
					internal_esi_bytes[1] = (internal_esi >> 8) & 0xFF;
					internal_esi_bytes[2] = internal_esi & 0xFF;

					// Reconstruct packet: SBN (0) + internal ESI (3 bytes) + symbol data
					const symbol_data = packet.slice(esi_bytes_needed);
					transformed_packet = new Uint8Array(1 + 3 + symbol_data.length);
					transformed_packet[0] = 0; // SBN is 0 since external_bits is 0
					transformed_packet.set(internal_esi_bytes, 1);
					transformed_packet.set(symbol_data, 4);
				} else {
					// Extract SBN+ESI from packed bits using unified Uint1Array
					const total_bits = strategy.encoding_packet.sbn.external_bits + strategy.encoding_packet.esi.external_bits;
					const total_bytes_needed = Math.ceil(total_bits / 8);
					const packed_bytes = packet.slice(0, total_bytes_needed);

					// Create unified Uint1Array from packed bytes
					const combined_array = new Uint1Array(total_bits);
					combined_array.get_underlying_buffer().set(packed_bytes);

					// Extract separate SBN and ESI arrays
					const sbn_array = combined_array.slice(0, strategy.encoding_packet.sbn.external_bits);
					const esi_array = combined_array.slice(strategy.encoding_packet.sbn.external_bits, total_bits);

					// Convert to values using BigInt
					const external_sbn = Number(sbn_array.to_bigint());
					const external_esi = Number(esi_array.to_bigint());

					// Apply remap functions to get internal values using safe wrappers
					const internal_sbn = sbn_wrappers.to_internal_safe(external_sbn);
					const internal_esi = esi_wrappers.to_internal_safe(external_esi);

					// Convert internal ESI to 3-byte format
					const internal_esi_bytes = new Uint8Array(3);
					internal_esi_bytes[0] = (internal_esi >> 16) & 0xFF;
					internal_esi_bytes[1] = (internal_esi >> 8) & 0xFF;
					internal_esi_bytes[2] = internal_esi & 0xFF;

					// Reconstruct packet: SBN (1 byte) + internal ESI (3 bytes) + symbol data
					const symbol_data = packet.slice(total_bytes_needed);
					transformed_packet = new Uint8Array(1 + 3 + symbol_data.length);
					transformed_packet[0] = internal_sbn & 0xFF; // Convert to single byte
					transformed_packet.set(internal_esi_bytes, 1);
					transformed_packet.set(symbol_data, 4);
				}

				yield transformed_packet;
			}
		}
	};

	return raptorq_raw.decode({ usage, oti: processed_oti, encoding_packets: transformed_encoding_packets });
};

// Helper function to calculate expected OTI size from strategy
const calculate_oti_size = (strategy) => {
	if (Object.keys(strategy.oti).length === 0) {
		return 12; // Default 12-byte OTI
	}

	// Set defaults for all OTI fields exactly like the encoder does
	const oti_config = {
		transfer_length: {
			external_bits: 40,
			...strategy.oti.transfer_length
		},
		fec_encoding_id: {
			external_bits: 8,
			...strategy.oti.fec_encoding_id
		},
		symbol_size: {
			external_bits: 16,
			...strategy.oti.symbol_size
		},
		num_source_blocks: {
			external_bits: 8,
			...strategy.oti.num_source_blocks
		},
		num_sub_blocks: {
			external_bits: 16,
			...strategy.oti.num_sub_blocks
		},
		symbol_alignment: {
			external_bits: 8,
			...strategy.oti.symbol_alignment
		},
	};

	const total_bits = (0
		+ oti_config.transfer_length.external_bits
		+ oti_config.fec_encoding_id.external_bits
		+ oti_config.symbol_size.external_bits
		+ oti_config.num_source_blocks.external_bits
		+ oti_config.num_sub_blocks.external_bits
		+ oti_config.symbol_alignment.external_bits
	);

	if (total_bits === 0) {
		return 0; // No OTI needed
	}

	return Math.ceil(total_bits / 8); // Convert bits to bytes
};

export const decode = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
	strategy ??= {};
	strategy.oti ??= {};

	// Set defaults and validate strategy.oti.placement
	strategy.oti.placement ??= "negotation";
	if (strategy.oti.placement !== "negotation" && strategy.oti.placement !== "encoding_packet") {
		throw_error(error_user_payload(`Provided strategy.oti.placement must be "negotation" or "encoding_packet", got "${strategy.oti.placement}"`));
	}

	// Validate that oti is undefined when placement is "encoding_packet"
	if (strategy.oti.placement === "encoding_packet") {
		if (oti !== undefined) {
			throw_error(error_user_payload("When strategy.oti.placement is 'encoding_packet', the oti parameter must be undefined"));
		}

		// Extract OTI from encoding packets and call _decode once we have it
		const expected_oti_size = calculate_oti_size(strategy);

		if (expected_oti_size === 0) {
			// No OTI expected, pass packets through unchanged
			return _decode({ raptorq_raw }, { usage, oti: undefined, encoding_packets, strategy });
		}

		let extracted_oti = null;
		let oti_resolved = false;
		const [oti_prom, oti_prom_res, oti_prom_rej] = create_unsuspended_promise();

		const oti_extracting_packets = (async function* () {
			for await (const packet of encoding_packets) {
				if (!oti_resolved) {
					if (packet.length < expected_oti_size) {
						throw_error(error_user_payload(`Packet too small to contain OTI. Expected at least ${expected_oti_size} bytes, got ${packet.length}`));
					}

					// Extract OTI from the beginning of the packet
					const packet_oti = packet.slice(0, expected_oti_size);
					const remaining_packet = packet.slice(expected_oti_size);

					if (extracted_oti === null) {
						// First packet - store the OTI
						extracted_oti = packet_oti;
						oti_prom_res(extracted_oti);
						oti_resolved = true;
					} else {
						// Subsequent packets - verify OTI consistency
						let oti_matches = true;
						if (packet_oti.length !== extracted_oti.length) {
							oti_matches = false;
						} else {
							for (let i = 0; i < packet_oti.length; i++) {
								if (packet_oti[i] !== extracted_oti[i]) {
									oti_matches = false;
									break;
								}
							}
						}

						if (!oti_matches) {
							throw_error(error_user_payload("OTI mismatch detected in encoding packets. All packets must have identical OTI when using per-packet placement."));
						}
					}

					yield remaining_packet;
				} else {
					// OTI already extracted, just strip it from packets
					yield packet.slice(expected_oti_size);
				}
			}
		})();

		// Create the decode function that waits for OTI
		const decode_with_extracted_oti = unsuspended_promise((async () => {
			const final_oti = await oti_prom;
			return _decode({ raptorq_raw }, { usage, oti: final_oti, encoding_packets: oti_extracting_packets, strategy });
		})());

		// Return based on usage type
		if (usage?.output_format === "blocks") {
			return obtain_async_iterator(decode_with_extracted_oti);
		} else {
			return decode_with_extracted_oti;
		}
	}

	// Standard flow for "negotation" placement
	return _decode({ raptorq_raw }, { usage, oti, encoding_packets, strategy });
};
