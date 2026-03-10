/// pallet-revive precompile wrapper for PricingModule.
///
/// Exposes Black-Scholes pricing and IV solver as callable endpoints from Solidity.
/// This is the primary precompile called by OptionsEngine.sol.
///
/// REGISTERED ADDRESS: PRICING_MODULE_PRECOMPILE_ADDRESS (defined in precompile_set.rs)
///
/// FUNCTION SELECTORS:
///   priceOption(uint128,uint128,uint32,uint64,uint8)       → 0xf1a2b3c4
///   solveImpliedVolatility(uint128,uint128,uint32,uint128,uint8) → 0xe5d6c7b8
///
/// ON ERROR:
/// Returns encode_error(error_code). OptionsEngine.sol checks the bool flag
/// in the first return word and reverts with PricingModuleCallFailed().

use ethabi::{encode, Token};
use crate::abi::{
    decode_pricing_input, decode_iv_solver_input,
    encode_pricing_result, encode_iv_result, encode_error,
};
use crate::pricing_module::{self, PricingError, OptionType};

// ---------------------------------------------------------------------------
// Function selectors
// ---------------------------------------------------------------------------

const SEL_PRICE_OPTION: [u8; 4]    = [0xf1, 0xa2, 0xb3, 0xc4];
const SEL_SOLVE_IV: [u8; 4]        = [0xe5, 0xd6, 0xc7, 0xb8];

// ---------------------------------------------------------------------------
// Error codes (must stay in sync with abi.rs)
// ---------------------------------------------------------------------------

const ERR_INVALID_INPUT: u32       = 1;
const ERR_OVERFLOW: u32            = 2;
const ERR_DIVISION_BY_ZERO: u32    = 3;
const ERR_CONVERGENCE_FAILURE: u32 = 7;
const ERR_NEGATIVE_PRICE: u32      = 8;
const ERR_UNKNOWN_SELECTOR: u32    = 9;
const ERR_ABI_DECODE_FAILED: u32   = 10;

fn pricing_error_code(e: &PricingError) -> u32 {
    match e {
        PricingError::InvalidInput       => ERR_INVALID_INPUT,
        PricingError::Overflow           => ERR_OVERFLOW,
        PricingError::DivisionByZero     => ERR_DIVISION_BY_ZERO,
        PricingError::ConvergenceFailure => ERR_CONVERGENCE_FAILURE,
        PricingError::NegativePrice      => ERR_NEGATIVE_PRICE,
    }
}

// ---------------------------------------------------------------------------
// Main precompile entry point
// ---------------------------------------------------------------------------

