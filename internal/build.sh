#!/bin/bash

echo "Welcome to this fantastic build process!"

# Clean up the /volume/bin folder
echo "Cleaning /volume/bin folder..."
rm -rf /volume/bin/*

# Apply appropriate patches without further delay
echo "Applying patches..."
patch -p1 raptorq/src/decoder.rs decoder.rs.patch

echo "Patching complete."

# Set default output directory if not provided
if [ -z "$OUTPUT_DIR" ]; then
    OUTPUT_DIR="./bin"
fi

# Rust targets to build
declare -a RUST_TARGETS=(
    "x86_64-unknown-linux-gnu"
    "aarch64-unknown-linux-gnu"
    "x86_64-pc-windows-gnu"
    # "aarch64-pc-windows-gnu"  # Uncomment to enable Windows ARM64 - experimental!
)

# Function to set up cross-compilation environment for a target
setup_cross_compilation() {
    local target="$1"
    
    if ! command -v clang &> /dev/null; then
        echo "Error: clang not found but required for cross-compilation"
        return 1
    fi
    
    case "$target" in
        "x86_64-unknown-linux-gnu")
            # Native target, use default settings
            echo "Building for native x86_64 Linux target"
            ;;
        "aarch64-unknown-linux-gnu")
            # Use the GCC cross-compiler which has all the right library paths set up
            if command -v aarch64-linux-gnu-gcc &> /dev/null; then
                export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc
                export CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc
                export AR_aarch64_unknown_linux_gnu=aarch64-linux-gnu-ar
                echo "Using GCC cross-compiler for ARM64 Linux (more reliable)"
            else
                echo "Error: aarch64-linux-gnu-gcc not found"
                return 1
            fi
            ;;
        "x86_64-pc-windows-gnu")
            # Use MinGW cross-compiler for Windows which has all the Windows libraries
            if command -v x86_64-w64-mingw32-gcc &> /dev/null; then
                export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc
                export CC_x86_64_pc_windows_gnu=x86_64-w64-mingw32-gcc
                export AR_x86_64_pc_windows_gnu=x86_64-w64-mingw32-ar
                echo "Using MinGW cross-compiler for Windows x86_64 (reliable)"
            else
                echo "Error: x86_64-w64-mingw32-gcc not found"
                return 1
            fi
            ;;
        "aarch64-pc-windows-gnu")
            export CARGO_TARGET_AARCH64_PC_WINDOWS_GNU_LINKER=clang
            export CC_aarch64_pc_windows_gnu=clang
            export AR_aarch64_pc_windows_gnu=llvm-ar
            export CFLAGS_aarch64_pc_windows_gnu="--target=aarch64-pc-windows-gnu -fuse-ld=lld"
            export CXXFLAGS_aarch64_pc_windows_gnu="--target=aarch64-pc-windows-gnu -fuse-ld=lld"
            export CARGO_TARGET_AARCH64_PC_WINDOWS_GNU_RUSTFLAGS="-C linker=clang -C link-arg=--target=aarch64-pc-windows-gnu -C link-arg=-fuse-ld=lld"
            echo "Using clang with lld linker for Windows ARM64 cross-compilation (experimental)"
            ;;
        *)
            echo "Warning: Unknown target $target, using default settings"
            ;;
    esac
}

get_exe_name() {
    local target="$1"
    local base_name="$2"
    if [[ "$target" == *"windows"* ]]; then
        echo "${base_name}.exe"
    else
        echo "${base_name}"
    fi
}

echo "Starting Rust cross-compilation..."

for rust_target in "${RUST_TARGETS[@]}"; do
    TARGET_DIR="${OUTPUT_DIR}/${rust_target}"
    mkdir -p "$TARGET_DIR"
    
    EXE_NAME=$(get_exe_name "$rust_target" "raptorq")
    OUTPUT_PATH="${TARGET_DIR}/${EXE_NAME}"

    echo "Building ${rust_target} to ${OUTPUT_PATH}..."

    # Set up cross-compilation environment
    setup_cross_compilation "$rust_target"

    # Install the target if it's not already installed
    rustup target add "$rust_target"
    
    # Build for the specific target
    cargo build --release --target "$rust_target"
    
    if [ $? -ne 0 ]; then
        echo "Error: Rust build failed for ${rust_target}"
        exit 1
    fi
    
    # Copy the binary to the output directory
    cp "target/${rust_target}/release/${EXE_NAME}" "$OUTPUT_PATH"
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to copy binary for ${rust_target}"
        exit 1
    fi

    if [[ "$rust_target" != *"windows"* ]]; then
        chmod +x "$OUTPUT_PATH"
    fi
    
    echo "Successfully built ${rust_target}"
done

echo "All required Rust binaries built successfully!"
