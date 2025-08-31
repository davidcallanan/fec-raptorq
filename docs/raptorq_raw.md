# `raptorq_raw`

It is recommended that you spend a few hours studying the [original RFC 6330 document](https://datatracker.ietf.org/doc/html/rfc6330) to bring about a better understanding of how this interface works.

## Encode

```
const { oti, encoding_packets } = raptorq_raw.encode({ options, data });
```

Arguments:

 - `options`: An optional object that configures the encoding process. See [Encoding Options](#encoding-options) for details.
 - `data`: A mandatory `Uint8Array` containing the raw bytes to be encoded. Its length must be non-zero.
 
Return value:

 - `oti`: A promise to a `Uint8Array` containing the 12-byte RFC 6330-compliant "Object Transmission Information", as produced by the encoding process.
 - `encoding_packets`: An async iterator of `Uint8Array` containing each "encoding packet" (SBN + ESI + encoding symbol) as described by RFC 6330.
 
You may work with each of the resulting encoding packets independently. The original data can be reconstructed once a sufficient number of encoding packets are received on the decoding end.

Note that the resulting `oti` is very sensitive to changes in the encoding input. Altering `data.length` or `options` will likely result in a change to the OTI. It would be difficult to hardcode an OTI on the decoding end given this detail, so bear in mind the need for OTI negotation.

### Encoding Options

It is recommended that you configure each parameter to your use-case and not rely on defaults.

- **`symbol_size`**
  - **RFC 6330 (T)** - Size of each symbol in bytes.
  - Default: `1440n`.
  - Range: `1n` to `65535n`.
  - Should match your network's MTU for optimal transmission.
  - Must be a multiple of `symbol_alignment`.
  - Present in the outputted `oti`.

- **`num_repair_symbols`**
  - Number of repair symbols generated per source block.
  - Default: `15n`.
  - Higher values provide more redundancy but increase overhead.
  - Not present in the outputted `oti` since RaptorQ is designed as a fountain code.

- **`num_source_blocks`**
  - **RFC 6330 (Z)** - Number of source blocks to divide the data into.
  - Default: `1n`.
  - Range: `1n` to `255n`.
  - Use default for small files, increase for very large files to manage memory usage.
  - Each source block is processed independently, reducing memory usage (and improving concurrency?).
  - Present in the outputted `oti`.

- **`num_sub_blocks`**
  - **RFC 6330 (N)** - Number of sub-blocks per source block.
  - Default: `1n`.
  - Range: `1n` to `65535n`.
  - Present in the outputted `oti`.

- **`symbol_alignment`**
  - **RFC 6330 (Al)** - Symbol alignment in bytes.
  - Default: `8n`.
  - Range: `1n` to `255n`
  - Common values: `1n`, `4n`, `8n`
  - Use `8n` for optimal performance on most 64-bit systems.
  - Use `4n` for optimal performance on 32-bit systems.
  - `symbol_size` must be divisible by this value.
  - Present in the outputted `oti`.
  
You do not have to explicitly provide the **RFC 6330 (F)** "transfer length", as this is determined by `data.length`.

## Decode

```
const result = raptorq_raw.decode({ usage, oti, encoding_packets });
```

The form of `result` can vary depending on `usage`.

Arguments:

 - `usage`: An optional object that configures the programmatic interface.
   - `output_format`: Either `"combined"` (default) or `"blocks"`. If `"blocks"` is selected, individual blocks are reported as soon as they are decoded (potentially out-of-order), fostering concurrency.
   - Changing `output_format` alters the form of the return value.
 - `oti`: A mandatory `Uint8Array` containing the 12-byte RFC 6330-compliant "Object Transmission Information", as produced by the encoding process. See [OTI Representation](#oti-representation) for details.
 - `encoding_packets`: A mandatory async iterator of `Uint8Array` containing each RFC 6330-compliant "encoding packet", as produced by the encoding process.
 
Return value if `usage.output_format === "combined"`:

 - A promise to a `Uint8Array` containing the raw bytes that were originally encoded.
 
Return value if `usage.output_format === "blocks"`:

 - `blocks`: An async iterator of objects corresponding to the individual RFC 6330 blocks. These blocks may arrive out-of-order as soon as they are available, fostering concurrency.
   - `sbn`: An unsigned 8-bit integer `bigint` corresponding to the "SBN" (Source Block Number) as defined by RFC 6330.
   - `data`: A `Uint8Array` of the portion of the originally encoded data corresponding to this block.

There are no manual decoding options available, as decoding is configured via the OTI. If you'd like a simpler interface that bakes OTI negotation into the encoding packets directly, see the supplementary [`raptorq_suppa`](raptorq_suppa.md) interface.

**Important**: It is not expected for the developer to treat the OTI bytes as part of one of the encoding packets, as the OTI is external to the recovery algorithm. If such a packet were dropped, the decoder would be in trouble. Instead, the encoder and decoder must agree on the OTI via an out-of-band mechanism or by using a hardcoded OTI. If an out-of-band mechanism is used for exchanging the OTI, it is the responsibility of the developer to ensure integrity. This process is outside the scope of RFC 6330.

The decoder automatically uses these parameters to reconstruct the original data once sufficient encoding packets are received. According to RFC 6330, you need at least K encoding packes plus a slight overhead to successfully decode a block, where K is determined by the transfer length and symbol size.
 
**Important:** You must not pass a corrupt `oti` or any corrupt `encoding_packets` to the decoding process. Doing so will likely result in a garbled output that is incorrectly reported as successful (a severe violation). RFC 6330 only handles entire packets being dropped, not internal packet corruption. It is the responsibility of the developer to ensure intra-packet integrity. However, the supplementary [`raptorq_suppa`](raptorq_suppa.md) interface has a togglable error detection mechanism to safely handle packet corruption. Alternatively, you may prefer to implement error detection yourself.

### Example `"blocks"` usage:

```
const result = raptorq_raw.decode({
  usage: {
	output_format: "blocks",
  },
  oti,
  encoding_packets,
});

for await (const block of result.blocks) {
  console.log(block.sbn); // (between 0n and 255n)
  console.log(block.data);
}
```

### OTI Representation

The 12-byte OTI contains (in order):

- `[40 bits]` **Transfer Length (F)** - Original data size.
- `[ 8 bits]` **Reserved** - The fixed "FEC Encoding ID" value of `6` assigned by IANA for RaptorQ. Useless.
- `[16 bits]` **Symbol Size (T)** - Size of each symbol.
- `[ 8 bits]` **Number of Source Blocks (Z)** - How the original data was divided into source blocks.
- `[16 bits]` **Number of Sub-Blocks (N)** - How the source blocks were sub-divided into sub-blocks.
- `[ 8 bits]` **Symbol Alignment (Al)** - Symbol alignment.
