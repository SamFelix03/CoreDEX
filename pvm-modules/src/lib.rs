/// CoreDEX PVM Modules
///
/// Two Rust modules deployed as pallet-revive precompiles on Asset Hub:
///
/// 1. CoretimeOracle — reads Coretime Broker pallet state via sp_io::storage::get()
///    to derive spot price, TWAP, utilisation, and implied volatility. This data
///    feeds into ForwardMarket's strike price validation and OptionsEngine's
///    premium calculation.
///
/// 2. PricingModule — implements Black-Scholes option pricing and Newton-Raphson
///    IV solver using fixed-point arithmetic (i128, 18 decimals). Called by
///    OptionsEngine to compute premiums and deltas.
///
/// Both modules are stateless pure functions. All inputs come from ABI-encoded
/// calldata, all outputs are ABI-encoded return data. No storage writes, no
/// external calls beyond sp_io storage reads in CoretimeOracle.

pub mod coretime_oracle;
pub mod pricing_module;
pub mod abi;
pub mod precompiles;
pub mod precompile_set;

pub use precompile_set::{
    CoreDexPrecompileSet,
    CORETIME_ORACLE_PRECOMPILE_ADDRESS,
    PRICING_MODULE_PRECOMPILE_ADDRESS,
};

#[cfg(test)]
mod tests;
