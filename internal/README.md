# Internal

This directory houses the source code for an internal raptorq executable, alongside a build process for common target platforms. The runtime Node.js environment then runs the appropriate binary depending on the platform and communicates with this instance via stdin/stdout.

See `CLI.md` to see how this executable behaves.

The `/raptorq` directory is forked from [this repository](https://github.com/cberner/raptorq/tree/e77786189041602b1e47b3d0c7ea00ea891c07f1).  Be mindful of the licensing requirements for that work.

We use a single build environment via Docker to build for **all target platforms** (some targets are not setup appropriately at this time, and Mac OS is impossible due to licensing restrictions).

For simplicity, targets are built at development time so as to put no burden on the NPM package during install.

## Requirements

- Docker

## Build

**Linux**:

```
chmod +x ./dev/build.sh
./dev/build.sh
```

**Windows**:

```
.\dev\build.bat
```

## Test

**Linux x86_64**:

```
chmod +x ./test.sh
./test.sh
```

## Bench

**Linux x86_64**:

```
time for i in $(seq 1 100); do
  ./test.sh
done
```
