import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";

export const oti_encode = (oti_object) => {
	// Individual validation

	if (false
		|| typeof oti_object !== "object"
		|| oti_object === null
	) {
		throw_error(error_user_payload("Provided oti_object must be object."));
	}

	const {
		transfer_length,
		fec_encoding_id,
		symbol_size,
		num_source_blocks,
		num_sub_blocks,
		symbol_alignment,
	} = oti_object;

	if (typeof transfer_length !== "bigint") {
		throw_error(error_user_payload("Provided transfer_length must be bigint."));
	}

	if (transfer_length === 0n) {
		throw_error(error_user_payload(`Provided transfer_length (${transfer_length}) must be non-zero.`));
	}

	if (transfer_length < 0n) {
		throw_error(error_user_payload(`Provided transfer_length (${transfer_length}) must be unsigned.`));
	}

	if (transfer_length >= 2n ** 40n) {
		throw_error(error_user_payload(`Provided transfer_length (${transfer_length}) must fit in 40 bits.`));
	}

	if (typeof fec_encoding_id !== "bigint") {
		throw_error(error_user_payload("Provided fec_encoding_id must be bigint."));
	}

	if (fec_encoding_id < 0n) {
		throw_error(error_user_payload(`Provided fec_encoding_id (${fec_encoding_id}) must be unsigned.`));
	}

	if (fec_encoding_id >= 2n ** 8n) {
		throw_error(error_user_payload(`Provided fec_encoding_id (${fec_encoding_id}) must fit in 8 bits.`));
	}

	if (typeof symbol_size !== "bigint") {
		throw_error(error_user_payload("Provided symbol_size must be bigint."));
	}

	if (symbol_size === 0n) {
		throw_error(error_user_payload(`Provided symbol_size (${symbol_size}) must be non-zero.`));
	}

	if (symbol_size < 0n) {
		throw_error(error_user_payload(`Provided symbol_size (${symbol_size}) must be unsigned.`));
	}

	if (symbol_size >= 2n ** 16n) {
		throw_error(error_user_payload(`Provided symbol_size (${symbol_size}) must fit in 16 bits.`));
	}

	if (typeof num_source_blocks !== "bigint") {
		throw_error(error_user_payload("Provided num_source_blocks must be bigint."));
	}

	if (num_source_blocks === 0n) {
		throw_error(error_user_payload(`Provided num_source_blocks (${num_source_blocks}) must be non-zero.`));
	}

	if (num_source_blocks < 0n) {
		throw_error(error_user_payload(`Provided num_source_blocks (${num_source_blocks}) must be unsigned.`));
	}

	if (num_source_blocks >= 2n ** 8n) {
		throw_error(error_user_payload(`Provided num_source_blocks (${num_source_blocks}) must fit in 8 bits.`));
	}

	if (typeof num_sub_blocks !== "bigint") {
		throw_error(error_user_payload("Provided num_sub_blocks must be bigint."));
	}

	if (num_sub_blocks === 0n) {
		throw_error(error_user_payload(`Provided num_sub_blocks (${num_sub_blocks}) must be non-zero.`));
	}

	if (num_sub_blocks < 0n) {
		throw_error(error_user_payload(`Provided num_sub_blocks (${num_sub_blocks}) must be unsigned.`));
	}

	if (num_sub_blocks >= 2n ** 16n) {
		throw_error(error_user_payload(`Provided num_sub_blocks (${num_sub_blocks}) must fit in 16 bits.`));
	}

	if (typeof symbol_alignment !== "bigint") {
		throw_error(error_user_payload("Provided symbol_alignment must be bigint."));
	}

	if (symbol_alignment === 0n) {
		throw_error(error_user_payload(`Provided symbol_alignment (${symbol_alignment}) must be non-zero.`));
	}

	if (symbol_alignment < 0n) {
		throw_error(error_user_payload(`Provided symbol_alignment (${symbol_alignment}) must be unsigned.`));
	}

	if (symbol_alignment >= 2n ** 8n) {
		throw_error(error_user_payload(`Provided symbol_alignment (${symbol_alignment}) must fit in 8 bits.`));
	}

	// Inter-validation

	if (symbol_size % symbol_alignment !== 0n) {
		throw_error(error_user_payload(`symbol_size ${symbol_size} must be divisible by symbol_alignment ${symbol_alignment}.`));
	}

	// Transformation

	const oti_bytes = new Uint8Array(12);

	// Transfer Length (F) - 40 bits
	oti_bytes[0] = Number((transfer_length >> 32n) & 0xFFn);
	oti_bytes[1] = Number((transfer_length >> 24n) & 0xFFn);
	oti_bytes[2] = Number((transfer_length >> 16n) & 0xFFn);
	oti_bytes[3] = Number((transfer_length >> 8n) & 0xFFn);
	oti_bytes[4] = Number((transfer_length >> 0n) & 0xFFn);

	// FEC Encoding ID - 8 bits
	oti_bytes[5] = Number(fec_encoding_id);

	// Symbol Size (T) - 16 bits
	oti_bytes[6] = Number((symbol_size >> 8n) & 0xFFn);
	oti_bytes[7] = Number((symbol_size >> 0n) & 0xFFn);

	// Number of Source Blocks (Z) - 8 bits
	oti_bytes[8] = Number(num_source_blocks);

	// Number of Sub-Blocks (N) - 16 bits
	oti_bytes[9] = Number((num_sub_blocks >> 8n) & 0xFFn);
	oti_bytes[10] = Number((num_sub_blocks >> 0n) & 0xFFn);

	// Symbol Alignment (Al) - 8 bits
	oti_bytes[11] = Number(symbol_alignment);

	return oti_bytes;
};
