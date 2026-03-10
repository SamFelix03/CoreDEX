/// ABI encoding/decoding layer between Solidity contracts and CoreDEX PVM modules.
///
/// Every type here must match the Solidity struct layout exactly — field order,
/// type widths, and padding all matter. Any mismatch produces silently corrupt
/// data on the Solidity side with no runtime error.
///
/// ENCODING MODEL:
/// Solidity encodes structs with abi.encode() using the standard ABI spec:
///   - uint128  → 32-byte word, value right-aligned
///   - uint64   → 32-byte word, value right-aligned
///   - uint32   → 32-byte word, value right-aligned
///   - int128   → 32-byte word, two's complement, right-aligned
///   - bool     → 32-byte word, 0 or 1
///
/// ethabi mirrors this layout exactly when given the correct ParamType descriptors.

use ethabi::{decode, encode, ParamType, Token};
use crate::coretime_oracle::OracleData;
use crate::pricing_module::{PricingResult_, OptionType};

// ---------------------------------------------------------------------------
// Decode: CoretimeOracle inputs
// ---------------------------------------------------------------------------

/// ABI-decode the lookback_blocks parameter for oracle queries.
///
/// Expected Solidity encoding: (uint32 lookback_blocks)
pub fn decode_oracle_input(input: &[u8]) -> Option<u32> {
    let types = vec![ParamType::Uint(32)];
    let tokens = decode(&types, input).ok()?;

    if tokens.is_empty() {
        return None;
    }

    tokens[0].clone().into_uint()?.as_u32().into()
}

// ---------------------------------------------------------------------------
// Encode: CoretimeOracle outputs
// ---------------------------------------------------------------------------

/// ABI-encode OracleData for return to Solidity.
///
/// Matching Solidity layout:
///   (uint128 spotPrice, uint128 twap, uint128 utilisation,
///    uint64 impliedVolatility, uint32 dataBlock)
pub fn encode_oracle_data(data: &OracleData) -> Vec<u8> {
    encode(&[
        Token::Uint(data.spot_price.into()),
        Token::Uint(data.twap.into()),
        Token::Uint(data.utilisation.into()),
        Token::Uint(data.implied_volatility.into()),
        Token::Uint(data.data_block.into()),
    ])
}

// ---------------------------------------------------------------------------
// Decode: PricingModule inputs
// ---------------------------------------------------------------------------

/// Decoded pricing input from Solidity.
pub struct PricingInput {
    pub spot: u128,
    pub strike: u128,
    pub blocks_to_expiry: u32,
    pub volatility: u64,
    pub option_type: u8,
}

/// ABI-decode the pricing parameters from Solidity calldata.
///
/// Expected Solidity encoding:
///   (uint128 spot, uint128 strike, uint32 blocksToExpiry,
///    uint64 volatility, uint8 optionType)
pub fn decode_pricing_input(input: &[u8]) -> Option<PricingInput> {
    let types = vec![
        ParamType::Uint(128), // spot
        ParamType::Uint(128), // strike
        ParamType::Uint(32),  // blocksToExpiry
        ParamType::Uint(64),  // volatility
        ParamType::Uint(8),   // optionType
    ];

    let tokens = decode(&types, input).ok()?;

    if tokens.len() != 5 {
        return None;
    }

    let spot = tokens[0].clone().into_uint()?.as_u128();
    let strike = tokens[1].clone().into_uint()?.as_u128();
    let blocks_to_expiry = tokens[2].clone().into_uint()?.as_u32();
    let volatility = tokens[3].clone().into_uint()?.as_u64();
    let option_type = tokens[4].clone().into_uint()?.low_u32() as u8;

    Some(PricingInput {
        spot,
        strike,
        blocks_to_expiry,
        volatility,
        option_type,
    })
}

/// Decoded IV solver input from Solidity.
pub struct IVSolverInput {
    pub spot: u128,
    pub strike: u128,
    pub blocks_to_expiry: u32,
    pub market_premium: u128,
    pub option_type: u8,
}

