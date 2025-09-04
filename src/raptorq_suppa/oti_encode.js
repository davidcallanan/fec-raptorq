import { throw_error } from "../uoe/throw_error.js";
import { error_user_payload } from "../uoe/error_user_payload.js";
import { oti_decode } from "../raptorq_raw/oti_decode.js";
import Uint1Array from "../Uint1Array.js";
import { exact_strategy } from "./exact_strategy.js";
import { oti_encode as oti_encode_raw } from "../raptorq_raw/oti_encode.js";
import { shallow } from "../uoe/shallow.js";

const bits_max_value = (bits) => {
    bits = BigInt(bits);

    if (bits === 0n) {
        return undefined;
    };

    return (1n << bits) - 1n;
};

export const oti_encode = (strategy, oti_object) => {
    if (true
        && typeof oti_object !== "object"
        && oti_object !== undefined
    ) {
        throw_error(error_user_payload("Provided oti_object must be object or undefined."));
    }

    oti_object = shallow(oti_object);

    strategy = shallow(strategy);

    if (Object.keys(strategy.oti).length === 0) {
        return oti_encode_raw(oti_object);
    }

    strategy = exact_strategy(strategy);

    const {
        transfer_length,
        fec_encoding_id,
        symbol_size,
        num_source_blocks,
        num_sub_blocks,
        symbol_alignment,
    } = oti_object;

    const to_process = [];

    (() => {
        const num_bits = Number(strategy.oti.transfer_length.external_bits);

        if (num_bits === 0) {
            return;
        }

        const external_value = strategy.oti.transfer_length.remap.to_external(transfer_length);

        const max_value = bits_max_value(num_bits);

        if (typeof external_value !== "bigint") {
            throw_error(error_user_payload(`Provided strategy.oti.transfer_length.remap.to_external must return bigint.`));
        }

        if (external_value < 0n) {
            throw_error(error_user_payload(`Provided strategy.oti.transfer_length.remap.to_external return value (${external_value}) must be unsigned.`));
        }

        if (external_value > max_value) {
            throw_error(error_user_payload(`Provided strategy.oti.transfer_length.remap.to_external return value (${external_value}) must fit in ${num_bits} bits.`));
        }

        to_process.push({
            num_bits,
            external_value,
        });
    })();

    (() => {
        const num_bits = Number(strategy.oti.fec_encoding_id.external_bits);

        if (num_bits === 0) {
            return;
        }

        const external_value = fec_encoding_id; // no remap for fec_encoding_id

        to_process.push({
            num_bits,
            external_value,
        });
    })();

    (() => {
        const num_bits = Number(strategy.oti.symbol_size.external_bits);

        if (num_bits === 0) {
            return;
        }

        const external_value = strategy.oti.symbol_size.remap.to_external(symbol_size);

        const max_value = bits_max_value(num_bits);

        if (typeof external_value !== "bigint") {
            throw_error(error_user_payload(`Provided strategy.oti.symbol_size.remap.to_external must return bigint.`));
        }

        if (external_value < 0n) {
            throw_error(error_user_payload(`Provided strategy.oti.symbol_size.remap.to_external return value (${external_value}) must be unsigned.`));
        }

        if (external_value > max_value) {
            throw_error(error_user_payload(`Provided strategy.oti.symbol_size.remap.to_external return value (${external_value}) must fit in ${num_bits} bits.`));
        }

        to_process.push({
            num_bits,
            external_value,
        });
    })();

    (() => {
        const num_bits = Number(strategy.oti.num_source_blocks.external_bits);

        if (num_bits === 0) {
            return;
        }

        const external_value = strategy.oti.num_source_blocks.remap.to_external(num_source_blocks);

        const max_value = bits_max_value(num_bits);

        if (typeof external_value !== "bigint") {
            throw_error(error_user_payload(`Provided strategy.oti.num_source_blocks.remap.to_external must return bigint.`));
        }

        if (external_value < 0n) {
            throw_error(error_user_payload(`Provided strategy.oti.num_source_blocks.remap.to_external return value (${external_value}) must be unsigned.`));
        }

        if (external_value > max_value) {
            throw_error(error_user_payload(`Provided strategy.oti.num_source_blocks.remap.to_external return value (${external_value}) must fit in ${num_bits} bits.`));
        }

        to_process.push({
            num_bits,
            external_value,
        });
    })();

    (() => {
        const num_bits = Number(strategy.oti.num_sub_blocks.external_bits);

        if (num_bits === 0) {
            return;
        }

        const external_value = strategy.oti.num_sub_blocks.remap.to_external(num_sub_blocks);

        const max_value = bits_max_value(num_bits);

        if (typeof external_value !== "bigint") {
            throw_error(error_user_payload(`Provided strategy.oti.num_sub_blocks.remap.to_external must return bigint.`));
        }

        if (external_value < 0n) {
            throw_error(error_user_payload(`Provided strategy.oti.num_sub_blocks.remap.to_external return value (${external_value}) must be unsigned.`));
        }

        if (external_value > max_value) {
            throw_error(error_user_payload(`Provided strategy.oti.num_sub_blocks.remap.to_external return value (${external_value}) must fit in ${num_bits} bits.`));
        }

        to_process.push({
            num_bits,
            external_value,
        });
    })();

    (() => {
        const num_bits = Number(strategy.oti.symbol_alignment.external_bits);

        if (num_bits === 0) {
            return;
        }

        const external_value = strategy.oti.symbol_alignment.remap.to_external(symbol_alignment);

        const max_value = bits_max_value(num_bits);

        if (typeof external_value !== "bigint") {
            throw_error(error_user_payload(`Provided strategy.oti.symbol_alignment.remap.to_external must return bigint.`));
        }

        if (external_value < 0n) {
            throw_error(error_user_payload(`Provided strategy.oti.symbol_alignment.remap.to_external return value (${external_value}) must be unsigned.`));
        }

        if (external_value > max_value) {
            throw_error(error_user_payload(`Provided strategy.oti.symbol_alignment.remap.to_external return value (${external_value}) must fit in ${num_bits} bits.`));
        }

        to_process.push({
            num_bits,
            external_value,
        });
    })();

    const num_total_bits = to_process.reduce((sum, field) => sum + field.num_bits, 0);

    if (num_total_bits === 0) {
        return undefined;
    }

    const oti_bits = new Uint1Array(num_total_bits);

    let offset = 0;

    for (const entry of to_process) {
        const bits = new Uint1Array(entry.external_value, entry.num_bits);
        oti_bits.set(bits, offset);
        offset += entry.num_bits;
    }

    console.log("TOTAL BITS", num_total_bits);
    console.log("PROCESS", to_process);
    console.log("MADE RESULT", oti_bits.to_uint8_array());

    return oti_bits.to_uint8_array();
};
