import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import Uint1Array from "../Uint1Array.js";
import { exact_strategy } from "./exact_strategy.js";
import { oti_decode as oti_decode_raw } from "../raptorq_raw/oti_decode.js";
import { shallow } from "../uoe/shallow.js";

export const oti_decode = (strategy, oti_bytes) => {
    if (true
        && oti_bytes !== undefined
        && !(oti_bytes instanceof Uint8Array)
    ) {
        throw_error(error_user_payload("Provided input_bytes must be Uint8Array or undefined."));
    }

    strategy = shallow(strategy);

    if (Object.keys(strategy.oti).length === 0) {
        return oti_decode_raw(oti_bytes);
    }

    strategy = exact_strategy(strategy);

    if (oti_bytes === undefined) { // => all values are hardcoded using to_internal
        const transfer_length = strategy.oti.transfer_length?.remap?.to_internal?.(undefined);
        const fec_encoding_id = 6n; // fixed for RaptorQ
        const symbol_size = strategy.oti.symbol_size?.remap?.to_internal?.(undefined);
        const num_source_blocks = strategy.oti.num_source_blocks?.remap?.to_internal?.(undefined);
        const num_sub_blocks = strategy.oti.num_sub_blocks?.remap?.to_internal?.(undefined);
        const symbol_alignment = strategy.oti.symbol_alignment?.remap?.to_internal?.(undefined);

        return {
            transfer_length,
            fec_encoding_id,
            symbol_size,
            num_source_blocks,
            num_sub_blocks,
            symbol_alignment,
        };
    }

    const oti_bits = new Uint1Array((oti_bytes.length * 8));
    oti_bits.set_uint8array(oti_bytes);

    let offset = 0;

    const transfer_length = (() => {
        const num_bits = Number(strategy.oti.transfer_length.external_bits);

        if (num_bits === 0) {
            return strategy.oti.transfer_length.remap.to_internal(undefined);
        }

        const bits = oti_bits.slice(offset, offset + num_bits);
        const external_value = bits.to_bigint();

        offset += num_bits;

        return strategy.oti.transfer_length.remap.to_internal(external_value);
    })();

    const fec_encoding_id = (() => {
        const num_bits = Number(strategy.oti.fec_encoding_id.external_bits);

        if (num_bits === 0) {
            return 6n;
        }

        const bits = oti_bits.slice(offset, offset + Number(num_bits));

        offset += num_bits;

        // no remap for fec_encoding_id

        return bits.to_bigint();
    })();

    const symbol_size = (() => {
        const num_bits = Number(strategy.oti.symbol_size.external_bits);

        if (num_bits === 0) {
            return strategy.oti.symbol_size.remap.to_internal(undefined);
        }

        const bits = oti_bits.slice(offset, offset + num_bits);
        const external_value = bits.to_bigint();

        offset += num_bits;

        return strategy.oti.symbol_size.remap.to_internal(external_value);
    })();

    const num_source_blocks = (() => {
        const num_bits = Number(strategy.oti.num_source_blocks.external_bits);

        if (num_bits === 0) {
            return strategy.oti.num_source_blocks.remap.to_internal(undefined);
        }

        const bits = oti_bits.slice(offset, offset + num_bits);
        const external_value = bits.to_bigint();

        offset += num_bits;

        return strategy.oti.num_source_blocks.remap.to_internal(external_value);
    })();

    const num_sub_blocks = (() => {
        const num_bits = Number(strategy.oti.num_sub_blocks.external_bits);

        if (num_bits === 0) {
            return strategy.oti.num_sub_blocks.remap.to_internal(undefined);
        }

        const bits = oti_bits.slice(offset, offset + num_bits);
        const external_value = bits.to_bigint();

        offset += num_bits;

        return strategy.oti.num_sub_blocks.remap.to_internal(external_value);
    })();

    const symbol_alignment = (() => {
        const num_bits = Number(strategy.oti.symbol_alignment.external_bits);

        if (num_bits === 0) {
            return strategy.oti.symbol_alignment.remap.to_internal(undefined);
        }

        const bits = oti_bits.slice(offset, offset + num_bits);
        const external_value = bits.to_bigint();

        offset += num_bits;

        return strategy.oti.symbol_alignment.remap.to_internal(external_value);
    })();

    return {
        transfer_length,
        fec_encoding_id,
        symbol_size,
        num_source_blocks,
        num_sub_blocks,
        symbol_alignment,
    };
};