/// ABI-decode the IV solver parameters from Solidity calldata.
///
/// Expected Solidity encoding:
///   (uint128 spot, uint128 strike, uint32 blocksToExpiry,
///    uint128 marketPremium, uint8 optionType)
pub fn decode_iv_solver_input(input: &[u8]) -> Option<IVSolverInput> {
    let types = vec![
        ParamType::Uint(128), // spot
        ParamType::Uint(128), // strike
        ParamType::Uint(32),  // blocksToExpiry
        ParamType::Uint(128), // marketPremium
        ParamType::Uint(8),   // optionType
    ];

    let tokens = decode(&types, input).ok()?;

    if tokens.len() != 5 {
        return None;
    }

    Some(IVSolverInput {
        spot: tokens[0].clone().into_uint()?.as_u128(),
        strike: tokens[1].clone().into_uint()?.as_u128(),
        blocks_to_expiry: tokens[2].clone().into_uint()?.as_u32(),
        market_premium: tokens[3].clone().into_uint()?.as_u128(),
        option_type: tokens[4].clone().into_uint()?.low_u32() as u8,
    })
}

// ---------------------------------------------------------------------------
// Encode: PricingModule outputs
// ---------------------------------------------------------------------------

/// ABI-encode PricingResult_ for return to Solidity.
///
/// Matching Solidity layout:
///   (uint128 premium, int128 delta)
pub fn encode_pricing_result(result: &PricingResult_) -> Vec<u8> {
    // Delta is i128 — encode as int256 (two's complement, sign-extended)
    let delta_token = if result.delta >= 0 {
        Token::Int(result.delta.into())
    } else {
        // For negative values, ethabi handles two's complement
        Token::Int(result.delta.into())
    };

    encode(&[
        Token::Uint(result.premium.into()),
        delta_token,
    ])
}

/// ABI-encode implied volatility result for return to Solidity.
///
/// Matching Solidity layout: (uint64 impliedVolatility)
pub fn encode_iv_result(iv: u64) -> Vec<u8> {
    encode(&[Token::Uint(iv.into())])
}

// ---------------------------------------------------------------------------
// Error output encoding
// ---------------------------------------------------------------------------

/// Encode a standardised error response returned to Solidity.
///
/// Layout: (bool success, uint32 error_code)
///
/// Error codes:
///   1 = InvalidInput
///   2 = Overflow
///   3 = DivisionByZero
///   4 = StorageReadFailed
///   5 = DecodeFailed
///   6 = InsufficientData
///   7 = ConvergenceFailure
///   8 = NegativePrice
///   9 = UnknownSelector
///  10 = DecodeFailed (ABI)
pub fn encode_error(error_code: u32) -> Vec<u8> {
    encode(&[
        Token::Bool(false),
        Token::Uint(error_code.into()),
    ])
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coretime_oracle::PRECISION;

    #[test]
    fn test_encode_oracle_data_length() {
        let data = OracleData {
            spot_price: 100 * PRECISION,
            twap: 95 * PRECISION,
            utilisation: 75 * PRECISION,
            implied_volatility: 500_000_000_000_000_000,
            data_block: 12345,
        };
        let encoded = encode_oracle_data(&data);
        // 5 ABI words × 32 bytes each = 160 bytes
        assert_eq!(encoded.len(), 5 * 32, "Encoded oracle data must be 160 bytes");
    }

    #[test]
    fn test_decode_pricing_input_round_trip() {
        let encoded = encode(&[
            Token::Uint(100u128.into()),    // spot
            Token::Uint(110u128.into()),    // strike
            Token::Uint(14400u32.into()),   // blocksToExpiry
            Token::Uint(500000u64.into()),  // volatility
            Token::Uint(0u8.into()),        // optionType (Call)
        ]);

        let decoded = decode_pricing_input(&encoded).expect("Decode must succeed");
        assert_eq!(decoded.spot, 100);
        assert_eq!(decoded.strike, 110);
        assert_eq!(decoded.blocks_to_expiry, 14400);
        assert_eq!(decoded.volatility, 500000);
        assert_eq!(decoded.option_type, 0);
    }

    #[test]
    fn test_decode_empty_input_returns_none() {
        assert!(decode_pricing_input(&[]).is_none());
    }

    #[test]
    fn test_encode_error_length() {
        let encoded = encode_error(1);
        assert_eq!(encoded.len(), 2 * 32, "Error encoding must be 64 bytes");
    }

    #[test]
    fn test_encode_error_first_word_is_false() {
        let encoded = encode_error(2);
        let first_word = &encoded[0..32];
        assert!(
            first_word.iter().all(|&b| b == 0),
            "First word of error encoding must be all zeros (false)"
        );
    }

    #[test]
    fn test_encode_pricing_result() {
        let result = PricingResult_ {
            premium: 50 * PRECISION,
            delta: PRECISION as i128 / 2, // 0.5
        };
        let encoded = encode_pricing_result(&result);
        // 2 ABI words × 32 bytes = 64 bytes
        assert_eq!(encoded.len(), 2 * 32);
    }
}
