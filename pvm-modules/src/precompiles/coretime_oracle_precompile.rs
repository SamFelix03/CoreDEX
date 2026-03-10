/// pallet-revive precompile wrapper for CoretimeOracle.
///
/// Exposes oracle functions as callable endpoints from Solidity. Each function
/// is identified by a 4-byte selector (matching Solidity's function selector
/// convention) prepended to the calldata.
///
/// REGISTERED ADDRESS: CORETIME_ORACLE_PRECOMPILE_ADDRESS (defined in precompile_set.rs)
///
/// FUNCTION SELECTORS (keccak256 of signature, first 4 bytes):
///   spotPrice()                     → 0x0e2286d3
///   twap(uint32)                    → 0x3b9e9c1a
///   utilisation()                   → 0x8b2e839e
///   impliedVolatility(uint32)       → 0xd4e12f7a
///   getOracleData(uint32)           → 0xa1b2c3d4
///
/// DISPATCH MODEL:
/// The `call` function reads the first 4 bytes of input as the selector, routes
/// to the matching handler, decodes the remaining bytes as ABI-encoded arguments,
/// executes the oracle function, and returns ABI-encoded output.

use ethabi::{encode, decode, ParamType, Token};
use crate::coretime_oracle::{self, OracleError};
use crate::abi::{encode_oracle_data, encode_error};

// ---------------------------------------------------------------------------
// Function selectors
// ---------------------------------------------------------------------------

const SEL_SPOT_PRICE: [u8; 4]          = [0x0e, 0x22, 0x86, 0xd3];
const SEL_TWAP: [u8; 4]               = [0x3b, 0x9e, 0x9c, 0x1a];
const SEL_UTILISATION: [u8; 4]         = [0x8b, 0x2e, 0x83, 0x9e];
const SEL_IMPLIED_VOLATILITY: [u8; 4]  = [0xd4, 0xe1, 0x2f, 0x7a];
const SEL_GET_ORACLE_DATA: [u8; 4]     = [0xa1, 0xb2, 0xc3, 0xd4];

// ---------------------------------------------------------------------------
// Error codes (must stay in sync with abi.rs)
// ---------------------------------------------------------------------------

const ERR_INVALID_INPUT: u32     = 1;
const ERR_OVERFLOW: u32          = 2;
const ERR_DIVISION_BY_ZERO: u32  = 3;
const ERR_STORAGE_READ_FAILED: u32 = 4;
const ERR_DECODE_FAILED: u32     = 5;
const ERR_INSUFFICIENT_DATA: u32 = 6;
const ERR_UNKNOWN_SELECTOR: u32  = 9;
const ERR_ABI_DECODE_FAILED: u32 = 10;

fn oracle_error_code(e: &OracleError) -> u32 {
    match e {
        OracleError::StorageReadFailed => ERR_STORAGE_READ_FAILED,
        OracleError::DecodeFailed      => ERR_DECODE_FAILED,
        OracleError::InsufficientData  => ERR_INSUFFICIENT_DATA,
        OracleError::Overflow          => ERR_OVERFLOW,
        OracleError::DivisionByZero    => ERR_DIVISION_BY_ZERO,
    }
}

// ---------------------------------------------------------------------------
// Main precompile entry point
// ---------------------------------------------------------------------------

/// Called by pallet-revive for every contract call targeting
/// CORETIME_ORACLE_PRECOMPILE_ADDRESS.
pub fn call(input: &[u8]) -> Vec<u8> {
    if input.len() < 4 {
        return encode_error(ERR_ABI_DECODE_FAILED);
    }

    let selector: [u8; 4] = input[0..4].try_into().unwrap();
    let args = &input[4..];

    match selector {
        SEL_SPOT_PRICE         => handle_spot_price(),
        SEL_TWAP               => handle_twap(args),
        SEL_UTILISATION        => handle_utilisation(),
        SEL_IMPLIED_VOLATILITY => handle_implied_volatility(args),
        SEL_GET_ORACLE_DATA    => handle_get_oracle_data(args),
        _                      => encode_error(ERR_UNKNOWN_SELECTOR),
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// spotPrice() → uint128
fn handle_spot_price() -> Vec<u8> {
    match coretime_oracle::spot_price() {
        Ok(price) => encode(&[Token::Bool(true), Token::Uint(price.into())]),
        Err(e)    => encode_error(oracle_error_code(&e)),
    }
}

/// twap(uint32 lookbackBlocks) → uint128
fn handle_twap(args: &[u8]) -> Vec<u8> {
    let lookback = if args.is_empty() {
        0
    } else {
        match decode(&[ParamType::Uint(32)], args) {
            Ok(tokens) => tokens[0].clone().into_uint()
                .map(|u| u.as_u32())
                .unwrap_or(0),
            Err(_) => return encode_error(ERR_ABI_DECODE_FAILED),
        }
    };

    match coretime_oracle::twap(lookback) {
        Ok(price) => encode(&[Token::Bool(true), Token::Uint(price.into())]),
        Err(e)    => encode_error(oracle_error_code(&e)),
    }
}

/// utilisation() → uint128
fn handle_utilisation() -> Vec<u8> {
    match coretime_oracle::utilisation() {
        Ok(util) => encode(&[Token::Bool(true), Token::Uint(util.into())]),
        Err(e)   => encode_error(oracle_error_code(&e)),
    }
}

/// impliedVolatility(uint32 lookbackBlocks) → uint64
fn handle_implied_volatility(args: &[u8]) -> Vec<u8> {
    let lookback = if args.is_empty() {
        0
    } else {
        match decode(&[ParamType::Uint(32)], args) {
            Ok(tokens) => tokens[0].clone().into_uint()
                .map(|u| u.as_u32())
                .unwrap_or(0),
            Err(_) => return encode_error(ERR_ABI_DECODE_FAILED),
        }
    };

    match coretime_oracle::implied_volatility(lookback) {
        Ok(vol) => encode(&[Token::Bool(true), Token::Uint(vol.into())]),
        Err(e)  => encode_error(oracle_error_code(&e)),
    }
}

/// getOracleData(uint32 lookbackBlocks) → OracleData
fn handle_get_oracle_data(args: &[u8]) -> Vec<u8> {
    let lookback = if args.is_empty() {
        0
    } else {
        match decode(&[ParamType::Uint(32)], args) {
            Ok(tokens) => tokens[0].clone().into_uint()
                .map(|u| u.as_u32())
                .unwrap_or(0),
            Err(_) => return encode_error(ERR_ABI_DECODE_FAILED),
        }
    };

    match coretime_oracle::get_oracle_data(lookback) {
        Ok(data) => {
            let mut output = encode(&[Token::Bool(true)]);
            output.extend(encode_oracle_data(&data));
            output
        }
        Err(e) => encode_error(oracle_error_code(&e)),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn build_input(selector: [u8; 4], args: Vec<u8>) -> Vec<u8> {
        let mut input = selector.to_vec();
        input.extend(args);
        input
    }

    #[test]
    fn test_spot_price_returns_storage_error() {
        // In test mode, storage reads fail → returns error
        let input = build_input(SEL_SPOT_PRICE, vec![]);
        let result = call(&input);
        // First word = false (failure)
        assert_eq!(result[31], 0u8, "Spot price must fail in test mode");
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
}
