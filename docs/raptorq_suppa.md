# `raptorq_suppa`

It is recommended that you gain a thorough understanding of the original [`raptorq_raw`](raptorq_raw.md) interface before studying this one.

**This interface is a work-in-progress.**

It will offer methods to:

 - Override SBN output [DONE].
 - Disable SBN output [DONE].
 - Reduce ESI size in output. [DONE]
 - Modify OTI structure:
   - Remove FEC Encoding ID. [DONE]
   - Pre-negotiate certain encoding options and remove relevant data from OTI. [DONE]
 - Enable per-packet OTI: [DONE]
   - Reduces need to use OTI 
   - Does add overhead, but not too significant if symbol size is sufficiently large.
   - Simplifies developer experience at a small cost.
 - Enable inbuilt error detection:
   - Pass ECC function directly, like sha256.
   - Provide trim parameter.
 - Customizable trim length which would differ from the transfer length. This trim length would be dumped at the start of the transfer. This is useful in case you don't want transfer length negotiation. It would result in some wasted space but might make sense to your needs. Trimmed after decoding.

# Encode

```
const { oti, encoding_packets } = raptorq_suppa.encode({ strategy, options, data });
```

Extends the interface of `raptorq_raw.encode`.

Arguments:

 - `strategy`: An optional object that configures the encoding and decoding strategy. The same strategy must be used on both the encoding and decoding end, else undefined behaviour is to be expected. See [Strategy](#strategy) for details.
 - `options`: An optional object equivalent to the [`raptorq_raw` Encoding Options](raptorq_raw.md#encoding-options).
 - `data`: A mandatory `Uint8Array` as described in [`raptorq_raw.encode`](raptorq_raw.md#encode).
 
Return value:
 
 - `oti`: A promise to a `Uint8Array` that holds important configuration information required to initiate the decoding process. May be `undefined` in the rare case that no configuration information needs to be exchanged. Its length (or whether it is `undefined` or not) is fixed for a given `strategy`, but the length will never exceed 12 bytes.
 - `oti_spec`: A promise to the original OTI `Uint8Array` described as `oti` in [`raptorq_raw.encode`](raptorq_raw.md#encode).
 - `encoding_packets`: An async iterator of `Uint8Array` as described in [`raptorq_raw.encode`](raptorq_raw.md#encode).

# Decode


```
const result = raptorq_suppa.decode({ usage, oti, encoding_packets });
```

Extends the interface of `raptorq_raw.decode`.

Arguments:

 - `strategy`: An optional object that configures the encoding and decoding strategy. The same strategy must be used on both the encoding and decoding end, else undefined behaviour is to be expected. See [Strategy](#strategy) for details.
 - `usage`: An optional object as described in [raptorq_raw.decode](raptorq_raw.md#decode).
 - `oti`: A mandatory `Uint8Array` as obtained from [`raptorq_suppa.encode`](#encode).
 - `encoding_packets`: A mandatory async iterator of `Uint8Array` as described in [raptorq_raw.decode](raptorq_raw.md#decode).

Return value:

 - As described in [`raptorq_raw.decode`](raptorq_raw.md#decode), with its form depending on the value of `usage`.

Please do not consider negotiating the strategy object in the form of JSON etc. The sole purpose of the strategy object is to reduce what must otherwise be negotiated via OTI and FEC Payload ID. To then negotiate the strategy would be counterproductive. If you want negotiation, use the OTI and pre-arrange the strategy for the purpose of optimizing the OTI.

Note that the OTI is no longer spec-compliant. You may use `oti_spec` if you need the spec-compliant OTI. Instead, `oti` is configurable for optimization purposes. 

## Strategy

The contents of `strategy` must be identical for both the encoding and decoding process. The developer is responsible for pre-arranging this strategy.

When providing custom `remap.to_internal` and `remap.to_external` functions, the system uses runtime round-trip testing (`to_internal(to_external(value)) === value` and `to_external(to_internal(value)) === value`) to see if the remaps work for any values that are being transformed. However, the system does not test dormant values, so it is the responsibility of the programmer to provide `to_internal` and `to_external` functions that are consistent with one another to prevent unexpected errors from cropping up.

```
strategy.encoding_packet: {
	sbn: {
		external_bits: 7, // (default 8, min 0, max 8) controls how many bits are used in the SBN representation
		remap: {
			to_internal: (_unused) => 0, // must return between 0 and 255 (8-bit max for SBN).
			to_external: (_unused) => 23, // cannot be present if external_bits is 0, must fit within external_bits.
			// it is assumed the developer provides to_internal and to_external as polar opposites that reverse each other. the argument is the internal/external to be converted, but the argument is not used if external_bits is 0.
		}, // default for remap is identity function (unless external_bits is 0, then default for to_external becomes undefined)!
		// note the encoding options num_source_blocks checks if sbn as num_source_blocks - 1 works, but must work for all possible sbns but we dont check that for you.
	},
	esi: {
		external_bits: 23, // can be set to between 2 and 24 (default is 24)
		remap: {
			// identical system to sbn, but must return between 0 and 2^24-1 (24-bit max for ESI)
		}
		// note we calculate based on transfer length and symbol size how many symbols there are gonna be
		// then we validate that this can be successfully converted using to_external
	}
}
```

You can now customize the OTI output to make it more compact. Remapping between how it's stored in the OTI (external) vs what values are used in the encoding/decoding process (internal) facilitate reducing the acceptable values and introducing non-linear jumps if desired. You can access `oti_spec` to get the original OTI, but the decode process will not accept `oti_spec` from you.

```
strategy.oti: {
	transfer_length: {
		external_bits: 40, // can be between 0 and 40,
		remap: {
			to_internal,
			to_external,
		},
		// verifies using to_external that transfer length is allowed in options.
	},
	symbol_size: {
		external_bits: 16, // can be between 0 and 16,
		remap: {
			to_internal,
			to_external,
		},
	},
	fec_encoding_id: {
		external_bits: 0 // can only be 0 or 8 (omitted or present)
		// this is useless if your system does not need interoperability between different fec algorithms, in which case you may set external_bits to 0
		// no remap options allowed here
	},
	// ... all other oti values follow the same external_bits and remap format.
}
```

You can now enable per-packet OTI, this means the OTI is copied into each encoding packet, meaning no need for pre-negotiation of OTI. This is costly in terms of the overhead of OTI duplication, but if OTI is customized to be small in size, then the added overhead can easily become negligible. With some work, you can get the OTI under 8 bytes, and often under 6 or 4 bytes.

```
strategy: {
	oti: {
		placement: "negotation", // (default)
		// when placement === "negotation", oti is returned as normal from encoding process.
		placement: "encoding_packet", // enables per-packet OTI
		// when placement === "encoding_packet", the returned `oti` from encoding will be undefined (and decoding will expect the same), and decoding will now read the oti on a per-packet basis. if decoder encounters two different OTI during processing, it will error.
	},
},
```

You can post-trim the output beyond the `transfer_length` that RaptorQ works with directly. Note that you likely want to specify `strategy.payload.transfer_length_trim.pump_transfer_length` in case you want the actual transfer length to differ from the passed in data, and if you do this, your data will be padded with zeros accordingly. See [Trimming Data](#trimming-data) for details.

```
strategy: {
	payload: {
		transfer_length_trim: {
			external_bits: 8, // defaults to 0, can by anything between 0 and 40
			remap: {
				// remap function is special here, in the form (value, { transfer_length }) so it can use transfer_length as inspiration for calculations
				to_internal,
				to_external,
			},
		},
	},
},
options: {
	transfer_length: // override with what you want	
},
```

## Hardcoding Encoding Options

Hardcoding encoding options is easy, and prevents these values from being present in the OTI, saving space and reducing the burden of negotation.

For example, to hardcode `transfer_length` to `1024`, we would use the following configuration for encoding:

```
{
	strategy: {
		oti: {
			transfer_length: {
				external_bits: 0, // omit from OTI
				remap: {
					to_internal: () => 1024, // ensure the only acceptable value is 1024
					to_external: undefined, // omit from OTI
				},
			},
		},
		// ...
	},
	options: {
		transfer_length: 1024, // use the only acceptable value of 1024
		// ...
	},
	// ...
}
```

You must use the same `strategy` for decoding. If everything in the OTI is hardcoded then you can omit including this in the decoding process. You can detect this if the `oti` returned from encoding is `undefined`.

The configuration is similar for other encoding options.

## Trimming Data

Trimming data separately from the RaptorQ algorithm is especially effective when `strategy.oti.placement === "encoding_block"`. This placement causes the `transfer_length` to be repeated in each encoding block. One might thus want to compress the value of `transfer_length` as follows, but this reduces the precision available for transfer length: (and thus further below we use the trim functionality to resolve this, be patient)

```
strategy.oti: {
	placement: "encoding_block",
	symbol_size: {
		external_bits: 0,
		remap: {
			to_internal: () => 256, // hardcoded symbol_size
			to_external: undefined,	
		},
	},
	transfer_length: {
		external_bits: 32, // 8 bits less than the default 40
		remap: {
			to_internal: (value) => value * 256,
			to_external: (value) => value / 256,
			// due to reduction of 8 bits, we decide to force length to be multiple of 256 to cover the entire range
			// which happens to line up nicely with our symbol_size	
		},
	},
},
```

How do we resolve this? If your data cannot fundamentally handle padding, then you can use `strategy.payload.transfer_length_trim` to trim this length right down to the desired length post-raptorq processing. It's worth noting that because the trim is done after the fact, the RaptorQ algorithm has to process the padded bits (a bit of a waste). So it's best that `pump_transfer_length` rounds up to nearest symbol_size to prevent wasted space that would defeat the intended purpose, as otherwise you could have extra packet(s) going out, and so such a 
technique is followed in the example below:

```
strategy.payload: {
	transfer_length_trim: {
		// external_bits defaults to 0
		external_bits: 8, // we compress this down to 8 bits by making the trim only refer to the lower 8 bits, as `transfer_length` already covers the remaining bits (well, with a value 256 larger)
		remap: {
			to_internal: (external_value, { transfer_length }) => (transfer_length - 256) + external_value,
			to_external: (internal_value, { transfer_length }) => internal_value - (transfer_length - 256)
		},
		// this function decides what internal transfer_length raptorq will use based on effective_transfer_length := the length of the data passed in to this interface + the size transfer_length_trim takes up, must return value >= effective_transfer_length
	pump_transfer_length: (effective_transfer_length) => Math.ceil(effective_transfer_length / 256) * 256, // bring up to nearest 256 multiple	
	},
	// the addition of transfer_length_trim is understood by this interface and will factor in this constant change in the encoding and decoding process, thus will not cause a change to the transfer_length stored in the OTI.
},
```

This results in 8 bits being chopped off from each encoding packet (because symbol size is 256 [8 bits]), and only one occurence of 8 bit `transfer_length_trim` dumped at the beginning of the encoded payload.

Important: If you choose output_format === "blocks" we will not trim the output down to the appropriate length, since blocks are coming in spontaneously and it's hard to reason about this. The `transfer_length` is instead passed to the programmer via `transfer_length_trim` promise in the output, allowing them to trim the output when circumstances allow it. [might modify rust code at a later date to reveal certain information to ease the javascript's ability to do this trimming automatically, if possible].

Note that the `transfer_length` in the OTI is going to be the effective transfer length (data + transfer_length_trim prefix), we do this as the number is easier to work with when compressing via a multiplier and ceiling to nearest symbol_size.
