# @davidcal/fec-raptorq

This npm package exposes `RaptorQ` ([RFC 6330](https://datatracker.ietf.org/doc/html/rfc6330)) erasure coding functionality in Node.js, providing a simple interface for Forward Error Correction (FEC).

This protocol allows you to add error correction to input data by converting it into a special array of chunks, called "encoding symbols". These encoding symbols can be delivered independently, and extra encoding symbols are generated for redundancy. Once the decoder receives sufficient encoding symbols to reconstruct the original data, the process stops. In a networking context, for instance, you might decide on a one-to-one mapping between encoding symbols and UDP packets.

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

## Basic Usage

The `raptorq_raw` export exposes an RFC 6330-compliant interface.

```javascript
import { raptorq_raw } from "@davidcal/fec-raptorq";

// Encode using custom options

const options = {
	symbol_size: 1400,        // (T) Size of each symbol in bytes (max: 65535); must be multiple of symbol_alignment
	num_repair_symbols: 15,   // Number of repair symbols per source block
	num_source_blocks: 1,     // (Z) Number of source blocks (max: 255)
	num_sub_blocks: 1,        // (N) Number of sub-blocks per source block (max: 65535)
	symbol_alignment: 8,      // (Al) Symbol alignment in bytes (min: 1, max: 255)
};

const data = new Uint8Array(...);

const result = raptorq_raw.encode({ options, data });

const oti = await result.oti;

for await (const encoding_packet of result.encoding_packets) {
	console.log(encoding_packet);
}

// Decode using OTI

const oti = ...;

const encoding_packets = (async function* () {
  for await (const encoding_packet of some_data_source) {
	  yield encoding_packet;
  }
})();

const data = await raptorq_raw.decode({
	oti,
	encoding_packets,
});
```

See documentation below for detailed encoding and decoding usage.

## Documentation

The raw RaptorQ interface is supplemented with higher-level interfaces that enhance the developer experience and offer further useful functionality.

See the relevant documentation page for the interface you are interested in using:

- [`raptorq_raw`](docs/raptorq_raw.md) - Raw RFC 6330-compliant interface with no additional functionality.
- [`raptorq_suppa`](docs/raptorq_suppa.md) - Wrapper interface that provides better pre-negotiated strategy options, giving the programmer more control and simplifying the decoding process.

## Contributing

See `CONTRIBUTING.md`.

## Future Plans

- Improve performance.
- Add wrapper API that provides FEC Payload ID customization to reduce overhead:
  - Add disable SBN option. This would be useful if the developer has their own notion of SBNs or chunks files manually using hashes, saving 1 byte per FEC Payload ID.
  - Assess possibility to expose custom ESI size option. Are ESIs generated sequentially?
- Add wrapper API that helps with OTI negotation and exposes simpler interface.
- Explore how sub-blocks work and determine if any supplementary functionality would be useful.
- Add Windows ARM support.
- Add Web WASM support.
- Add Mac OS support by uploading pre-built binaries.
- Add better error handling.
- Remove vibe-coding slop.
- Wrap promises with `unsuspended_promise`.
- Finish reading RFC 6330 to see if anything else interesting can be added.
- Right now I am using an in-memory approach, I might look at enabling a file-based approach in future.
- Prevent backlogs using backpressure mechanism.

## Acknowledgements

This package wraps [a lovely Rust library](https://github.com/cberner/raptorq). Without this library, my package wouldn't exist. See `/internal/README.md` for details.

## License

See `/LICENSE` and `/internal/raptorq/LICENSE`.
