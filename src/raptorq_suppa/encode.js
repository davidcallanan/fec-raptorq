import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";

export const encode = ({ raptorq_raw }, { options, data, strategy }) => {
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

	if (false
		|| strategy.sbn.mode === "override"
		|| strategy.sbn.mode === "disable"
	) {
		// Enforce num_source_blocks must be 1 when SBN is overridden or disabled
		options ??= {};
		if (false
			|| options.num_source_blocks !== undefined
			&& options.num_source_blocks !== 1
		) {
			throw_error(error_user_payload("Provided options.num_source_blocks must be 1 when strategy.sbn.mode is \"override\" or \"disable\"."));
		}
		options.num_source_blocks = 1;
	}

	// Get the raw encoding result
	const raw_result = raptorq_raw.encode({ options, data });

	// If strategy.sbn.mode is "enable", return the raw result unchanged
	if (strategy.sbn.mode === "enable") {
		return raw_result;
	}

	// Transform the encoding packets based on strategy
	const transformed_encoding_packets = (async function* () {
		for await (const packet of raw_result.encoding_packets) {
			let transformed_packet;

			if (strategy.sbn.mode === "disable") {
				// Remove SBN (first byte) from the packet
				transformed_packet = packet.slice(1);
			} else if (strategy.sbn.mode === "override") {
				// Replace SBN (first byte) with the specified value
				transformed_packet = new Uint8Array(packet.length);
				transformed_packet[0] = strategy.sbn.value;
				transformed_packet.set(packet.slice(1), 1);
			}

			yield transformed_packet;
		}
	})();

	return {
		oti: raw_result.oti,
		encoding_packets: transformed_encoding_packets,
	};
};
