import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";

export const exact_options = (options) => {
	options ??= {};

	const result = {
		symbol_size: options.symbol_size ?? 1400,
		num_repair_symbols: options.num_repair_symbols ?? 15,
		num_source_blocks: options.num_source_blocks ?? 1,
		num_sub_blocks: options.num_sub_blocks ?? 1,
		symbol_alignment: options.symbol_alignment ?? 8,
	};

	if (false
		|| typeof result.symbol_size !== "number"
		|| !Number.isInteger(result.symbol_size)
		|| result.symbol_size <= 0
		|| result.symbol_size > 65535
	) {
		throw_error(error_user_payload("Provided symbol_size must be non-zero uint16."));
	}

	if (false
		|| typeof result.num_repair_symbols !== "number"
		|| !Number.isInteger(result.num_repair_symbols)
		|| result.num_repair_symbols < 0
	) {
		throw_error(error_user_payload("Provided num_repair_symbols must be uint8."));
	}

	if (false
		|| typeof result.num_source_blocks !== "number"
		|| !Number.isInteger(result.num_source_blocks)
		|| result.num_source_blocks < 1
		|| result.num_source_blocks > 255
	) {
		throw_error(error_user_payload("Provided num_source_blocks must be non-zero uint8."));
	}

	if (false
		|| typeof result.num_sub_blocks !== "number"
		|| !Number.isInteger(result.num_sub_blocks)
		|| result.num_sub_blocks < 1
		|| result.num_sub_blocks > 65535
	) {
		throw_error(error_user_payload("Provided num_sub_blocks must be non-zero uint16."));
	}

	if (false
		|| typeof result.symbol_alignment !== "number"
		|| !Number.isInteger(result.symbol_alignment)
		|| result.symbol_alignment < 1
		|| result.symbol_alignment > 255
	) {
		throw_error(error_user_payload("Provided symbol_alignment must be non-zero uint8."));
	}

	return result;
};
