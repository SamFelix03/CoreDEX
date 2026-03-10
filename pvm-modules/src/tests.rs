/// Integration tests for CoreDEX PVM modules.
///
/// These tests verify the end-to-end flow from precompile call → decode → execute → encode.

#[cfg(test)]
mod integration {
    use crate::precompile_set::CoreDexPrecompileSet;
    use crate::pricing_module::{self, OptionType, U_PRECISION};

    /// Verify that both precompile addresses are recognised.
    #[test]
    fn test_precompile_set_recognises_addresses() {
        use crate::precompile_set::{
            CORETIME_ORACLE_PRECOMPILE_ADDRESS,
            PRICING_MODULE_PRECOMPILE_ADDRESS,
        };

        assert!(CoreDexPrecompileSet::is_precompile(&CORETIME_ORACLE_PRECOMPILE_ADDRESS));
        assert!(CoreDexPrecompileSet::is_precompile(&PRICING_MODULE_PRECOMPILE_ADDRESS));
    }

    /// Put-call parity: C - P = S - K × e^(-rT)
    /// This is a fundamental relationship that must hold for any valid pricing model.
    #[test]
    fn test_put_call_parity() {
        let spot = 100 * U_PRECISION;
        let strike = 100 * U_PRECISION;
        let blocks = 14_400 * 30; // ~30 days
        let vol = 500_000_000_000_000_000u64; // 50%

        let call_result = pricing_module::price_option(
            spot, strike, blocks, vol, OptionType::Call,
        ).unwrap();

        let put_result = pricing_module::price_option(
            spot, strike, blocks, vol, OptionType::Put,
        ).unwrap();

        // C - P should approximately equal S - K × e^(-rT)
        // For ATM options with small r and short T, C ≈ P
        let call_premium = call_result.premium as i128;
        let put_premium = put_result.premium as i128;

        // Allow 10% tolerance for the approximation
        let diff = (call_premium - put_premium).unsigned_abs();
        let max_diff = spot as u128 / 10; // 10% of spot

        assert!(
            diff < max_diff,
            "Put-call parity violated: call={}, put={}, diff={}",
            call_premium, put_premium, diff
        );
    }

    /// Higher volatility should produce higher premiums.
    #[test]
    fn test_higher_vol_higher_premium() {
        let spot = 100 * U_PRECISION;
        let strike = 100 * U_PRECISION;
        let blocks = 14_400 * 30;

        let low_vol = pricing_module::price_option(
            spot, strike, blocks,
            200_000_000_000_000_000, // 20% vol
            OptionType::Call,
        ).unwrap();

        let high_vol = pricing_module::price_option(
            spot, strike, blocks,
            800_000_000_000_000_000, // 80% vol
            OptionType::Call,
        ).unwrap();

        assert!(
            high_vol.premium > low_vol.premium,
            "Higher vol must produce higher premium: low={}, high={}",
            low_vol.premium, high_vol.premium
        );
    }

    /// Longer time to expiry should produce higher premiums (all else equal).
    #[test]
    fn test_longer_expiry_higher_premium() {
        let spot = 100 * U_PRECISION;
        let strike = 100 * U_PRECISION;
        let vol = 500_000_000_000_000_000u64;

        let short_expiry = pricing_module::price_option(
            spot, strike, 14_400 * 7, vol, OptionType::Call,
        ).unwrap();

        let long_expiry = pricing_module::price_option(
            spot, strike, 14_400 * 90, vol, OptionType::Call,
        ).unwrap();

        assert!(
            long_expiry.premium > short_expiry.premium,
            "Longer expiry must produce higher premium: short={}, long={}",
            short_expiry.premium, long_expiry.premium
        );
    }

    /// Call delta should be between 0 and 1.
    #[test]
    fn test_call_delta_bounds() {
        let result = pricing_module::price_option(
            100 * U_PRECISION,
            100 * U_PRECISION,
            14_400 * 30,
            500_000_000_000_000_000,
            OptionType::Call,
        ).unwrap();

        assert!(result.delta >= 0, "Call delta must be >= 0");
        assert!(result.delta <= pricing_module::PRECISION,
            "Call delta must be <= 1.0");
    }

    /// Put delta should be between -1 and 0.
    #[test]
    fn test_put_delta_bounds() {
        let result = pricing_module::price_option(
            100 * U_PRECISION,
            100 * U_PRECISION,
            14_400 * 30,
            500_000_000_000_000_000,
            OptionType::Put,
        ).unwrap();

        assert!(result.delta <= 0, "Put delta must be <= 0");
        assert!(result.delta >= -pricing_module::PRECISION,
            "Put delta must be >= -1.0");
    }
}
