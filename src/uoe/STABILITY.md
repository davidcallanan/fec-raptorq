# Stability

There are five possible stability tags associated with each feature.

 - `0 (deprecated)` - The feature is deprecated and will be removed or drastically changed in an upcoming release.
 - `1 (experimental)` - The feature is very unstable and subject to significant changes without notice.
 - `2 (provisional)` - The feature is mostly stable but may be subject to breaking changes over time to allow for necessary enhancements.
 - `3 (stable)` - The feature is stable and will seldom change in a backwards-incompatible manner. Instead, enhancements should augment the existing interface.
 - `4 (locked)` - The feature is only subject to critical bug fixes Backwards-incompatible changes are avoided to the best extent possible.

See the `@stability` tag in doc-comments for the stability of each feature. If a feature is not tagged, and the stability cannot be inferred, it is considered experimental.
