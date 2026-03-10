/// Exports the two precompile wrappers that the pallet-revive runtime consumes.
/// Each precompile wraps one of the two core modules and handles the full
/// call lifecycle: receive raw bytes → decode → execute → encode → return bytes.

pub mod coretime_oracle_precompile;
pub mod pricing_module_precompile;
