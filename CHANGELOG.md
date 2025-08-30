# Changelog

**1.8.0**

- Fix `num_source_blocks > 1` in `raptorq_raw` and `raptorq_suppa` interfaces.
- Add `strategy.payload.transfer_length_trim` customization to `raptorq_suppa` interface.
- Improve documentation.

**1.7.0**

- Breaking: Rename `strategy.sbn` to `strategy.encoding_packet.sbn` in `raptorq_suppa`.
- Breaking: Rename `strategy.esi` to `strategy.encoding_packet.esi` in `raptorq_suppa`.
- Fix ability to return `undefined` in `to_external` functions in `raptorq_suppa` to signify disallowed values.
- Add `strategy.oti.placement` customization to the `raptorq_suppa` interface.

**1.6.0**

- Breaking: Remove `max_internal_value` from `strategy.esi` and `strategy.sbn` customization in `raptorq_suppa` since a good `remap` can already facilitate this.
- Add `strategy.oti` customization to the `raptorq_suppa` interface.
- Improve documentation.

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
