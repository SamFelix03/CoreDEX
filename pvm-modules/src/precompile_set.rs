/// Fixed precompile address constants and the PrecompileSet dispatch implementation
/// consumed by the pallet-revive runtime configuration.
///
/// HOW PRECOMPILE ADDRESSES WORK IN PALLET-REVIVE:
/// pallet-revive assigns fixed H160 addresses to precompiles at runtime configuration
/// time. When a Solidity contract calls one of these addresses, pallet-revive
/// intercepts the call before EVM execution and routes it to the registered Rust
/// handler instead. The address is what OptionsEngine.sol and ForwardMarket.sol
/// hard-code as their call targets — it must match exactly between this file,
/// the Solidity contracts, and frontend/constants/index.ts.
///
/// ADDRESS SCHEME:
/// Polkadot system precompiles live at 0x0000...0001 through 0x0000...00FF.
/// Protocol-level precompiles (like CoreDEX's) are placed in the 0x0000...2000
/// range to avoid collisions with other protocols.

use sp_core::H160;
use crate::precompiles::{
    coretime_oracle_precompile,
    pricing_module_precompile,
};

// ---------------------------------------------------------------------------
// Precompile address constants
// ---------------------------------------------------------------------------

/// Fixed address for the CoretimeOracle precompile.
/// Must match the address registered in CoreDexRegistry and frontend constants.
pub const CORETIME_ORACLE_PRECOMPILE_ADDRESS: H160 = H160([
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x20, 0x01, // 0x0000...2001
]);

/// Fixed address for the PricingModule precompile.
/// Must match the address registered in CoreDexRegistry and frontend constants.
pub const PRICING_MODULE_PRECOMPILE_ADDRESS: H160 = H160([
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x20, 0x02, // 0x0000...2002
]);

// ---------------------------------------------------------------------------
// PrecompileSet implementation
// ---------------------------------------------------------------------------

/// The precompile set registered in the pallet-revive runtime config.
///
/// The runtime calls `is_precompile` to check if a target address is handled
/// by a precompile (allowing pallet-revive to short-circuit normal contract
/// execution), then calls `execute` to run the handler and return output bytes.
pub struct CoreDexPrecompileSet;

impl CoreDexPrecompileSet {
    /// Returns true if the given address maps to a registered CoreDEX precompile.
    /// Called by the pallet-revive runtime before every contract call.
    pub fn is_precompile(address: &H160) -> bool {
        *address == CORETIME_ORACLE_PRECOMPILE_ADDRESS
            || *address == PRICING_MODULE_PRECOMPILE_ADDRESS
    }

    /// Route a call to the correct precompile handler and return the output bytes.
    /// Returns None if the address is not a registered precompile — the runtime
    /// will then proceed with normal contract execution.
    pub fn execute(address: &H160, input: &[u8]) -> Option<Vec<u8>> {
        if *address == CORETIME_ORACLE_PRECOMPILE_ADDRESS {
            return Some(coretime_oracle_precompile::call(input));
        }
        if *address == PRICING_MODULE_PRECOMPILE_ADDRESS {
            return Some(pricing_module_precompile::call(input));
        }
        None
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_precompile_recognises_both_addresses() {
        assert!(
            CoreDexPrecompileSet::is_precompile(&CORETIME_ORACLE_PRECOMPILE_ADDRESS),
            "CoretimeOracle address must be a registered precompile"
        );
        assert!(
            CoreDexPrecompileSet::is_precompile(&PRICING_MODULE_PRECOMPILE_ADDRESS),
            "PricingModule address must be a registered precompile"
        );
    }

    #[test]
    fn test_is_precompile_rejects_unknown_address() {
        let unknown = H160([0xde; 20]);
        assert!(
            !CoreDexPrecompileSet::is_precompile(&unknown),
            "Unknown address must not be a precompile"
        );
    }

    #[test]
    fn test_precompile_addresses_are_distinct() {
        assert_ne!(
            CORETIME_ORACLE_PRECOMPILE_ADDRESS,
            PRICING_MODULE_PRECOMPILE_ADDRESS,
            "Precompile addresses must be unique"
        );
    }

    #[test]
    fn test_execute_unknown_address_returns_none() {
        let unknown = H160([0xab; 20]);
        let result = CoreDexPrecompileSet::execute(&unknown, &[]);
        assert!(result.is_none(), "Unknown address must return None from execute");
    }

    #[test]
    fn test_execute_known_address_returns_some() {
        // Empty input will trigger an error inside the precompile,
        // but the outer Option must still be Some.
        let result = CoreDexPrecompileSet::execute(
            &CORETIME_ORACLE_PRECOMPILE_ADDRESS,
            &[],
        );
        assert!(
            result.is_some(),
            "Known address must always return Some from execute"
        );
    }
}
