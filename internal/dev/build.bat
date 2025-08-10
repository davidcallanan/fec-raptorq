docker build -t davidcallanan-fec-raptorq-internal-builder .
docker run -it -v "%CD%\bin:/volume/bin" davidcallanan-fec-raptorq-internal-builder
