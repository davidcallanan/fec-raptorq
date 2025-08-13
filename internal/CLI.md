# RaptorQ CLI Tool

An RFC 6330-compliant command-line interface for RaptorQ forward error correction encoding and decoding.

## Usage

This implementation uses RFC 6330 Object Transmission Information (OTI). The encoder embeds all parameters in a 12-byte header which is dumped at the beginning of its output, and the decoder reads these parameters via the same 12-byte header.

**Important**: It is not expected for the header to be treated as part of the encoded bytes, as it is external to the recovery algorithm. Instead, the encoder and decoder must agree on the OTI via an out-of-band mechanism or by using a hardcoded OTI. If an out-of-band mechanism is used for exchanging the OTI, it is the responsibility of the developer to ensure integrity. This process is outside the scope of RFC 6330.

### Encoding

Use the `--encode` flag for encoding.

Takes via `stdin` the raw bytes to be encoded.

Outputs via `stdout` the 12-byte OTI header concatenated with the concatenation of each encoding symbol.

Your application can parse the output by first reading the 12-byte OTI header and then reading each encoding symbol of length `encoding_symbol_size := (sbn_size := 1) + (esi_size := 3) + --symbol-size`.

Your application can generate an object along the lines of:

```
{
  "oti": [12]byte;
  "encoding_packets": [num_encoding_symbols][symbol_size]byte;
}
```

Basic usage (using defaults):

```bash
cat input.bin | ./raptorq --encode > output.bin
```

Custom usage:

```
# Encoding with custom repair symbols for more redundancy
cat input.bin | ./raptorq --encode --repair-symbols 20 > encoded.bin

# Advanced encoding with custom parameters
cat input.bin | ./raptorq --encode \
    --symbol-size 1024 \
    --repair-symbols 15 \
    --source-blocks 2 \
    --sub-blocks 2 > encoded.bin
```

### Decoding

Decoding is automatic - all parameters are read from the OTI header.

**The decoder always outputs blocks individually, each prefixed with its Source Block Number (SBN) and block size for precise parsing.**

```bash
# Decoding - outputs blocks with SBN prefix and size
cat encoded.bin | ./raptorq --decode > decoded_blocks.bin

# Each output block format: [SBN: 1 byte][Block Size: 4 bytes, little-endian][Block Data: variable length]
```

### Round-trip Example

```bash
# Simple round-trip - no parameters needed for decoding
cat input.bin | ./raptorq --encode | ./raptorq --decode > output.bin
diff input.bin output.bin  # Should show no differences

# Round-trip with custom encoding parameters
cat input.bin | ./raptorq --encode \
    --symbol-size 1024 \
    --repair-symbols 10 \
    --source-blocks 1 \
    --sub-blocks 1 | \
./raptorq --decode > output.bin
diff input.bin output.bin  # Should show no differences
```

## Command Line Options

**Mode Selection (Required):**
- `--encode`: Encode data from stdin
- `--decode`: Decode data from stdin (always outputs SBN-prefixed blocks with size headers for precise parsing)

**Encoding Parameters** (only used during encoding, ignored during decoding):
- `--symbol-size <BYTES>`: RFC6330 Symbol Size **T** - Size of each symbol in bytes (default: 1400, max: 65535)
- `--repair-symbols <COUNT>`: Number of repair symbols per source block (default: 15) - encoding-only, not stored in OTI
- `--source-blocks <COUNT>`: RFC6330 Number of Source Blocks **Z** (default: 1, max: 255)  
- `--sub-blocks <COUNT>`: RFC6330 Number of Sub-Blocks **N** per source block (default: 1, max: 65535)
- `--symbol-alignment <BYTES>`: RFC6330 Symbol Alignment **Al** in bytes (default: 8, options: 1 or 8)

*Note: RFC 6330 Transfer Length **F** is automatically determined from input data size during encoding and stored in the OTI.*

**Other Options:**
- `--help`: Show help information
- `--version`: Show version information

## Parameter Selection Guidelines

- **Symbol Size (T)**: Should match your network's MTU for optimal transmission (default 1400 bytes works for most networks)
- **Source Blocks (Z)**: Use default (1) for small files, increase for very large files to manage memory usage
- **Sub Blocks (N)**: Use default (1) for small files, increase to optimize memory usage for large files  
- **Symbol Alignment (Al)**: Use 8 for optimal performance on most systems, 1 for special cases
- **Repair Symbols**: More repair symbols = more redundancy but larger output (typical range: 5-30)

The **Transfer Length (F)** is automatically determined from input data during encoding and embedded in the OTI.

## Notes

- Most parameters have sensible defaults that work well for typical use cases
- The decoder automatically reads all parameters from the OTI header - no manual specification required
- Symbol size should be divisible by symbol alignment for optimal performance
- This tool uses RFC 6330 Object Transmission Information (OTI) embedding for full standards compliance
