# `raptorq_suppa`

It is recommended that you gain a thorough understanding of the original [`raptorq_raw`](raptorq_raw.md) interface before studying this one.

**This interface is a work-in-progress.**

It will offer methods to:

 - Override SBN output [DONE].
 - Disable SBN output [DONE].
 - Reduce ESI size in output. [DONE]
 - Modify OTI structure:
   - Remove FEC Encoding ID.
   - Pre-negotiate certain encoding options and remove relevant data from OTI.
   - Customize max transfer length.
 - Enable per-packet OTI:
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

```
strategy.sbn: {
	// if external_bits is 0, behaves like "mode"="disable" in current implementation
	// essentially always behaves like "mode"="override" in current implementation (but defaults to overriding with same value, i.e. like "mode"="enable")
	external_bits: 7, // can be set to 0 (default is 8 which is also the maximum)
	max_internal_value: 2, // must fit within external_bits, (default is 255)
	remap: {
		to_internal: (_unused) => 0, // must return between 0 and max_internal_value.
		to_external: (_unused) => 23, // cannot be present if max_bits is 0, must fit within max bits.
		// it is assumed the developer provides to_internal and to_external as polar opposites that reverse each other. the argument is the internal/external to be converted, but the argument is not used if external_bits is 0.
	}, // default for remap is identity function (unless external_bits is 0, then default for to_external becomes undefined)!
	// note the encoding options num_source_blocks must now be between 1 and max_internal_value + 1, not 1 and 255
}

strategy.esi: {
	external_bits: 23, // can be set to between 2 and 24 (default is 24)
	max_internal_value: 123123, // must fit within external_bits (default is 2**24)
	remap: {
		// identical system to sbn
	}
	// note we must calculate based on transfer length and symbol size how many symbols there are gonna be
	// then we must check that this fits into max_internal_value
	// TODO: consider removing max_internal_value, it's not that important.
	// actually it's useful to be able to infer this in case the user chooses too high of a symbol count.
	// however we can just test converting this to external and hoping for success, programmer can return undefined if no mapping is available
}
```

This feature is not yet implemented:

Doesn't have to be linear.

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
		mode: "omit", // safe
	},
	num_source_blocks: {
		mode: "present", // or maybe "include",
		mode: "omit",
		hardcoded_value: 1,
		bits: 8, // can be 1 to 8
		// if sbn.
		value_bit_shift: 3, // since we reduce the max bits, this just offers some better range,
		// tbh might disable value_bit_shift as value_remap can easily accomplish
		value_remap: // allows remap some values to give more options
	},
	num_sub_blocks: {
		mode: "present",
		bits: 16,
		// ...	
	},
	symbol_alignment: {
		bits: 8
		// ...
	},
}
```