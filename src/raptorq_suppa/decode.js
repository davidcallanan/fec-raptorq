import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import Uint1Array from "../Uint1Array.js";
import { create_unsuspended_promise, unsuspended_promise } from "unsuspended-promise";
import { bigint_ceil } from "../uoe/bigint_ceil.js";

// Safe wrapper functions that validate transformations
const safe_max_value = (bits) => {
	if (bits === 0n) return 0n;
	return (1n << bits) - 1n;
};

const create_safe_wrappers = (remap, external_bits, max_internal_bits) => {
	const max_external_value = external_bits === 0n ? 0n : safe_max_value(external_bits);
	const max_internal_value = safe_max_value(max_internal_bits);

	const to_internal_safe = (external_value) => {
		const internal_value = remap.to_internal(external_value);

		if (false
			|| typeof internal_value !== "bigint"
			|| internal_value < 0n
			|| internal_value > max_internal_value
		) {
			throw_error(error_user_payload(`to_internal returned invalid value ${internal_value}. Must be bigint between 0n and ${max_internal_value}.`));
		}

		// Double-check round-trip consistency (only if external_bits > 0n)
		if (external_bits > 0n) {
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
		if (external_bits === 0n) {
			if (remap.to_external !== undefined) {
				throw_error(error_user_payload("to_external must be undefined when external_bits is 0n"));
			}
			return undefined;
		}

		const external_value = remap.to_external(internal_value);

		// Allow to_external to return undefined to indicate non-representable values
		if (external_value === undefined) {
			throw_error(error_user_payload(`Internal value ${internal_value} cannot be represented externally(to_external returned undefined).`));
		}

		if (false
			|| typeof external_value !== "bigint"
			|| external_value < 0n
			|| external_value > max_external_value
		) {
			throw_error(error_user_payload(`to_external returned invalid value ${external_value}.Must be bigint between 0n and ${max_external_value}.`));
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

// Factory function to create process_oti function for a given strategy
const create_process_oti = (strategy) => {
	return (input_oti) => {
		if (input_oti !== undefined && !(input_oti instanceof Uint8Array)) {
			throw new Error("why is input_oti not a Uint8Array?");
		}

		// If no OTI strategy is configured, return the input OTI
		if (Object.keys(strategy.oti).length === 0) {
			return input_oti;
		}

		// Set defaults for all OTI fields when any OTI strategy is configured
		strategy.oti.transfer_length ??= {};
		strategy.oti.transfer_length.external_bits ??= 40n;
		strategy.oti.transfer_length.remap ??= {};
		strategy.oti.transfer_length.remap.to_internal ??= (external) => external;
		strategy.oti.transfer_length.remap.to_external ??= (internal) => internal;

		strategy.oti.fec_encoding_id ??= {};
		strategy.oti.fec_encoding_id.external_bits ??= 8n;
		// No remap functions for fec_encoding_id

		strategy.oti.symbol_size ??= {};
		strategy.oti.symbol_size.external_bits ??= 16n;
		strategy.oti.symbol_size.remap ??= {};
		strategy.oti.symbol_size.remap.to_internal ??= (external) => external;
		strategy.oti.symbol_size.remap.to_external ??= (internal) => internal;

		strategy.oti.num_source_blocks ??= {};
		strategy.oti.num_source_blocks.external_bits ??= 8n;
		strategy.oti.num_source_blocks.remap ??= {};
		strategy.oti.num_source_blocks.remap.to_internal ??= (external) => external;
		strategy.oti.num_source_blocks.remap.to_external ??= (internal) => internal;

		strategy.oti.num_sub_blocks ??= {};
		strategy.oti.num_sub_blocks.external_bits ??= 16n;
		strategy.oti.num_sub_blocks.remap ??= {};
		strategy.oti.num_sub_blocks.remap.to_internal ??= (external) => external;
		strategy.oti.num_sub_blocks.remap.to_external ??= (internal) => internal;

		strategy.oti.symbol_alignment ??= {};
		strategy.oti.symbol_alignment.external_bits ??= 8n;
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
			const fec_encoding_id = 6n;
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
			const actual_fec_encoding_id = fec_encoding_id; // Always 6n
			const actual_symbol_size = symbol_size;
			const actual_num_source_blocks = num_source_blocks;
			const actual_num_sub_blocks = num_sub_blocks;
			const actual_symbol_alignment = symbol_alignment;

			// Validate hardcoded values before packing
			if (false
				|| typeof actual_transfer_length !== "bigint"
				|| actual_transfer_length < 1n
				|| actual_transfer_length > 942574504275n
			) {
				throw_error(error_user_payload(`Invalid hardcoded transfer_length ${actual_transfer_length}.Must be bigint between 1n and 942574504275n.`));
			}

			if (false
				|| typeof actual_fec_encoding_id !== "bigint"
				|| actual_fec_encoding_id < 0n
				|| actual_fec_encoding_id > 255n
			) {
				throw_error(error_user_payload(`Invalid hardcoded fec_encoding_id ${actual_fec_encoding_id}.Must be bigint between 0n and 255n.`));
			}

			if (false
				|| typeof actual_symbol_size !== "bigint"
				|| actual_symbol_size < 1n
				|| actual_symbol_size > 65535n
			) {
				throw_error(error_user_payload(`Invalid hardcoded symbol_size ${actual_symbol_size}.Must be bigint between 1n and 65535n.`));
			}

			if (false
				|| typeof actual_num_source_blocks !== "bigint"
				|| actual_num_source_blocks < 1n
				|| actual_num_source_blocks > 256n
			) {
				throw_error(error_user_payload(`Invalid hardcoded num_source_blocks ${actual_num_source_blocks}.Must be bigint between 1n and 256n.`));
			}

			if (false
				|| typeof actual_num_sub_blocks !== "bigint"
				|| actual_num_sub_blocks < 1n
				|| actual_num_sub_blocks > 65535n
			) {
				throw_error(error_user_payload(`Invalid hardcoded num_sub_blocks ${actual_num_sub_blocks}.Must be bigint between 1n and 65535n.`));
			}

			if (false
				|| typeof actual_symbol_alignment !== "bigint"
				|| actual_symbol_alignment < 1n
				|| actual_symbol_alignment > 255n
			) {
				throw_error(error_user_payload(`Invalid hardcoded symbol_alignment ${actual_symbol_alignment}.Must be bigint between 1n and 255n.`));
			}

			// Validate symbols per block for hardcoded values
			const symbols_per_block = bigint_ceil(actual_transfer_length, (actual_symbol_size * actual_num_source_blocks));
			const MAX_SOURCE_SYMBOLS_PER_BLOCK = 8192n;
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
			reconstructed_oti[5] = Number(actual_fec_encoding_id) & 0xFF;
			reconstructed_oti[6] = (Number(actual_symbol_size) >> 8) & 0xFF;
			reconstructed_oti[7] = Number(actual_symbol_size) & 0xFF;
			reconstructed_oti[8] = Number(actual_num_source_blocks) & 0xFF;
			reconstructed_oti[9] = (Number(actual_num_sub_blocks) >> 8) & 0xFF;
			reconstructed_oti[10] = Number(actual_num_sub_blocks) & 0xFF;
			reconstructed_oti[11] = Number(actual_symbol_alignment) & 0xFF;

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
			if (bits > 0n) {
				const field_array = custom_oti_array.slice(bit_offset, bit_offset + Number(bits));
				const external_value = field_array.to_bigint();
				transfer_length = strategy.oti.transfer_length.remap?.to_internal
					? strategy.oti.transfer_length.remap.to_internal(external_value)
					: external_value;
				bit_offset += Number(bits);
			} else {
				// Hardcoded value - must be provided by strategy
				if (!strategy.oti.transfer_length?.remap?.to_internal) {
					throw_error(error_user_payload("strategy.oti.transfer_length.remap.to_internal is required when external_bits is 0n"));
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
		if (strategy.oti.fec_encoding_id && strategy.oti.fec_encoding_id.external_bits > 0n) {
			if (strategy.oti.fec_encoding_id.external_bits !== 8n) {
				throw_error(error_user_payload(`fec_encoding_id.external_bits must be 0n(omitted) or 8n(present), got ${strategy.oti.fec_encoding_id.external_bits}`));
			}
			const field_array = custom_oti_array.slice(bit_offset, bit_offset + 8);
			const external_value = field_array.to_bigint();
			// fec_encoding_id has no remap functions, should always be 6n
			fec_encoding_id = external_value;
			bit_offset += 8;
		} else {
			// FEC encoding ID is omitted - always hardcoded to 6n
			fec_encoding_id = 6n;
		}
		reconstructed_oti[5] = Number(fec_encoding_id & 0xFFn);

		// Extract symbol_size
		let symbol_size;
		if (strategy.oti.symbol_size) {
			const bits = strategy.oti.symbol_size.external_bits;
			if (bits > 0n) {
				const field_array = custom_oti_array.slice(bit_offset, bit_offset + Number(bits));
				const external_value = field_array.to_bigint();
				symbol_size = strategy.oti.symbol_size.remap?.to_internal
					? strategy.oti.symbol_size.remap.to_internal(external_value)
					: external_value;
				bit_offset += Number(bits);
			} else {
				// Hardcoded value - must be provided by strategy
				if (!strategy.oti.symbol_size?.remap?.to_internal) {
					throw_error(error_user_payload("strategy.oti.symbol_size.remap.to_internal is required when external_bits is 0n"));
				}
				symbol_size = strategy.oti.symbol_size.remap.to_internal(undefined);
			}
		}

		// Pack symbol_size (16 bits = 2 bytes)
		reconstructed_oti[6] = (Number(symbol_size) >> 8) & 0xFF;
		reconstructed_oti[7] = Number(symbol_size) & 0xFF;

		// Extract num_source_blocks
		let num_source_blocks;
		if (strategy.oti.num_source_blocks) {
			const bits = strategy.oti.num_source_blocks.external_bits;
			if (bits > 0n) {
				const field_array = custom_oti_array.slice(bit_offset, bit_offset + Number(bits));
				const external_value = field_array.to_bigint();
				num_source_blocks = strategy.oti.num_source_blocks.remap?.to_internal
					? strategy.oti.num_source_blocks.remap.to_internal(external_value)
					: external_value;
				bit_offset += Number(bits);
			} else {
				// Hardcoded value - must be provided by strategy
				if (!strategy.oti.num_source_blocks?.remap?.to_internal) {
					throw_error(error_user_payload("strategy.oti.num_source_blocks.remap.to_internal is required when external_bits is 0n"));
				}
				num_source_blocks = strategy.oti.num_source_blocks.remap.to_internal(undefined);
			}
		}
		reconstructed_oti[8] = Number(num_source_blocks) & 0xFF;

		// Extract num_sub_blocks
		let num_sub_blocks;
		if (strategy.oti.num_sub_blocks) {
			const bits = strategy.oti.num_sub_blocks.external_bits;
			if (bits > 0n) {
				const field_array = custom_oti_array.slice(bit_offset, bit_offset + Number(bits));
				const external_value = field_array.to_bigint();
				num_sub_blocks = strategy.oti.num_sub_blocks.remap?.to_internal
					? strategy.oti.num_sub_blocks.remap.to_internal(external_value)
					: external_value;
				bit_offset += Number(bits);
			} else {
				// Hardcoded value - must be provided by strategy
				if (!strategy.oti.num_sub_blocks?.remap?.to_internal) {
					throw_error(error_user_payload("strategy.oti.num_sub_blocks.remap.to_internal is required when external_bits is 0n"));
				}
				num_sub_blocks = strategy.oti.num_sub_blocks.remap.to_internal(undefined);
			}
		}

		// Pack num_sub_blocks (16 bits = 2 bytes)
		reconstructed_oti[9] = (Number(num_sub_blocks) >> 8) & 0xFF;
		reconstructed_oti[10] = Number(num_sub_blocks) & 0xFF;

		// Extract symbol_alignment
		let symbol_alignment;
		if (strategy.oti.symbol_alignment) {
			const bits = strategy.oti.symbol_alignment.external_bits;
			if (bits > 0n) {
				const field_array = custom_oti_array.slice(bit_offset, bit_offset + Number(bits));
				const external_value = field_array.to_bigint();
				symbol_alignment = strategy.oti.symbol_alignment.remap?.to_internal
					? strategy.oti.symbol_alignment.remap.to_internal(external_value)
					: external_value;
				bit_offset += Number(bits);
			} else {
				// Hardcoded value - must be provided by strategy
				if (!strategy.oti.symbol_alignment?.remap?.to_internal) {
					throw_error(error_user_payload("strategy.oti.symbol_alignment.remap.to_internal is required when external_bits is 0n"));
				}
				symbol_alignment = strategy.oti.symbol_alignment.remap.to_internal(undefined);
			}
		}
		reconstructed_oti[11] = Number(symbol_alignment) & 0xFF;

		// Validate the reconstructed OTI values before returning to prevent Rust panics
		if (false
			|| typeof transfer_length !== "bigint"
			|| transfer_length < 1n
			|| transfer_length > 942574504275n // Max value from Rust assertion
		) {
			throw_error(error_user_payload(`Invalid transfer_length ${transfer_length}.Must be bigint between 1n and 942574504275n.`));
		}

		if (false
			|| typeof fec_encoding_id !== "bigint"
			|| fec_encoding_id < 0n
			|| fec_encoding_id > 255n
		) {
			throw_error(error_user_payload(`Invalid fec_encoding_id ${fec_encoding_id}.Must be bigint between 0n and 255n.`));
		}

		if (false
			|| typeof symbol_size !== "bigint"
			|| symbol_size < 1n
			|| symbol_size > 65535n // 16-bit max
		) {
			throw_error(error_user_payload(`Invalid symbol_size ${symbol_size}.Must be bigint between 1n and 65535n.`));
		}

		if (false
			|| typeof num_source_blocks !== "bigint"
			|| num_source_blocks < 1n
			|| num_source_blocks > 256n // RaptorQ max
		) {
			throw_error(error_user_payload(`Invalid num_source_blocks ${num_source_blocks}.Must be bigint between 1n and 256n.`));
		}

		if (false
			|| typeof num_sub_blocks !== "bigint"
			|| num_sub_blocks < 1n
			|| num_sub_blocks > 65535n // 16-bit max
		) {
			throw_error(error_user_payload(`Invalid num_sub_blocks ${num_sub_blocks}.Must be bigint between 1n and 65535n.`));
		}

		if (false
			|| typeof symbol_alignment !== "bigint"
			|| symbol_alignment < 1n
			|| symbol_alignment > 255n // 8-bit max
		) {
			throw_error(error_user_payload(`Invalid symbol_alignment ${symbol_alignment}.Must be bigint between 1n and 255n.`));
		}

		// Additional validation: check that symbols_required doesn't exceed limits
		// symbols_required is roughly transfer_length / symbol_size per source block
		const symbols_per_block = Math.ceil(Number(transfer_length) / (Number(symbol_size) * Number(num_source_blocks)));
		const MAX_SOURCE_SYMBOLS_PER_BLOCK = 8192; // Common RaptorQ limit
		if (symbols_per_block > MAX_SOURCE_SYMBOLS_PER_BLOCK) {
			throw_error(error_user_payload(`Symbol configuration would require ${symbols_per_block} symbols per block, exceeding limit of ${MAX_SOURCE_SYMBOLS_PER_BLOCK}.Try increasing symbol_size or num_source_blocks.`));
		}

		return reconstructed_oti;
	};
};


export const _decode = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
	strategy ??= {};
	strategy.encoding_packet ??= {};
	strategy.encoding_packet.sbn ??= {};
	strategy.encoding_packet.esi ??= {};
	strategy.oti ??= {};

	// Set defaults for strategy.encoding_packet.sbn
	strategy.encoding_packet.sbn.external_bits ??= 8n;
	strategy.encoding_packet.sbn.remap ??= {};

	// Validate strategy.encoding_packet.sbn
	if (false
		|| typeof strategy.encoding_packet.sbn.external_bits !== "bigint"
		|| strategy.encoding_packet.sbn.external_bits < 0n
		|| strategy.encoding_packet.sbn.external_bits > 8n
	) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.external_bits must be bigint between 0n and 8n."));
	}

	// Set defaults for remap functions
	if (strategy.encoding_packet.sbn.external_bits === 0n) {
		strategy.encoding_packet.sbn.remap.to_internal ??= (_unused) => 0n;
		strategy.encoding_packet.sbn.remap.to_external = undefined; // Cannot be present if max_bits is 0n
	} else {
		strategy.encoding_packet.sbn.remap.to_internal ??= (external) => external;
		strategy.encoding_packet.sbn.remap.to_external ??= (internal) => internal;
	}

	// Validate remap functions
	if (typeof strategy.encoding_packet.sbn.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_internal must be a function."));
	}

	if (strategy.encoding_packet.sbn.external_bits > 0n) {
		if (typeof strategy.encoding_packet.sbn.remap.to_external !== "function") {
			throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_external must be a function when external_bits > 0n."));
		}
	} else if (strategy.encoding_packet.sbn.remap.to_external !== undefined) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_external cannot be present when external_bits is 0n."));
	}

	// Create safe wrappers for SBN (8 bits is the default max for internal SBN)
	const sbn_wrappers = create_safe_wrappers(strategy.encoding_packet.sbn.remap, strategy.encoding_packet.sbn.external_bits, 8n);

	// Set defaults for strategy.encoding_packet.esi
	strategy.encoding_packet.esi.external_bits ??= 24n;
	strategy.encoding_packet.esi.remap ??= {};

	// Validate strategy.encoding_packet.esi
	if (false
		|| typeof strategy.encoding_packet.esi.external_bits !== "bigint"
		|| strategy.encoding_packet.esi.external_bits < 2n
		|| strategy.encoding_packet.esi.external_bits > 24n
	) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.external_bits must be bigint between 2n and 24n."));
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
	const esi_wrappers = create_safe_wrappers(strategy.encoding_packet.esi.remap, strategy.encoding_packet.esi.external_bits, 24n);

	// Create the process_oti function using the factory
	const process_oti = create_process_oti(strategy);

	const processed_oti = process_oti(oti);

	// Transform the encoding packets based on strategy before passing to raw decode
	const transformed_encoding_packets = {
		async *[Symbol.asyncIterator]() {
			for await (const packet of encoding_packets) {
				let transformed_packet;

				if (strategy.encoding_packet.sbn.external_bits === 0n) {
					// Extract ESI from packed bits using Uint1Array
					const esi_bits = strategy.encoding_packet.esi.external_bits;
					const esi_bytes_needed = bigint_ceil(esi_bits, 8n);
					const esi_packed_bytes = packet.slice(0, Number(esi_bytes_needed));

					// Create Uint1Array from packed bytes to extract ESI bits
					const combined_array = new Uint1Array(Number(esi_bits));
					combined_array.get_underlying_buffer().set(esi_packed_bytes);

					// Extract ESI array (entire array in this case)
					const esi_array = combined_array.slice(0, Number(esi_bits));
					const external_esi = esi_array.to_bigint();

					// Apply ESI remap to get internal ESI value using safe wrapper
					const internal_esi = esi_wrappers.to_internal_safe(external_esi);

					// Convert internal ESI to 3-byte format using BigInt for safe shifting
					const internal_esi_bytes = new Uint8Array(3);
					internal_esi_bytes[0] = Number((internal_esi >> 16n) & 0xFFn);
					internal_esi_bytes[1] = Number((internal_esi >> 8n) & 0xFFn);
					internal_esi_bytes[2] = Number(internal_esi & 0xFFn);

					// Reconstruct packet: SBN (0) + internal ESI (3 bytes) + symbol data
					const symbol_data = packet.slice(Number(esi_bytes_needed));
					transformed_packet = new Uint8Array(1 + 3 + symbol_data.length);
					transformed_packet[0] = 0; // SBN is 0 since external_bits is 0
					transformed_packet.set(internal_esi_bytes, 1);
					transformed_packet.set(symbol_data, 4);
				} else {
					// Extract SBN+ESI from packed bits using unified Uint1Array
					const total_bits = strategy.encoding_packet.sbn.external_bits + strategy.encoding_packet.esi.external_bits;
					const total_bytes_needed = bigint_ceil(total_bits, 8n);
					const packed_bytes = packet.slice(0, Number(total_bytes_needed));

					// Create unified Uint1Array from packed bytes
					const combined_array = new Uint1Array(Number(total_bits));
					combined_array.get_underlying_buffer().set(packed_bytes);

					// Extract separate SBN and ESI arrays
					const sbn_array = combined_array.slice(0, Number(strategy.encoding_packet.sbn.external_bits));
					const esi_array = combined_array.slice(Number(strategy.encoding_packet.sbn.external_bits), Number(total_bits));

					// Convert to values using BigInt
					const external_sbn = sbn_array.to_bigint();
					const external_esi = esi_array.to_bigint();

					// Apply remap functions to get internal values using safe wrappers
					const internal_sbn = sbn_wrappers.to_internal_safe(external_sbn);
					const internal_esi = esi_wrappers.to_internal_safe(external_esi);

					// Convert internal ESI to 3-byte format
					const internal_esi_bytes = new Uint8Array(3);
					internal_esi_bytes[0] = Number((internal_esi >> 16n) & 0xFFn);
					internal_esi_bytes[1] = Number((internal_esi >> 8n) & 0xFFn);
					internal_esi_bytes[2] = Number(internal_esi & 0xFFn);

					// Reconstruct packet: SBN (1 byte) + internal ESI (3 bytes) + symbol data
					const symbol_data = packet.slice(Number(total_bytes_needed));
					transformed_packet = new Uint8Array(1 + 3 + symbol_data.length);
					transformed_packet[0] = Number(internal_sbn & 0xFFn); // Convert to single byte
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
			external_bits: 40n,
			...strategy.oti.transfer_length
		},
		fec_encoding_id: {
			external_bits: 8n,
			...strategy.oti.fec_encoding_id
		},
		symbol_size: {
			external_bits: 16n,
			...strategy.oti.symbol_size
		},
		num_source_blocks: {
			external_bits: 8n,
			...strategy.oti.num_source_blocks
		},
		num_sub_blocks: {
			external_bits: 16n,
			...strategy.oti.num_sub_blocks
		},
		symbol_alignment: {
			external_bits: 8n,
			...strategy.oti.symbol_alignment
		},
	};

	const total_bits = (0n
		+ oti_config.transfer_length.external_bits
		+ oti_config.fec_encoding_id.external_bits
		+ oti_config.symbol_size.external_bits
		+ oti_config.num_source_blocks.external_bits
		+ oti_config.num_sub_blocks.external_bits
		+ oti_config.symbol_alignment.external_bits
	);

	if (total_bits === 0n) {
		return 0; // No OTI needed
	}

	return Number(bigint_ceil(total_bits, 8n));
};

export const decode__ = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
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

export const decode = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
	strategy ??= {};
	strategy.payload ??= {};

	if (strategy.payload.transfer_length_trim !== undefined) {
		strategy.payload.transfer_length_trim.external_bits ??= 0n;

		if (strategy.payload.transfer_length_trim.external_bits === 0n) {
			return decode__({ raptorq_raw }, { usage, oti, encoding_packets, strategy });
		}

		strategy.payload.transfer_length_trim.pump_transfer_length ??= (effective_transfer_length) => effective_transfer_length;

		const external_bytes = Math.ceil(Number(strategy.payload.transfer_length_trim.external_bits) / 8);

		// Ensure OTI transfer_length strategy is set up to match encoding
		strategy.oti ??= {};
		strategy.oti.transfer_length ??= {};
		strategy.oti.transfer_length.external_bits ??= 40n;
		strategy.oti.transfer_length.remap ??= {};
		strategy.oti.transfer_length.remap.to_internal ??= (external) => external;
		strategy.oti.transfer_length.remap.to_external ??= (internal) => internal;

		const orig_transfer_length_to_internal = strategy.oti.transfer_length.remap.to_internal;
		const orig_transfer_length_to_external = strategy.oti.transfer_length.remap.to_external;

		// Mirror the encoding transform for OTI transfer_length
		strategy.oti.transfer_length.remap.to_internal = (external) => {
			// note we do not involve external_bytes here, as it is easier for programmer to decide calculation on the effective transfer_length, as it is the effective transfer_length that they are likely ceiling based on symbol_size.
			return orig_transfer_length_to_internal(external);
		};

		strategy.oti.transfer_length.remap.to_external = (internal) => {
			return orig_transfer_length_to_external(internal);
		};

		// Extract the RaptorQ internal transfer_length from OTI first for remap context
		let raptorq_transfer_length;
		if (oti !== undefined) {
			// Process OTI to extract transfer_length 
			const process_oti = create_process_oti(strategy);
			const processed_oti = process_oti(oti);

			// Extract transfer_length from the processed 12-byte OTI (first 5 bytes, big-endian)
			const interm_raptorq_transfer_length = (0n
				+ (BigInt(processed_oti[0]) << 32n) +
				(BigInt(processed_oti[1]) << 24n) +
				(BigInt(processed_oti[2]) << 16n) +
				(BigInt(processed_oti[3]) << 8n) +
				BigInt(processed_oti[4])
			);

			// raptorq_transfer_length = strategy.oti.transfer_length.remap.to_internal(interm_raptorq_transfer_length); // wait: to_internal was already called to get this oti
			raptorq_transfer_length = interm_raptorq_transfer_length;

			// console.log("tl", interm_raptorq_transfer_length, "->", raptorq_transfer_length);
		} else {
			// OTI is undefined, must extract from hardcoded strategy values
			if (!strategy.oti.transfer_length?.remap?.to_internal) {
				throw_error(error_user_payload("Cannot determine transfer_length for trim context when OTI is undefined"));
			}
			raptorq_transfer_length = strategy.oti.transfer_length.remap.to_internal(undefined);
		}

		// Decode first and then provide trim metadata
		const raw_result = decode__({ raptorq_raw }, { usage, oti, encoding_packets, strategy });

		// Handle different output formats
		if (usage?.output_format === "blocks") {
			const [transfer_length_trim, transfer_length_trim_res, transfer_length_trim_rej] = create_unsuspended_promise();

			// For blocks output, extract trim length and provide it as metadata
			return {
				blocks: (async function* () {
					let first_block_processed = false;

					for await (const block of raw_result.blocks) {
						if (block.sbn === 0n) {
							if (!first_block_processed) {
								// Extract trim length from the first block's prefix
								if (block.data.length < external_bytes) {
									transfer_length_trim_rej(error_user_payload(`First block too small to contain transfer_length_trim prefix. Expected at least ${external_bytes} bytes, got ${block.data.length}`));
									return;
								}

								const prefix_bytes = block.data.slice(0, external_bytes);
								const prefix_array = new Uint1Array(external_bytes * 8);
								prefix_array.get_underlying_buffer().set(prefix_bytes);
								const stored_length = prefix_array.to_bigint();

								// Apply to_internal remap function if provided
								let final_trim_length = stored_length;
								if (strategy.payload.transfer_length_trim.remap?.to_internal) {
									// Use the actual RaptorQ transfer_length as context
									final_trim_length = strategy.payload.transfer_length_trim.remap.to_internal(stored_length, { transfer_length: raptorq_transfer_length });
								}

								// Resolve the promise with the final trim length
								transfer_length_trim_res(final_trim_length);

								first_block_processed = true;
							}

							// For all blocks with sbn=0, strip the prefix
							yield {
								sbn: block.sbn,
								data: block.data.slice(external_bytes),
							};
						} else {
							// Pass through other blocks unchanged
							yield {
								sbn: block.sbn,
								data: block.data
							};
						}
					}

					if (!first_block_processed) {
						transfer_length_trim_rej(error_user_payload("No blocks received to extract transfer_length_trim from"));
					}
				})(),
				transfer_length_trim,
			};
		} else {
			// For combined output, extract trim length and provide trimmed result
			return (async () => {
				const decoded_data = await raw_result;

				if (decoded_data.length < external_bytes) {
					throw_error(error_user_payload(`Decoded data too small to contain transfer_length_trim prefix. Expected at least ${external_bytes} bytes, got ${decoded_data.length}`));
				}

				// Extract trim length from prefix
				const prefix_bytes = decoded_data.slice(0, external_bytes);
				const prefix_array = new Uint1Array(external_bytes * 8);
				prefix_array.get_underlying_buffer().set(prefix_bytes);
				const stored_length = prefix_array.to_bigint();

				// Apply to_internal remap function if provided
				let final_trim_length = stored_length;
				if (strategy.payload.transfer_length_trim.remap?.to_internal) {
					// Use the actual RaptorQ transfer_length as context
					final_trim_length = strategy.payload.transfer_length_trim.remap.to_internal(stored_length, { transfer_length: raptorq_transfer_length });
				}

				// Strip prefix and trim to specified length
				const data_without_prefix = decoded_data.slice(external_bytes);

				// Validate trim length
				if (final_trim_length > BigInt(data_without_prefix.length)) {
					throw_error(error_user_payload(`transfer_length_trim specifies length ${final_trim_length} but only ${data_without_prefix.length} bytes available after prefix`));
				}

				return data_without_prefix.slice(0, Number(final_trim_length));
			})();
		}
	}

	return decode__({ raptorq_raw }, { usage, oti, encoding_packets, strategy });
};
