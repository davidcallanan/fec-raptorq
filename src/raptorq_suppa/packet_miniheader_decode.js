import Uint1Array from "../Uint1Array.js";
import { bigint_ceil } from "../uoe/bigint_ceil.js";

/**
 * Decode mini header (OTI + SBN + ESI, excluding ECC)
 * @param {Object} strategy - The strategy configuration
 * @param {Uint8Array} header_data - The mini header data
 * @returns {{ oti_data: Uint8Array|null, external_sbn: bigint|null, external_esi: bigint, bytes_consumed: number }} Decoded values and bytes consumed
 */
export const packet_miniheader_decode = (strategy, header_data) => {
	let offset = 0;

	// Calculate total bits needed
	let total_bits = 0n;

	// OTI (if per-packet placement)
	let oti_bits = 0n;
	if (strategy.oti.placement === "encoding_packet") {
		// Calculate OTI size from strategy
		const oti_config = {
			transfer_length: { external_bits: 40n, ...strategy.oti.transfer_length },
			fec_encoding_id: { external_bits: 8n, ...strategy.oti.fec_encoding_id },
			symbol_size: { external_bits: 16n, ...strategy.oti.symbol_size },
			num_source_blocks: { external_bits: 8n, ...strategy.oti.num_source_blocks },
			num_sub_blocks: { external_bits: 16n, ...strategy.oti.num_sub_blocks },
			symbol_alignment: { external_bits: 8n, ...strategy.oti.symbol_alignment },
		};

		const oti_total_bits = (0n
			+ oti_config.transfer_length.external_bits
			+ oti_config.fec_encoding_id.external_bits
			+ oti_config.symbol_size.external_bits
			+ oti_config.num_source_blocks.external_bits
			+ oti_config.num_sub_blocks.external_bits
			+ oti_config.symbol_alignment.external_bits
		);

		if (oti_total_bits > 0n) {
			const oti_bytes = Number(bigint_ceil(oti_total_bits, 8n));
			oti_bits = BigInt(oti_bytes * 8);
			total_bits += oti_bits;
		}
	}

	// SBN
	const sbn_bits = strategy.encoding_packet.sbn.external_bits;
	total_bits += sbn_bits;

	// ESI 
	const esi_bits = strategy.encoding_packet.esi.external_bits;
	total_bits += esi_bits;

	const total_bytes_needed = Number(bigint_ceil(total_bits, 8n));

	if (header_data.length < total_bytes_needed) {
		throw new Error(`Mini header too small. Expected ${total_bytes_needed} bytes, got ${header_data.length}`);
	}

	// Create bit array from header data
	const combined_array = new Uint1Array(Number(total_bits));
	combined_array.get_underlying_buffer().set(header_data.slice(0, total_bytes_needed));

	let oti_data = null;
	let external_sbn = null;
	let external_esi;

	// Extract OTI if present
	if (oti_bits > 0n) {
		const oti_bit_array = combined_array.slice(offset, offset + Number(oti_bits));
		oti_data = oti_bit_array.to_uint8_array();
		offset += Number(oti_bits);
	}

	// Extract SBN if present
	if (sbn_bits > 0n) {
		const sbn_array = combined_array.slice(offset, offset + Number(sbn_bits));
		external_sbn = sbn_array.to_bigint();
		offset += Number(sbn_bits);
	}

	// Extract ESI
	const esi_array = combined_array.slice(offset, offset + Number(esi_bits));
	external_esi = esi_array.to_bigint();

	return {
		oti_data,
		external_sbn,
		external_esi,
		bytes_consumed: total_bytes_needed,
	};
};
