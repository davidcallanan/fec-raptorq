import Uint1Array from "../Uint1Array.js";
import { bigint_ceil } from "../uoe/bigint_ceil.js";
import { packet_miniheader_decode } from "./packet_miniheader_decode.js";
import { calculate_ecc } from "./calculate_ecc.js";

/**
 * Decode and verify full packet header (ECC + OTI + SBN + ESI)
 * @param {Object} strategy - The strategy configuration
 * @param {Uint8Array} packet_data - The full packet data
 * @returns {{ valid: boolean, oti_data: Uint8Array|null, external_sbn: bigint|null, external_esi: bigint, symbol_data: Uint8Array, bytes_consumed: number }} Decoded values or validation failure
 */
export const packet_header_decode = (strategy, packet_data) => {
	let offset = 0;

	// Handle ECC verification if present
	if (strategy.encoding_packet.ecc.external_bits > 0n) {
		// Calculate ECC header size
		const ecc_bits = strategy.encoding_packet.ecc.external_bits;
		const ecc_bytes_needed = Number(bigint_ceil(ecc_bits, 8n));

		if (packet_data.length < ecc_bytes_needed) {
			// Packet too small to contain ECC header
			return { valid: false };
		}

		// Extract ECC header
		const ecc_header = packet_data.slice(0, ecc_bytes_needed);
		const remaining_data = packet_data.slice(ecc_bytes_needed);
		offset += ecc_bytes_needed;

		// Decode mini header to know how much data it contains
		let mini_header_result;
		try {
			mini_header_result = packet_miniheader_decode(strategy, remaining_data);
		} catch (error) {
			// Failed to decode mini header
			return { valid: false };
		}

		const mini_header_bytes = mini_header_result.bytes_consumed;
		const mini_header = remaining_data.slice(0, mini_header_bytes);
		const symbol_data = remaining_data.slice(mini_header_bytes);

		// Calculate expected ECC from mini header + symbol data
		const calculated_ecc = calculate_ecc(strategy, mini_header, symbol_data);

		// Extract stored ECC from header
		const ecc_array = new Uint1Array(Number(ecc_bits));
		ecc_array.get_underlying_buffer().set(ecc_header);
		const stored_ecc = ecc_array.to_bigint();

		// Compare ECCs
		if (stored_ecc !== calculated_ecc) {
			// ECC mismatch
			return { valid: false };
		}

		// ECC is valid, return decoded data
		return {
			valid: true,
			oti_data: mini_header_result.oti_data,
			external_sbn: mini_header_result.external_sbn,
			external_esi: mini_header_result.external_esi,
			symbol_data,
			bytes_consumed: offset + mini_header_bytes,
		};
	} else {
		// No ECC, just decode mini header
		let mini_header_result;
		try {
			mini_header_result = packet_miniheader_decode(strategy, packet_data);
		} catch (error) {
			// Failed to decode mini header
			return { valid: false };
		}

		const mini_header_bytes = mini_header_result.bytes_consumed;
		const symbol_data = packet_data.slice(mini_header_bytes);

		return {
			valid: true,
			oti_data: mini_header_result.oti_data,
			external_sbn: mini_header_result.external_sbn,
			external_esi: mini_header_result.external_esi,
			symbol_data,
			bytes_consumed: mini_header_bytes,
		};
	}
};
