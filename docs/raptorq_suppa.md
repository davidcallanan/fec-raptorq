# `raptorq_suppa`

This interface is a work-in-progress.

It will offer methods to:

 - Override SBN output.
 - Disable SBN output.
 - Reduce ESI size in output.
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

# Encode

Identical interface to raptorq_raw, except takes in an additional optional `strategy` object.

The contents of `strategy` must be identical between encoding and decoding process, the developer is responsible for pre-agreeing the strategy.

```
strategy.sbn: {
	mode: "enable", // default, matches that of raptorq_raw
	mode: "override", // intercepts the outputted SBNs in each encoding_packet
	mode: "disable", // disabled outputting SBNs in each encoding_packet, thus shaving off 1 byte
	value: 23, // between 0 and 255 , can only be specified if mode is override, this decides what the value should be
	// if override or disable is set, the num_source_blocks must be set to 1, cannot be anything else. 
}
```

# Decode

Can similarly pass strategy.sbn.