/// Called by pallet-revive for every contract call targeting
/// PRICING_MODULE_PRECOMPILE_ADDRESS.
pub fn call(input: &[u8]) -> Vec<u8> {
    if input.len() < 4 {
        return encode_error(ERR_ABI_DECODE_FAILED);
    }

    let selector: [u8; 4] = input[0..4].try_into().unwrap();
    let args = &input[4..];

    match selector {
        SEL_PRICE_OPTION => handle_price_option(args),
        SEL_SOLVE_IV     => handle_solve_iv(args),
        _                => encode_error(ERR_UNKNOWN_SELECTOR),
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// priceOption(uint128 spot, uint128 strike, uint32 blocksToExpiry,
///             uint64 volatility, uint8 optionType)
///     → (uint128 premium, int128 delta)
fn handle_price_option(args: &[u8]) -> Vec<u8> {
    let input = match decode_pricing_input(args) {
        Some(i) => i,
        None    => return encode_error(ERR_ABI_DECODE_FAILED),
    };

    let option_type = match OptionType::from_u8(input.option_type) {
        Some(t) => t,
        None    => return encode_error(ERR_INVALID_INPUT),
    };

    match pricing_module::price_option(
        input.spot,
        input.strike,
        input.blocks_to_expiry,
        input.volatility,
        option_type,
    ) {
        Ok(result) => {
            let mut output = encode(&[Token::Bool(true)]);
            output.extend(encode_pricing_result(&result));
            output
        }
        Err(e) => encode_error(pricing_error_code(&e)),
    }
}

/// solveImpliedVolatility(uint128 spot, uint128 strike, uint32 blocksToExpiry,
///                        uint128 marketPremium, uint8 optionType)
///     → (uint64 impliedVolatility)
fn handle_solve_iv(args: &[u8]) -> Vec<u8> {
    let input = match decode_iv_solver_input(args) {
        Some(i) => i,
        None    => return encode_error(ERR_ABI_DECODE_FAILED),
    };

    let option_type = match OptionType::from_u8(input.option_type) {
        Some(t) => t,
        None    => return encode_error(ERR_INVALID_INPUT),
    };

    match pricing_module::solve_implied_volatility(
        input.spot,
        input.strike,
        input.blocks_to_expiry,
        input.market_premium,
        option_type,
    ) {
        Ok(iv) => {
            let mut output = encode(&[Token::Bool(true)]);
            output.extend(encode_iv_result(iv));
            output
        }
        Err(e) => encode_error(pricing_error_code(&e)),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use ethabi::encode;
    use crate::pricing_module::U_PRECISION;

    fn build_input(selector: [u8; 4], args: Vec<u8>) -> Vec<u8> {
        let mut input = selector.to_vec();
        input.extend(args);
        input
    }

    #[test]
    fn test_price_option_call_success() {
        let args = encode(&[
            Token::Uint((100 * U_PRECISION).into()),         // spot: 100 DOT
            Token::Uint((100 * U_PRECISION).into()),         // strike: 100 DOT
            Token::Uint((14_400u32 * 30).into()),            // ~30 days
            Token::Uint(500_000_000_000_000_000u64.into()),  // 50% vol
            Token::Uint(0u8.into()),                         // Call
        ]);
        let result = call(&build_input(SEL_PRICE_OPTION, args));
        assert_eq!(result[31], 1u8, "Price option must succeed");
    }

    #[test]
    fn test_price_option_zero_spot_fails() {
        let args = encode(&[
            Token::Uint(0u128.into()),                       // spot: 0
            Token::Uint((100 * U_PRECISION).into()),
            Token::Uint(14_400u32.into()),
            Token::Uint(500_000_000_000_000_000u64.into()),
            Token::Uint(0u8.into()),
        ]);
        let result = call(&build_input(SEL_PRICE_OPTION, args));
        assert_eq!(result[31], 0u8, "Zero spot must return failure");
    }

    #[test]
    fn test_unknown_selector_returns_error() {
        let input = build_input([0xde, 0xad, 0xbe, 0xef], vec![]);
        let result = call(&input);
        assert_eq!(result[31], 0u8, "Unknown selector must return failure");
    }

    #[test]
    fn test_short_input_returns_error() {
        let result = call(&[0x01, 0x02]);
        assert_eq!(result[31], 0u8, "Short input must return failure");
    }

    #[test]
    fn test_invalid_option_type_returns_error() {
        let args = encode(&[
            Token::Uint((100 * U_PRECISION).into()),
            Token::Uint((100 * U_PRECISION).into()),
            Token::Uint(14_400u32.into()),
            Token::Uint(500_000_000_000_000_000u64.into()),
            Token::Uint(5u8.into()), // Invalid option type
        ]);
        let result = call(&build_input(SEL_PRICE_OPTION, args));
        assert_eq!(result[31], 0u8, "Invalid option type must return failure");
    }

    #[test]
    fn test_price_option_is_deterministic() {
        let args = encode(&[
            Token::Uint((100 * U_PRECISION).into()),
            Token::Uint((110 * U_PRECISION).into()),
            Token::Uint((14_400u32 * 30).into()),
            Token::Uint(500_000_000_000_000_000u64.into()),
            Token::Uint(0u8.into()),
        ]);
        let input = build_input(SEL_PRICE_OPTION, args);
        let r1 = call(&input);
        let r2 = call(&input);
        assert_eq!(r1, r2, "Precompile output must be deterministic");
    }
}
