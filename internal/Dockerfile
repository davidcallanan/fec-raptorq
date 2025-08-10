# Build stage for RaptorQ CLI binary
FROM rust:1.86-slim

RUN apt-get update

# Install system dependencies for cross-compilation
RUN apt-get install -y \
	build-essential \
	curl \
	pkg-config \
	clang \
	llvm \
	lld \
	# Install GCC cross-compiler for ARM64 to get system libraries
	gcc-aarch64-linux-gnu \
	libc6-dev-arm64-cross \
	# Install MinGW cross-compiler for Windows
	gcc-mingw-w64-x86-64 \
	&& rm -rf /var/lib/apt/lists/*

# Set up the working directory
WORKDIR /app

# Copy the entire internal directory
COPY . .

# Create output directory for volume mounting
RUN mkdir -p /volume/bin

# Set the output directory for the build script
ENV OUTPUT_DIR="/app/bin"

# Run the build script to build all targets
RUN chmod +x build.sh && ./build.sh

# Set the volume for binary output
VOLUME ["/volume/bin"]

CMD ["sh", "-c", "cp -r /app/bin/* /volume/bin/"]
