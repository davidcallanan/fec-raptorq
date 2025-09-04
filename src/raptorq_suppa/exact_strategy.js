import { error_user_payload } from "../uoe/error_user_payload.js";
import { shallow } from "../uoe/shallow.js";
import { throw_error } from "../uoe/throw_error.js";

export const exact_strategy = (strategy) => {
	if (true
		&& typeof strategy !== "object"
		&& strategy !== undefined
	) {
		throw_error(error_user_payload("Provided strategy must be object or undefined."));
	}

	strategy = shallow(strategy);

	strategy.oti = shallow(strategy.oti);

	strategy.oti.placement ??= "negotiation";

	strategy.oti.transfer_length = shallow(strategy.oti.transfer_length);
	strategy.oti.transfer_length.external_bits ??= 40n;
	strategy.oti.transfer_length.remap = shallow(strategy.oti.transfer_length.remap);
	strategy.oti.transfer_length.remap.to_internal ??= (external) => external;
	strategy.oti.transfer_length.remap.to_external ??= (internal) => internal;
	strategy.oti.fec_encoding_id = shallow(strategy.oti.fec_encoding_id);
	strategy.oti.fec_encoding_id.external_bits ??= 8n;

	strategy.oti.symbol_size = shallow(strategy.oti.symbol_size);
	strategy.oti.symbol_size.external_bits ??= 16n;
	strategy.oti.symbol_size.remap = shallow(strategy.oti.symbol_size.remap);
	strategy.oti.symbol_size.remap.to_internal ??= (external) => external;
	strategy.oti.symbol_size.remap.to_external ??= (internal) => internal;

	strategy.oti.num_source_blocks = shallow(strategy.oti.num_source_blocks);
	strategy.oti.num_source_blocks.external_bits ??= 8n;
	strategy.oti.num_source_blocks.remap = shallow(strategy.oti.num_source_blocks.remap);
	strategy.oti.num_source_blocks.remap.to_internal ??= (external) => external;
	strategy.oti.num_source_blocks.remap.to_external ??= (internal) => internal;

	strategy.oti.num_sub_blocks = shallow(strategy.oti.num_sub_blocks);
	strategy.oti.num_sub_blocks.external_bits ??= 16n;
	strategy.oti.num_sub_blocks.remap = shallow(strategy.oti.num_sub_blocks.remap);
	strategy.oti.num_sub_blocks.remap.to_internal ??= (external) => external;
	strategy.oti.num_sub_blocks.remap.to_external ??= (internal) => internal;

	strategy.oti.symbol_alignment = shallow(strategy.oti.symbol_alignment);
	strategy.oti.symbol_alignment.external_bits ??= 8n;
	strategy.oti.symbol_alignment.remap = shallow(strategy.oti.symbol_alignment.remap);
	strategy.oti.symbol_alignment.remap.to_internal ??= (external) => external;
	strategy.oti.symbol_alignment.remap.to_external ??= (internal) => internal;

	strategy.encoding_packet = shallow(strategy.encoding_packet);

	strategy.encoding_packet.sbn = shallow(strategy.encoding_packet.sbn);
	strategy.encoding_packet.sbn.external_bits ??= 8n;
	strategy.encoding_packet.sbn.remap = shallow(strategy.encoding_packet.sbn.remap);
	strategy.encoding_packet.sbn.remap.to_internal ??= (external) => external;
	strategy.encoding_packet.sbn.remap.to_external ??= (internal) => internal;

	strategy.encoding_packet.esi = shallow(strategy.encoding_packet.esi);
	strategy.encoding_packet.esi.external_bits ??= 24n;
	strategy.encoding_packet.esi.remap = shallow(strategy.encoding_packet.esi.remap);
	strategy.encoding_packet.esi.remap.to_internal ??= (external) => external;
	strategy.encoding_packet.esi.remap.to_external ??= (internal) => internal;

	strategy.payload = shallow(strategy.payload);
	strategy.payload.transfer_length_trim = shallow(strategy.payload.transfer_length_trim);
	strategy.payload.transfer_length_trim.external_bits ??= 0n;
	strategy.payload.transfer_length_trim.remap = shallow(strategy.payload.transfer_length_trim.remap);
	strategy.payload.transfer_length_trim.pump_transfer_length ??= (effective_transfer_length) => effective_transfer_length;

	if (true
		&& strategy.oti.placement !== "negotiation"
		&& strategy.oti.placement !== "encoding_packet"
	) {
		throw_error(error_user_payload(`Provided strategy.oti.placement (${strategy.oti.placement}) must be "negotiation" or "encoding_packet".`));
	}

	if (typeof strategy.oti.transfer_length.external_bits !== "bigint") {
		throw_error(error_user_payload("Provided strategy.oti.transfer_length.external_bits must be bigint."));
	}

	if (strategy.oti.transfer_length.external_bits < 0n) {
		throw_error(error_user_payload(`Provided strategy.oti.transfer_length.external_bits (${strategy.oti.transfer_length.external_bits}) must be unsigned.`));
	}

	if (strategy.oti.transfer_length.external_bits > 40n) {
		throw_error(error_user_payload(`Provided strategy.oti.transfer_length.external_bits (${strategy.oti.transfer_length.external_bits}) must be at most 40n.`));
	}

	if (typeof strategy.oti.transfer_length.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.oti.transfer_length.remap.to_internal must be function."));
	}

	if (true
		&& strategy.oti.transfer_length.external_bits > 0n
		&& typeof strategy.oti.transfer_length.remap.to_external !== "function"
	) {
		throw_error(error_user_payload("Provided strategy.oti.transfer_length.remap.to_external must be function when provided external_bits is non-zero."));
	}

	if (typeof strategy.oti.fec_encoding_id.external_bits !== "bigint") {
		throw_error(error_user_payload("Provided strategy.oti.fec_encoding_id.external_bits must be bigint."));
	}

	if (true
		&& strategy.oti.fec_encoding_id.external_bits !== 0n
		&& strategy.oti.fec_encoding_id.external_bits !== 8n
	) {
		throw_error(error_user_payload("Provided strategy.oti.fec_encoding_id.external_bits must be either 0n or 8n."));
	}

	if (typeof strategy.oti.symbol_size.external_bits !== "bigint") {
		throw_error(error_user_payload("Provided strategy.oti.symbol_size.external_bits must be bigint."));
	}

	if (strategy.oti.symbol_size.external_bits < 0n) {
		throw_error(error_user_payload("Provided strategy.oti.symbol_size.external_bits must be unsigned."));
	}

	if (strategy.oti.symbol_size.external_bits > 16n) {
		throw_error(error_user_payload("Provided strategy.oti.symbol_size.external_bits must be at most 16n."));
	}

	if (typeof strategy.oti.symbol_size.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.oti.symbol_size.remap.to_internal must be function."));
	}

	if (true
		&& strategy.oti.symbol_size.external_bits > 0n
		&& typeof strategy.oti.symbol_size.remap.to_external !== "function"
	) {
		throw_error(error_user_payload("Provided strategy.oti.symbol_size.remap.to_external must be function when provided external_bits is non-zero."));
	}

	if (typeof strategy.oti.num_source_blocks.external_bits !== "bigint") {
		throw_error(error_user_payload("Provided strategy.oti.num_source_blocks.external_bits must be bigint."));
	}

	if (strategy.oti.num_source_blocks.external_bits < 0n) {
		throw_error(error_user_payload("Provided strategy.oti.num_source_blocks.external_bits must be unsigned."));
	}

	if (strategy.oti.num_source_blocks.external_bits > 8n) {
		throw_error(error_user_payload("Provided strategy.oti.num_source_blocks.external_bits must be at most 8n."));
	}

	if (typeof strategy.oti.num_source_blocks.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.oti.num_source_blocks.remap.to_internal must be function."));
	}

	if (true
		&& strategy.oti.num_source_blocks.external_bits > 0n
		&& typeof strategy.oti.num_source_blocks.remap.to_external !== "function"
	) {
		throw_error(error_user_payload("Provided strategy.oti.num_source_blocks.remap.to_external must be function when provided external_bits is non-zero."));
	}

	if (typeof strategy.oti.num_sub_blocks.external_bits !== "bigint") {
		throw_error(error_user_payload("Provided strategy.oti.num_sub_blocks.external_bits must be bigint."));
	}

	if (strategy.oti.num_sub_blocks.external_bits < 0n) {
		throw_error(error_user_payload("Provided strategy.oti.num_sub_blocks.external_bits must be unsigned."));
	}

	if (strategy.oti.num_sub_blocks.external_bits > 16n) {
		throw_error(error_user_payload("Provided strategy.oti.num_sub_blocks.external_bits must be at most 16n."));
	}

	if (typeof strategy.oti.num_sub_blocks.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.oti.num_sub_blocks.remap.to_internal must be function."));
	}

	if (true
		&& strategy.oti.num_sub_blocks.external_bits > 0n
		&& typeof strategy.oti.num_sub_blocks.remap.to_external !== "function"
	) {
		throw_error(error_user_payload("Provided strategy.oti.num_sub_blocks.remap.to_external must be function when provided external_bits is non-zero."));
	}

	if (typeof strategy.oti.symbol_alignment.external_bits !== "bigint") {
		throw_error(error_user_payload("Provided strategy.oti.symbol_alignment.external_bits must be bigint."));
	}

	if (strategy.oti.symbol_alignment.external_bits < 0n) {
		throw_error(error_user_payload("Provided strategy.oti.symbol_alignment.external_bits must be unsigned."));
	}

	if (strategy.oti.symbol_alignment.external_bits > 8n) {
		throw_error(error_user_payload("Provided strategy.oti.symbol_alignment.external_bits must be at most 8n."));
	}

	if (typeof strategy.oti.symbol_alignment.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.oti.symbol_alignment.remap.to_internal must be function."));
	}

	if (true
		&& strategy.oti.symbol_alignment.external_bits > 0n
		&& typeof strategy.oti.symbol_alignment.remap.to_external !== "function"
	) {
		throw_error(error_user_payload("Provided strategy.oti.symbol_alignment.remap.to_external must be function when provided external_bits is non-zero."));
	}

	if (typeof strategy.encoding_packet.sbn.external_bits !== "bigint") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.external_bits must be bigint."));
	}

	if (strategy.encoding_packet.sbn.external_bits < 0n) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.external_bits must be unsigned."));
	}

	if (strategy.encoding_packet.sbn.external_bits > 8n) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.external_bits must be at most 8n."));
	}

	if (typeof strategy.encoding_packet.sbn.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_internal must be function."));
	}

	if (true
		&& strategy.encoding_packet.sbn.external_bits > 0n
		&& typeof strategy.encoding_packet.sbn.remap.to_external !== "function"
	) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.sbn.remap.to_external must be function when provided external_bits is non-zero."));
	}

	if (typeof strategy.encoding_packet.esi.external_bits !== "bigint") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.external_bits must be bigint."));
	}

	if (strategy.encoding_packet.esi.external_bits < 2n) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.external_bits must be at least 2n."));
	}

	if (strategy.encoding_packet.esi.external_bits > 24n) {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.external_bits must be at most 24n."));
	}

	if (typeof strategy.encoding_packet.esi.remap.to_internal !== "function") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.remap.to_internal must be function."));
	}

	if (typeof strategy.encoding_packet.esi.remap.to_external !== "function") {
		throw_error(error_user_payload("Provided strategy.encoding_packet.esi.remap.to_external must be function."));
	}

	if (typeof strategy.payload.transfer_length_trim.external_bits !== "bigint") {
		throw_error(error_user_payload("Provided strategy.payload.transfer_length_trim.external_bits must be bigint."));
	}

	if (strategy.payload.transfer_length_trim.external_bits < 0n) {
		throw_error(error_user_payload("Provided strategy.payload.transfer_length_trim.external_bits must be unsigned."));
	}

	if (strategy.payload.transfer_length_trim.external_bits > 40n) {
		throw_error(error_user_payload("Provided strategy.payload.transfer_length_trim.external_bits must be at most 40n."));
	}

	if (typeof strategy.payload.transfer_length_trim.pump_transfer_length !== "function") {
		throw_error(error_user_payload("Provided strategy.payload.transfer_length_trim.pump_transfer_length must be function."));
	}

	return strategy;
};
