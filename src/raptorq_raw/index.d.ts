// TypeScript declarations for RaptorQ Raw module

export interface EncodeOptions {
	symbol_size?: number;
	num_repair_symbols?: number;
	num_source_blocks?: number;
	num_sub_blocks?: number;
	symbol_alignment?: number;
}

export interface EncodeInput {
	options?: EncodeOptions;
	data: Uint8Array;
}

export interface EncodingSymbol {
	sbn: number;
	esi: number;
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
	sbn: number;
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
