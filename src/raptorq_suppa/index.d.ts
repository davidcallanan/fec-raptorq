// TypeScript declarations for RaptorQ Suppa module

export interface EncodeOptions {
	symbol_size?: bigint;
	num_repair_symbols?: bigint;
	num_source_blocks?: bigint;
	num_sub_blocks?: bigint;
	symbol_alignment?: bigint;
}

export interface RemapFunctions {
	to_internal: (external: bigint) => bigint;
	to_external?: (internal: bigint) => bigint; // undefined when external_bits is 0
}

export interface StrategySbn {
	external_bits?: number; // 0-8, default 8
	remap?: RemapFunctions;
}

export interface StrategyEsi {
	external_bits?: number; // 2-24, default 24  
	remap?: RemapFunctions;
}

export interface StrategyEncodingPacket {
	sbn?: StrategySbn;
	esi?: StrategyEsi;
}

export interface OtiFieldStrategy {
	external_bits?: number; // 0 means omit from OTI (hardcoded)
	remap?: RemapFunctions;
}

export interface StrategyOti {
	placement?: "negotation" | "encoding_packet"; // default "negotation"
	transfer_length?: OtiFieldStrategy; // 0-40 bits, default 40
	fec_encoding_id?: {
		external_bits?: 0 | 8; // Can only be 0 (omitted) or 8 (present), default 8
	};
	symbol_size?: OtiFieldStrategy; // 0-16 bits, default 16
	num_source_blocks?: OtiFieldStrategy; // 0-8 bits, default 8
	num_sub_blocks?: OtiFieldStrategy; // 0-16 bits, default 16
	symbol_alignment?: OtiFieldStrategy; // 0-8 bits, default 8
}

export interface TransferLengthTrimRemapFunctions {
	to_internal: (external_value: bigint, context: { transfer_length: bigint }) => bigint;
	to_external: (internal_value: bigint, context: { transfer_length: bigint }) => bigint;
}

export interface StrategyTransferLengthTrim {
	external_bits?: number; // 0-40, default 0
	remap?: TransferLengthTrimRemapFunctions;
	pump_transfer_length?: (effective_transfer_length: bigint) => bigint;
}

export interface StrategyPayload {
	transfer_length_trim?: StrategyTransferLengthTrim;
}

export interface Strategy {
	encoding_packet?: StrategyEncodingPacket;
	oti?: StrategyOti;
	payload?: StrategyPayload;
}

export interface EncodeInput {
	options?: EncodeOptions;
	data: Uint8Array;
	strategy?: Strategy;
}

export interface EncodeResult {
	oti: Promise<Uint8Array | undefined>; // undefined when placement is "encoding_packet"
	oti_spec: Promise<Uint8Array>;
	encoding_packets: AsyncIterable<Uint8Array>;
}

export interface DecodeUsage {
	output_format?: "combined" | "blocks";
}

export interface DecodeInput {
	usage?: DecodeUsage;
	oti: Uint8Array | undefined; // undefined when placement is "encoding_packet"
	encoding_packets: AsyncIterable<Uint8Array>;
	strategy?: Strategy;
}

export interface DecodedBlock {
	sbn: bigint;
	data: Uint8Array;
}

export interface DecodeBlocksResult {
	blocks: AsyncIterable<DecodedBlock>;
	transfer_length_trim?: Promise<bigint>; // Present when strategy.payload.transfer_length_trim is used
}

export type DecodeResult = Promise<Uint8Array> | DecodeBlocksResult;

export interface RaptorqSuppa {
	encode(input: EncodeInput): EncodeResult;
	decode(input: DecodeInput): DecodeResult;
}

export declare const raptorq_suppa: RaptorqSuppa;
