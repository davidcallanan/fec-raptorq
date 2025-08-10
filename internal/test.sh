#!/bin/bash

# RaptorQ CLI Test Script
# Tests the binary with "Hello, world!" input, encodes it, displays the output, and decodes it back

set -e  # Exit on any error

# Configuration
TEST_INPUT="Hello, world!"
BIN_PATH="./bin/x86_64-unknown-linux-gnu/raptorq"
TEMP_DIR=$(mktemp -d)

# Function to cleanup temp files
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "=== RaptorQ CLI Test ==="
echo "Binary path: $BIN_PATH"
echo "Test input: \"$TEST_INPUT\""
echo "Temp directory: $TEMP_DIR"
echo

# Check if binary exists
if [ ! -f "$BIN_PATH" ]; then
    echo "❌ Error: Binary not found at $BIN_PATH"
    echo "Expected location based on Dockerfile: ./bin/raptorq"
    echo "Please ensure the binary is built and available at this location."
    exit 1
fi

# Check if binary is executable
if [ ! -x "$BIN_PATH" ]; then
    echo "❌ Error: Binary is not executable at $BIN_PATH"
    echo "Please run: chmod +x $BIN_PATH"
    exit 1
fi

# Test files
ORIGINAL_FILE="$TEMP_DIR/original.txt"
ENCODED_FILE="$TEMP_DIR/encoded.bin"
DECODED_FILE="$TEMP_DIR/decoded.txt"

echo "Step 1: Creating test input file..."
echo -n "$TEST_INPUT" > "$ORIGINAL_FILE"
ORIGINAL_SIZE=$(stat -c%s "$ORIGINAL_FILE" 2>/dev/null || stat -f%z "$ORIGINAL_FILE" 2>/dev/null || wc -c < "$ORIGINAL_FILE")
echo "Original file size: $ORIGINAL_SIZE bytes"
echo

echo "Step 2: Encoding with RaptorQ..."
echo "Command: cat \"$ORIGINAL_FILE\" | $BIN_PATH --encode > \"$ENCODED_FILE\""
if cat "$ORIGINAL_FILE" | "$BIN_PATH" --encode > "$ENCODED_FILE" 2>"$TEMP_DIR/encode_stderr.log"; then
    echo "✅ Encoding successful"
    ENCODED_SIZE=$(stat -c%s "$ENCODED_FILE" 2>/dev/null || stat -f%z "$ENCODED_FILE" 2>/dev/null || wc -c < "$ENCODED_FILE")
    echo "Encoded file size: $ENCODED_SIZE bytes"
    
    # Display encoding stderr (contains info messages)
    if [ -s "$TEMP_DIR/encode_stderr.log" ]; then
        echo "Encoding info:"
        cat "$TEMP_DIR/encode_stderr.log" | sed 's/^/  /'
    fi
else
    echo "❌ Encoding failed"
    if [ -s "$TEMP_DIR/encode_stderr.log" ]; then
        echo "Error output:"
        cat "$TEMP_DIR/encode_stderr.log" | sed 's/^/  /'
    fi
    exit 1
fi
echo

echo "Step 3: Displaying encoded data (hexdump)..."
echo "First 256 bytes of encoded data:"
if command -v hexdump >/dev/null 2>&1; then
    hexdump -C "$ENCODED_FILE" | head -16 | sed 's/^/  /'
elif command -v xxd >/dev/null 2>&1; then
    xxd "$ENCODED_FILE" | head -16 | sed 's/^/  /'
else
    # Fallback: show raw bytes as hex using od
    od -t x1 -N 256 "$ENCODED_FILE" | sed 's/^/  /'
fi
echo

echo "Step 4: Decoding back to original..."
echo "Command: cat \"$ENCODED_FILE\" | $BIN_PATH --decode > \"$DECODED_FILE\""
# Note: The new implementation uses OTI, so no need to specify --transfer-length
if cat "$ENCODED_FILE" | "$BIN_PATH" --decode > "$DECODED_FILE" 2>"$TEMP_DIR/decode_stderr.log"; then
    echo "✅ Decoding successful"
    DECODED_SIZE=$(stat -c%s "$DECODED_FILE" 2>/dev/null || stat -f%z "$DECODED_FILE" 2>/dev/null || wc -c < "$DECODED_FILE")
    echo "Decoded file size: $DECODED_SIZE bytes"
    
    # Display decoding stderr (contains info messages)
    if [ -s "$TEMP_DIR/decode_stderr.log" ]; then
        echo "Decoding info:"
        cat "$TEMP_DIR/decode_stderr.log" | sed 's/^/  /'
    fi
else
    echo "❌ Decoding failed"
    if [ -s "$TEMP_DIR/decode_stderr.log" ]; then
        echo "Error output:"
        cat "$TEMP_DIR/decode_stderr.log" | sed 's/^/  /'
    fi
    exit 1
fi
echo

echo "Step 5: Verifying round-trip integrity..."
DECODED_CONTENT=$(cat "$DECODED_FILE")
echo "Original:  \"$TEST_INPUT\""
echo "Decoded:   \"$DECODED_CONTENT\""

if [ "$TEST_INPUT" = "$DECODED_CONTENT" ]; then
    echo "✅ SUCCESS: Round-trip test passed! Input and output match perfectly."
else
    echo "❌ FAILURE: Round-trip test failed! Input and output differ."
    echo
    echo "Detailed comparison:"
    if command -v diff >/dev/null 2>&1; then
        echo "diff output:"
        diff "$ORIGINAL_FILE" "$DECODED_FILE" | sed 's/^/  /' || true
    fi
    
    echo "Byte-by-byte comparison:"
    if command -v cmp >/dev/null 2>&1; then
        cmp -l "$ORIGINAL_FILE" "$DECODED_FILE" | sed 's/^/  /' || true
    fi
    exit 1
fi
echo

echo "Step 6: Performance summary..."
echo "Original size:  $ORIGINAL_SIZE bytes"
echo "Encoded size:   $ENCODED_SIZE bytes"
OVERHEAD=$((ENCODED_SIZE - ORIGINAL_SIZE))
if [ $ORIGINAL_SIZE -gt 0 ]; then
    RATIO=$(echo "scale=2; $ENCODED_SIZE * 100 / $ORIGINAL_SIZE" | bc 2>/dev/null || python3 -c "print(f'{$ENCODED_SIZE * 100 / $ORIGINAL_SIZE:.2f}')" 2>/dev/null || awk "BEGIN {printf \"%.2f\", $ENCODED_SIZE * 100 / $ORIGINAL_SIZE}")
    echo "Overhead:       $OVERHEAD bytes (${RATIO}% of original)"
else
    echo "Overhead:       $OVERHEAD bytes"
fi
echo

echo "🎉 All tests passed successfully!"
echo "The RaptorQ binary is working correctly."
