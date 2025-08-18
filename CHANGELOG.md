# Changelog

**1.5.0**

- Breaking: Rename `max_external_bits` to `external_bits` in `raptorq_suppa` to better reflect its purpose.
- Breaking: Improve bit packing for FEC Payload ID in `raptorq_suppa` when `strategy.sbn` and `strategy.esi` are chosen to not take up full bytes.
- Add `oti_spec` to the `raptorq_suppa.encode` return value, in preparation for customizable `oti` output.
- Improve documentation.

**1.4.0**

- Breaking: Restructure the `raptorq_suppa` interface's `strategy.sbn` customization.
- Add `strategy.esi` customization to the `raptorq_suppa` interface.
- Improve documentation.

**1.3.0**:

 - Breaking: Rename `encoding_symbols` to `encoding_blocks`.
 - Introduce `raptorq_suppa` interface with `strategy.sbn` customization.
 - Improve documentation.
