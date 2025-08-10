# @davidcal/fec-raptorq

This npm package exposes `RaptorQ` ([RFC 6330](https://datatracker.ietf.org/doc/html/rfc6330)) erasure coding functionality in Node.js, providing a simple interface for Forward Error Correction (FEC).

This protocol allows you to add error correction to input data by converting it into a special array of chunks, called "encoding symbols". These encoding symbols can be delivered independently, and extra encoding symbols are generated for redundancy. Once the decoder receives sufficient encoding symbols to reconstruct the original data, the process stops. In a networking context, for instance, you might decide on a one-to-one mapping between encoding symbols and UDP packets.

While this implementation is severely lacking, it is worth noting that there are currently no alternative packages available for Node.js. As such, I welcome any contributions to this package.

## Supported Targets

✅ Linux x86_64

✅ Linux aarch64

✅ Windows x86_64

❌ Windows aarch64 - Need to add cross-compilation support to `/internal/Dockerfile` and `/internal/build.sh`. Submit PR!

❌ MacOS - Likely impossible due to licensing restrictions. Might add prebuilt binaries in future if feasible.

❌ Web - WASM compilation may be possible in future. Performance would have to be assessed. Submit PR!

## Install

**PNPM:**

```
pnpm i @davidcal/fec-raptorq
```

**NPM:**

```
npm install @davidcal/fec-raptorq
```

**Yarn:**

```
yarn add @davidcal/fec-raptorq
```

## Usage

The `raptorq_raw` export exposes an RFC6330-compliant interface.

I plan on supplementing this with higher-level interfaces in future, so as to enhance the developer experience and offer further useful functionality.

```javascript
import { raptorq_raw } from "@davidcal/fec-raptorq";

// Encode using default options

const data = new Uint8Array(...);

const result = raptorq_raw.encode({ data });

const oti = await result.oti;

for await (const chunk of result.encoding_symbols) {
	console.log(chunk);
}

// Encode using custom options

const options = {
	symbol_size: 1400,    // (T) Size of each symbol in bytes (max: 65535); must be multiple of symbol_alignment
	repair_symbols: 15,   // Number of repair symbols per source block
	source_blocks: 1,     // (Z) Number of source blocks (max: 255)
	sub_blocks: 1,        // (N) Number of sub-blocks per source block (max: 65535)
	symbol_alignment: 8,  // (Al) Symbol alignment in bytes (must be 1 or 8)
};

const result = raptorq_raw.encode({
	options,
	data,
});

// Decode using OTI

const oti = ...;

const encoding_symbols = (async function* () {
  for await (const chunk of some_data_source) {
	yield chunk;
  }
})();

const data = await raptorq_raw.decode({
	oti,
	encoding_symbols,
});
```

## Encoding Options

The `raptorq_raw.encode` function accepts an `options` configuration object with the following RFC6330-compliant options:

It is recommended to configure each parameter to your use-case and not rely on defaults.

- **`symbol_size`**
  - **RFC 6330 (T)** - Size of each symbol in bytes.
  - Default: `1440`.
  - Range: `1` to `65535`.
  - Should match your network's MTU for optimal transmission.
  - Must be a multiple of `symbol_alignment`.

- **`repair_symbols`**
  - Number of repair symbols generated per source block.
  - Default: `15`.
  - Higher values provide more redundancy but increase overhead.
  - This parameter is not part of the OTI as RaptorQ is designed as a fountain code.

- **`source_blocks`**
  - **RFC 6330 (Z)** - Number of source blocks to divide the data into.
  - Default: `1`.
  - Range: `1` to `255`.
  - Use default for small files, increase for very large files to manage memory usage and concurrency.
  - Each source block is processed independently for parallelization. (Todo: source blocks are streamed).

- **`sub_blocks`**
  - **RFC 6330 (N)** - Number of sub-blocks per source block.
  - Default: `1`.
  - Range: `1` to `65535`.

- **`symbol_alignment`**
  - **RFC 6330 (Al)** - Symbol alignment in bytes.
  - Default: `8`.
  - Valid values: `1` or `8`
  - Use `8` for optimal performance on most systems.
  - Use `1` only for special cases where memory is extremely constrained.
  - `symbol_size` must be divisible by this value.
  
Note that the transfer length (**RFC 6330 (F)**) is determined by the length of `data`.

## Decoding Options

There are no manual decoding options, as decoding is configured via the OTI.

You must supply a 12-byte RFC 6330 OTI (Object Transmission Information) when decoding. The OTI must match that obtained from the encoding process.

**Important**: It is not expected for the developer to treat the OTI bytes as part of the encoded bytes, as it is external to the recovery algorithm. Instead, the encoder and decoder must agree on the OTI via an out-of-band mechanism or by using a hardcoded OTI. If an out-of-band mechanism is used for exchanging the OTI, it is the responsibility of the developer to ensure integrity. This process is outside the scope of RFC6330.

The OTI header contains:
- **Transfer Length (F)** - Original data size
- **Symbol Size (T)** - Size of each symbol
- **Number of Source Blocks (Z)** - How data was divided
- **Number of Sub-Blocks (N)** - Sub-block configuration  
- **Symbol Alignment (Al)** - Memory alignment used

The decoder automatically uses these parameters to reconstruct the original data once sufficient encoding symbols are received. According to RFC 6330, you need at least K source symbols plus some overhead symbols to successfully decode, where K is calculated from the transfer length and symbol size.

## Contributing

See `CONTRIBUTING.md`.

## Future Plans

- Improve performance.
- Add block streaming to improve concurrency.
- Add wrapper API that provides FEC Payload ID customization to reduce overhead:
  - Add disable SBN option.
  - Assess possibility to expose custom ESI size option. Are ESIs generated sequentially?
- Add wrapper API that helps with OSI negotation and exposes simpler interface.
- Explore how sub-blocks work and determine if any supplementary functionality would be useful.
- Add Windows ARM support.
- Add Web WASM support.
- Add Mac OS support by uploading pre-built binaries.
- Add better error handling.
- Remove vibe-coding slop.
- Wrap promises with `unsuspended_promise`.
- Finish reading RFC6330 to see if anything else interesting can be added.

## Acknowledgements

This package wraps [a lovely Rust library](https://github.com/cberner/raptorq). Without this library, my package wouldn't exist. See `/internal/README.md` for details.

## License

See `LICENSE` and `/internal/raptorq/LICENSE`.
