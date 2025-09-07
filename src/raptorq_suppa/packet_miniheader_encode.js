import Uint1Array from "../Uint1Array.js";

export const packet_miniheader_encode = (strategy, oti_data, external_sbn, external_esi) => {
	let offset = 0;

	// Calculate total bits needed
	let total_bits = 0n;

	// OTI (if per-packet placement)
	let oti_bits = 0n;
	if (strategy.oti.placement === "encoding_packet" && oti_data) {
		oti_bits = BigInt(oti_data.length * 8);
		total_bits += oti_bits;
	}

	// SBN
	const sbn_bits = strategy.encoding_packet.sbn.external_bits;
	total_bits += sbn_bits;

	// ESI 
	const esi_bits = strategy.encoding_packet.esi.external_bits;
	total_bits += esi_bits;

	if (total_bits === 0n) {
		return new Uint8Array(0);
	}

	// Create one header array
	const header_array = new Uint1Array(Number(total_bits));

	// Set OTI if present
	if (oti_bits > 0n) {
		const oti_bit_array = new Uint1Array(Number(oti_bits));
		oti_bit_array.get_underlying_buffer().set(oti_data);
		header_array.set(oti_bit_array, offset);
		offset += Number(oti_bits);
	}

	// Set SBN if present
	if (sbn_bits > 0n) {
		const sbn_array = new Uint1Array(external_sbn, Number(sbn_bits));
		header_array.set(sbn_array, offset);
		offset += Number(sbn_bits);
	}

	// Set ESI
	const esi_array = new Uint1Array(external_esi, Number(esi_bits));
	header_array.set(esi_array, offset);

	return header_array.to_uint8_array();
};
