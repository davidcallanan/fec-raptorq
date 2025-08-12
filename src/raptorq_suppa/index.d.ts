// TypeScript declarations for RaptorQ Suppa module

export interface EncodeOptions {
	symbol_size?: number;
	num_repair_symbols?: number;
	num_source_blocks?: number;
	num_sub_blocks?: number;
	symbol_alignment?: number;
}

export interface StrategySbn {
	mode?: "enable" | "override" | "disable";
	value?: number; // 0-255, only used when mode is "override"
}

export interface Strategy {
	sbn?: StrategySbn;
}

export interface EncodeInput {
	options?: EncodeOptions;
	data: Uint8Array;
	strategy?: Strategy;
}

export interface EncodeResult {
	oti: Promise<Uint8Array>;
	encoding_packets: AsyncIterable<Uint8Array>;
}

export interface DecodeUsage {
	output_format?: "combined" | "blocks";
}

export interface DecodeInput {
	usage?: DecodeUsage;
	oti: Uint8Array;
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
