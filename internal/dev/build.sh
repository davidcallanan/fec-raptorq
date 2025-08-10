docker build -t davidcallanan-fec-raptorq-internal-builder .
docker run -it -v "$(pwd)/bin:/volume/bin" davidcallanan-fec-raptorq-internal-builder
