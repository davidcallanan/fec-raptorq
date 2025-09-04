import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";

export const oti_decode = (oti_bytes) => {
	// Individual validation

	if (!(oti_bytes instanceof Uint8Array)) {
		throw_error(error_user_payload("Provided oti_bytes must be Uint8Array."));
	}

	if (oti_bytes.length !== 12) {
		throw_error(error_user_payload("Provided oti_bytes must be exactly 12 bytes."));
	}

	// Transformation

	// Transfer Length (F) - 40 bits
	const transfer_length = (0n
		+ (BigInt(oti_bytes[0]) << 32n)
		+ (BigInt(oti_bytes[1]) << 24n)
		+ (BigInt(oti_bytes[2]) << 16n)
		+ (BigInt(oti_bytes[3]) << 8n)
		+ (BigInt(oti_bytes[4]) << 0n)
	);

	// FEC Encoding ID - 8 bits, fixed for given FEC algorithm
	const fec_encoding_id = BigInt(oti_bytes[5]);

	// Symbol Size (T) - 16 bits
	const symbol_size = (0n
		+ (BigInt(oti_bytes[6]) << 8n)
		+ (BigInt(oti_bytes[7]) << 0n)
	);

	// Number of Source Blocks (Z) - 8 bits
	const num_source_blocks = BigInt(oti_bytes[8]);

	// Number of Sub-Blocks (N) - 16 bits
	const num_sub_blocks = (0n
		+ (BigInt(oti_bytes[9]) << 8n)
		+ (BigInt(oti_bytes[10]) << 0n)
	);

	// Symbol Alignment (Al) - 8 bits
	const symbol_alignment = BigInt(oti_bytes[11]);

	// Individual validation

	if (transfer_length === 0n) {
		throw_error(error_user_payload(`Obtained transfer_length (${transfer_length}) must be non-zero.`));
	}

	if (symbol_size === 0n) {
		throw_error(error_user_payload(`Obtained symbol_size (${symbol_size}) must be non-zero.`));
	}

	if (num_source_blocks === 0n) {
		throw_error(error_user_payload(`Obtained num_source_blocks (${num_source_blocks}) must be non-zero.`));
	}

	if (num_sub_blocks === 0n) {
		throw_error(error_user_payload(`Obtained num_sub_blocks (${num_sub_blocks}) must be non-zero.`));
	}

	if (symbol_alignment === 0n) {
		throw_error(error_user_payload(`Obtained symbol_alignment (${symbol_alignment}) must be non-zero.`));
	}

	// Inter-validation

	if (symbol_size % symbol_alignment !== 0n) {
		throw_error(error_user_payload(`Obtained symbol_size (${symbol_size}) must be divisible by symbol_alignment (${symbol_alignment}).`));
	}

	// Transformation

	return {
		transfer_length,
		fec_encoding_id,
		symbol_size,
		num_source_blocks,
		num_sub_blocks,
		symbol_alignment,
	};
};
