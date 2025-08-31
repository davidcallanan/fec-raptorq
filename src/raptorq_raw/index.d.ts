// TypeScript declarations for RaptorQ Raw module

export interface EncodeOptions {
	symbol_size?: bigint;
	num_repair_symbols?: bigint;
	num_source_blocks?: bigint;
	num_sub_blocks?: bigint;
	symbol_alignment?: bigint;
}

export interface EncodeInput {
	options?: EncodeOptions;
	data: Uint8Array;
}

export interface EncodingSymbol {
	sbn: bigint;
	esi: bigint;
	data: Uint8Array;
}

export interface EncodeResult {
	oti: Promise<Uint8Array>;
	encoding_packets: AsyncIterable<EncodingSymbol>;
}

export interface DecodeUsage {
	output_format?: "combined" | "blocks";
}

export interface DecodeInput {
	usage?: DecodeUsage;
	oti: Uint8Array;
	encoding_packets: AsyncIterable<EncodingSymbol>;
}

export interface DecodedBlock {
	sbn: bigint;
	data: Uint8Array;
}

export interface DecodeBlocksResult {
	blocks: AsyncIterable<DecodedBlock>;
}

export type DecodeResult = Promise<Uint8Array> | DecodeBlocksResult;

export interface RaptorqRaw {
	encode(input: EncodeInput): EncodeResult;
	decode(input: DecodeInput): DecodeResult;
}

export declare const raptorq_raw: RaptorqRaw;
