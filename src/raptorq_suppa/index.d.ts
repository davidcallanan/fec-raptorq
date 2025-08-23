// TypeScript declarations for RaptorQ Suppa module

export interface EncodeOptions {
	symbol_size?: number;
	num_repair_symbols?: number;
	num_source_blocks?: number;
	num_sub_blocks?: number;
	symbol_alignment?: number;
}

export interface RemapFunctions {
	to_internal: (external: number) => number;
	to_external?: (internal: number) => number; // undefined when external_bits is 0
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

export interface Strategy {
	encoding_packet?: StrategyEncodingPacket;
	oti?: StrategyOti;
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
	sbn: number;
	data: Uint8Array;
}

export interface DecodeBlocksResult {
	blocks: AsyncIterable<DecodedBlock>;
}

export type DecodeResult = Promise<Uint8Array> | DecodeBlocksResult;

export interface RaptorqSuppa {
	encode(input: EncodeInput): EncodeResult;
	decode(input: DecodeInput): DecodeResult;
}

export declare const raptorq_suppa: RaptorqSuppa;
