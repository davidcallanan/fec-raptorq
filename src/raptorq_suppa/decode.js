import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";

export const decode = ({ raptorq_raw }, { usage, oti, encoding_packets, strategy }) => {
	strategy ??= {};
	strategy.sbn ??= {};
	strategy.sbn.mode ??= "enable";

	// Validate strategy.sbn parameters
	if (false
		|| !["enable", "override", "disable"].includes(strategy.sbn.mode)
	) {
		throw_error(error_user_payload("Provided strategy.sbn.mode must be \"enable\", \"override\", or \"disable\"."));
	}

	if (strategy.sbn.mode === "override") {
		if (false
			|| typeof strategy.sbn.value !== "number"
			|| !Number.isInteger(strategy.sbn.value)
			|| strategy.sbn.value < 0
			|| strategy.sbn.value > 255
		) {
			throw_error(error_user_payload("Provided strategy.sbn.value must be uint8 when mode is \"override\"."));
		}
	}

	// If strategy.sbn.mode is "enable", pass through to raw decode unchanged
	if (strategy.sbn.mode === "enable") {
		return raptorq_raw.decode({ usage, oti, encoding_packets });
	}

	// Transform the encoding packets based on strategy before passing to raw decode
	const transformed_encoding_packets = {
		async *[Symbol.asyncIterator]() {
			for await (const packet of encoding_packets) {
				let transformed_packet;

				if (strategy.sbn.mode === "disable") {
					// Add SBN (0 since num_source_blocks must be 1) as first byte
					transformed_packet = new Uint8Array(packet.length + 1);
					transformed_packet[0] = 0; // SBN is 0 since we only have 1 source block
					transformed_packet.set(packet, 1);
				} else if (strategy.sbn.mode === "override") {
					// Replace first byte with 0 (since num_source_blocks must be 1)
					// The override value is ignored for decoding - we need the actual SBN
					transformed_packet = new Uint8Array(packet.length);
					transformed_packet[0] = 0; // SBN is 0 since we only have 1 source block
					transformed_packet.set(packet.slice(1), 1);
				}

				yield transformed_packet;
			}
		}
	};

	return raptorq_raw.decode({ usage, oti, encoding_packets: transformed_encoding_packets });
};
