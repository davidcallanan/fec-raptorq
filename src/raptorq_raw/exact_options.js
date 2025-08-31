import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";

export const exact_options = (options) => {
	options ??= {};

	const result = {
		symbol_size: options.symbol_size ?? 1400n,
		num_repair_symbols: options.num_repair_symbols ?? 15n,
		num_source_blocks: options.num_source_blocks ?? 1n,
		num_sub_blocks: options.num_sub_blocks ?? 1n,
		symbol_alignment: options.symbol_alignment ?? 8n,
	};

	if (false
		|| typeof result.symbol_size !== "bigint"
		|| result.symbol_size <= 0n
		|| result.symbol_size > 65535n
	) {
		throw_error(error_user_payload("Provided symbol_size must be non-zero uint16."));
	}

	if (false
		|| typeof result.num_repair_symbols !== "bigint"
		|| result.num_repair_symbols < 0n
	) {
		throw_error(error_user_payload("Provided num_repair_symbols must be uint8."));
	}

	if (false
		|| typeof result.num_source_blocks !== "bigint"
		|| result.num_source_blocks < 1n
		|| result.num_source_blocks > 255n
	) {
		throw_error(error_user_payload("Provided num_source_blocks must be non-zero uint8."));
	}

	if (false
		|| typeof result.num_sub_blocks !== "bigint"
		|| result.num_sub_blocks < 1n
		|| result.num_sub_blocks > 65535n
	) {
		throw_error(error_user_payload("Provided num_sub_blocks must be non-zero uint16."));
	}

	if (false
		|| typeof result.symbol_alignment !== "bigint"
		|| result.symbol_alignment < 1n
		|| result.symbol_alignment > 255n
	) {
		throw_error(error_user_payload("Provided symbol_alignment must be non-zero uint8."));
	}

	return result;
};
