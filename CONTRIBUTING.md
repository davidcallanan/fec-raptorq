# Contributing to @davidcal/fec-raptorq

Note: This file is AI-generated, **do not rely on it**.

Also, `/internal/main.rs`, `src/index.js` and `src/index.test.js` are entirely agentically generated (albeit with lots, and I mean lots, of steering).

As a contributor, do please check out `/internal/README.md` which is partially human-written.

The root `README.md` file is 90% human-written.

---

Thank you for your interest in contributing to this RaptorQ forward error correction library! This project provides Node.js bindings for the RaptorQ (RFC 6330) erasure coding protocol, and we welcome contributions of all kinds.

## Table of Contents

- [Project Overview](#project-overview)
- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Building the Project](#building-the-project)
- [Testing](#testing)
- [Contributing Guidelines](#contributing-guidelines)
- [Code Style and Standards](#code-style-and-standards)
- [Submitting Changes](#submitting-changes)
- [Issue Guidelines](#issue-guidelines)
- [Platform Support](#platform-support)
- [Performance Considerations](#performance-considerations)
- [Documentation](#documentation)
- [Community and Support](#community-and-support)
- [License](#license)

## Project Overview

This project exposes RaptorQ ([RFC 6330](https://datatracker.ietf.org/doc/html/rfc6330)) erasure coding functionality in Node.js through a native binary wrapper. The implementation provides Forward Error Correction (FEC) capabilities, allowing you to add redundancy to data for recovery from transmission errors or packet loss.

### Key Components

- **Node.js API** (`src/`): JavaScript interface and binary wrapper
- **Native Binary** (`internal/`): Cross-compiled Rust implementation
- **CLI Tool**: Command-line interface for encoding/decoding operations
- **Build System**: Docker-based cross-compilation setup

## Getting Started

### Prerequisites

- **Node.js** >= 12.0.0
- **Docker** (for building native binaries)
- **Git**
- **Text Editor** (VS Code recommended)

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd fec-raptorq
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   # or
   yarn install
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

## Development Environment Setup

### For JavaScript Development

If you're only working on the JavaScript API layer:

1. Ensure you have Node.js >= 12.0.0 installed
2. Install dependencies with your preferred package manager
3. The pre-built binaries should work for supported platforms

### For Native Binary Development

If you need to modify or build the native Rust components:

1. **Install Rust** (if working locally):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Docker Setup** (recommended for cross-compilation):
   ```bash
   # Build the Docker image
   cd internal
   docker build -t fec-raptorq-builder .
   ```

3. **Cross-compilation targets**:
   - Linux x86_64
   - Linux aarch64  
   - Windows x86_64
   - Windows aarch64 (experimental - needs PR!)

## Project Structure

```
├── src/                          # Node.js API implementation
│   ├── index.js                 # Main entry point and binary wrapper
│   ├── index.test.js            # Test suite
│   └── uoe/                     # Utility library dependencies
├── internal/                    # Native implementation
│   ├── build.sh                # Cross-compilation build script
│   ├── Dockerfile              # Build environment
│   ├── CLI.md                  # CLI documentation
│   ├── bin/                    # Compiled binaries
│   │   ├── x86_64-unknown-linux-gnu/
│   │   ├── aarch64-unknown-linux-gnu/
│   │   └── x86_64-pc-windows-gnu/
│   ├── raptorq/                # Rust RaptorQ library (submodule/vendored)
│   └── src/                    # CLI wrapper source
├── package.json                # Node.js package configuration
├── README.md                   # Main documentation
└── CONTRIBUTING.md             # This file
```

## Building the Project

### JavaScript Components

No build step required - the JavaScript code runs directly in Node.js.

### Native Binaries

#### Using Docker (Recommended)

```bash
cd internal
docker build -t fec-raptorq-builder .
docker run --rm -v "$(pwd)":/volume fec-raptorq-builder
```

#### Local Development (Linux/macOS)

```bash
cd internal
chmod +x build.sh
./build.sh
```

#### Windows Development

```bash
cd internal/dev
./build.bat
```

### Build Output

Compiled binaries are placed in `internal/bin/<target>/` where `<target>` is:
- `x86_64-unknown-linux-gnu/raptorq`
- `aarch64-unknown-linux-gnu/raptorq`  
- `x86_64-pc-windows-gnu/raptorq.exe`

## Testing

### Running Tests

```bash
# Run the main test suite
npm test

# Manual CLI testing
cd internal
echo "Hello, World!" | ./bin/x86_64-unknown-linux-gnu/raptorq --encode | ./bin/x86_64-unknown-linux-gnu/raptorq --decode
```

### Test Coverage

Current test coverage includes:
- Basic encoding/decoding functionality
- Binary wrapper integration
- Platform detection
- Error handling

### Adding Tests

When contributing new features:

1. Add unit tests in `src/index.test.js`
2. Include integration tests for new API methods
3. Test error conditions and edge cases
4. Verify cross-platform compatibility

## Contributing Guidelines

### Types of Contributions Welcome

- **Platform Support**: Add missing platform targets (Windows aarch64, macOS, WASM)
- **API Enhancements**: Higher-level JavaScript APIs for better developer experience
- **Performance**: Optimizations in native code or JavaScript wrapper
- **Documentation**: Improve docs, examples, and guides
- **Testing**: Expand test coverage and add benchmarks
- **Bug Fixes**: Address issues and edge cases

### Priority Areas

1. **Windows aarch64 Support**: Cross-compilation setup needed
2. **macOS Support**: Investigate licensing and build options
3. **Web/WASM**: Performance assessment and implementation
4. **Higher-level APIs**: Stream processing, automatic chunking, etc.
5. **Performance Benchmarks**: Systematic performance testing

### Contribution Workflow

1. **Check existing issues** for similar work or discussions
2. **Open an issue** to discuss major changes before implementation
3. **Fork the repository** and create a feature branch
4. **Implement your changes** following our coding standards
5. **Add or update tests** as appropriate
6. **Update documentation** for user-facing changes
7. **Submit a pull request** with clear description

## Code Style and Standards

### JavaScript

- **ES Modules**: Use `import`/`export` syntax
- **Node.js Compatibility**: Maintain compatibility with Node.js >= 12.0.0
- **Error Handling**: Comprehensive error handling with descriptive messages
- **Documentation**: JSDoc comments for public APIs
- **Formatting**: Consistent indentation (tabs preferred based on existing code)

### Example JavaScript Style

```javascript
/**
 * Encodes data using RaptorQ forward error correction
 * @param {Buffer} data - The input data to encode
 * @param {Object} options - Encoding options
 * @param {number} options.symbol_size - Size of each encoding symbol
 * @param {number} options.repair_symbols - Number of repair symbols to generate
 * @returns {Promise<Buffer>} The encoded data with OTI header
 * @throws {Error} If encoding fails or invalid parameters provided
 */
export async function raptorq_encode(data, options = {}) {
    // Implementation...
}
```

### Rust (for native components)

- Follow standard Rust conventions (rustfmt)
- Comprehensive error handling
- Clear documentation with examples
- Performance-conscious code

### CLI Interface

- POSIX-compliant argument parsing
- Clear help text and examples
- Consistent error reporting
- Support for stdin/stdout piping

## Submitting Changes

### Pull Request Guidelines

1. **Clear Title**: Summarize the change in one line
2. **Description**: Explain what changes you made and why
3. **Breaking Changes**: Clearly mark any breaking changes
4. **Testing**: Describe how you tested the changes
5. **Documentation**: Update docs for user-facing changes

### Pull Request Template

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Performance improvement

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing performed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added for new functionality
```

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add Windows aarch64 cross-compilation support

- Add aarch64-pc-windows-gnu target to build.sh
- Update Dockerfile with Windows ARM64 toolchain
- Add platform detection in get_binary_path()

Fixes #42
```

Format: `<type>: <description>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Issue Guidelines

### Reporting Bugs

Include the following information:

- **Environment**: OS, Node.js version, architecture
- **Version**: Package version experiencing the issue
- **Steps to Reproduce**: Minimal example to reproduce the problem
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Additional Context**: Error messages, logs, etc.

### Feature Requests

- **Use Case**: Describe the problem you're trying to solve
- **Proposed Solution**: How you envision the feature working
- **Alternatives**: Other approaches you've considered
- **Implementation Ideas**: If you have technical insights

### Bug Report Template

```markdown
## Environment
- OS: [e.g., Windows 11, Ubuntu 20.04]
- Node.js version: [e.g., 18.16.0]
- Architecture: [e.g., x64, arm64]
- Package version: [e.g., 1.0.0]

## Steps to Reproduce
1. Install package
2. Run the following code: ...
3. Observe error

## Expected Behavior
Should encode data without errors

## Actual Behavior
Throws error: "..."

## Additional Context
Error stack trace, relevant logs, etc.
```

## Platform Support

### Currently Supported
- ✅ **Linux x86_64**: Full support
- ✅ **Linux aarch64**: Full support  
- ✅ **Windows x86_64**: Full support

### Looking for Contributors
- ❌ **Windows aarch64**: Need cross-compilation support
- ❌ **macOS**: Licensing restrictions, need investigation
- ❌ **Web/WASM**: Performance assessment required

### Adding Platform Support

To add a new platform:

1. **Update build scripts** (`internal/build.sh`, `internal/Dockerfile`)
2. **Add platform detection** in `src/index.js` `get_binary_path()`
3. **Test cross-compilation** in CI environment
4. **Update documentation** and supported platforms list
5. **Submit PR** with comprehensive testing

## Performance Considerations

### Native Binary Performance

The underlying Rust implementation provides excellent performance:
- **Encoding**: 2-12 Gbit/s depending on symbol count and configuration
- **Decoding**: ~2.5 Gbit/s with minimal overhead
- **Memory**: Efficient memory usage with streaming support

### JavaScript Wrapper Performance

Bottlenecks in the wrapper layer:
- Process spawning overhead
- Data serialization between Node.js and native binary
- Buffer copying and memory allocation

### Optimization Opportunities

1. **Direct FFI**: Replace process spawning with native addons
2. **Streaming APIs**: Implement proper stream interfaces  
3. **Worker Threads**: Parallel processing for large datasets
4. **Memory Pools**: Reduce allocation overhead

### Benchmarking

When making performance changes:

1. **Baseline Measurements**: Test before changes
2. **Isolated Tests**: Test specific components
3. **Real-world Scenarios**: Test with typical usage patterns
4. **Cross-platform**: Verify performance on all supported platforms

## Documentation

### Types of Documentation

1. **API Documentation**: JSDoc in source code
2. **User Guides**: README.md and usage examples
3. **Developer Docs**: This CONTRIBUTING.md
4. **CLI Documentation**: internal/CLI.md

### Documentation Standards

- **Clear Examples**: Working code samples
- **Error Scenarios**: Document error conditions
- **Performance Notes**: Include performance characteristics
- **Cross-references**: Link to related functionality

### Writing Good Examples

```javascript
// ✅ Good: Complete, runnable example
import { raptorq_raw } from "@davidcal/fec-raptorq";

const data = Buffer.from("Hello, World!");
const options = {
    symbol_size: 64,
    repair_symbols: 10
};

try {
    const encoded = await raptorq_raw.encode(data, options);
    const decoded = await raptorq_raw.decode(encoded);
    console.log(decoded.toString()); // "Hello, World!"
} catch (error) {
    console.error("Encoding failed:", error.message);
}

// ❌ Bad: Incomplete, unclear example  
const result = raptorq_raw.encode(data);
```

## Community and Support

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Pull Requests**: Code contributions and reviews

### Getting Help

1. **Check Documentation**: README.md and CLI.md
2. **Search Issues**: Look for similar problems
3. **Create Issue**: If no existing solution found
4. **Provide Details**: Include environment and reproduction steps

### Code Review Process

All pull requests go through review:

1. **Automated Checks**: Tests and linting
2. **Code Review**: Maintainer review for quality and standards
3. **Testing**: Contributor testing on multiple platforms
4. **Documentation**: Ensure docs are updated appropriately

### Maintainer Response Time

- **Bug Reports**: Within 1-3 days
- **Feature Requests**: Within 1 week
- **Pull Requests**: Within 1 week for initial review

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Workflow

1. Update version in `package.json`
2. Update CHANGELOG.md (if exists)
3. Create git tag
4. Publish to npm
5. Create GitHub release

### Pre-release Testing

Before releases:
- All tests pass on supported platforms
- Manual testing of key features
- Documentation updates reviewed
- Breaking changes clearly documented

## License

This project is licensed under the MIT License. By contributing, you agree that your contributions will be licensed under the same license.

### Contributor License Agreement

By submitting a pull request, you represent that:

1. You have the right to license your contribution to the project
2. You agree to license your contribution under the project's MIT license
3. Your contribution does not violate any third-party rights

---

## Questions?

If you have questions about contributing:

1. Check this CONTRIBUTING.md file
2. Review existing issues and discussions
3. Create a new issue with the "question" label
4. Tag the maintainers if urgent

We appreciate all contributions, from small bug fixes to major features. Every contribution helps make this project better for the entire community!

## Quick Reference

### Common Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build native binaries (Docker)
cd internal && docker build -t fec-raptorq-builder . && docker run --rm -v "$(pwd)":/volume fec-raptorq-builder

# Test CLI manually
echo "test data" | ./internal/bin/x86_64-unknown-linux-gnu/raptorq --encode | ./internal/bin/x86_64-unknown-linux-gnu/raptorq --decode
```

### Useful File Locations

- Main API: `src/index.js`
- Tests: `src/index.test.js`
- Build script: `internal/build.sh`
- CLI docs: `internal/CLI.md`
- Package config: `package.json`

Thank you for contributing to @davidcal/fec-raptorq! 🚀
