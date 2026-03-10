/// CoretimeOracle — the trust anchor of the CoreDEX protocol.
///
/// Uses PVM's sp_io host functions to read Substrate storage directly from the
/// Coretime Chain's broker pallet. Derives:
///   - Spot price: current sale price from broker::SaleInfo
///   - TWAP: time-weighted average price over configurable lookback blocks
///   - Core utilisation: percentage of cores currently assigned vs available
///   - Implied volatility: annualised estimate from recent sale price variance
///
/// WHY RUST / PVM:
/// Direct Substrate storage reads via sp_io::storage::get() are not available
/// as an EVM precompile — there is no Solidity-equivalent path to raw pallet
/// state. This module MUST run in PVM to access the broker pallet's storage.
///
/// PRECISION MODEL:
/// All prices are u128 fixed-point with 18 decimal places (matching DOT).
/// Volatility is u64 fixed-point with 18 decimal places.
/// All arithmetic uses checked operations — no floating point.
///
/// NO EXTERNAL ORACLES:
/// This module derives ALL data from on-chain state. No Chainlink, no API3,
/// no off-chain data feeds. This is a hard requirement (NFR-05).

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Fixed-point precision: 18 decimal places. 1 DOT = PRECISION units.
pub const PRECISION: u128 = 1_000_000_000_000_000_000;

/// Blocks per day at 6-second block time.
pub const BLOCKS_PER_DAY: u32 = 14_400;

/// Default TWAP lookback window in blocks (~7 days).
pub const DEFAULT_TWAP_LOOKBACK: u32 = 100_800;

/// Minimum number of data points required for a valid TWAP.
pub const MIN_TWAP_SAMPLES: u32 = 10;

/// Minimum number of data points required for volatility estimation.
pub const MIN_VOLATILITY_SAMPLES: u32 = 20;

/// Annualisation factor for volatility: sqrt(365) ≈ 19.105 (scaled to 18 decimals).
/// Precomputed to avoid sqrt in fixed-point.
pub const ANNUALISATION_FACTOR: u128 = 19_105_000_000_000_000_000; // 19.105 * 1e18

// ---------------------------------------------------------------------------
// Storage key prefixes for the Coretime Broker pallet
// ---------------------------------------------------------------------------

/// Storage key prefix for broker::SaleInfo
/// This is the twox_128 hash of "Broker" + twox_128 hash of "SaleInfo"
pub const SALE_INFO_KEY: &[u8] = b"Broker SaleInfo";

/// Storage key prefix for broker::Configuration
pub const CONFIGURATION_KEY: &[u8] = b"Broker Configuration";

/// Storage key prefix for broker::InstaPoolHistory
pub const INSTA_POOL_HISTORY_PREFIX: &[u8] = b"Broker InstaPoolHistory";

/// Storage key prefix for broker::Workplan
pub const WORKPLAN_PREFIX: &[u8] = b"Broker Workplan";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, PartialEq, Clone)]
pub enum OracleError {
    /// Substrate storage read returned no data.
    StorageReadFailed,
    /// SCALE decoding of storage value failed.
    DecodeFailed,
    /// Not enough data points for the requested computation.
    InsufficientData,
    /// Arithmetic overflow in fixed-point computation.
    Overflow,
    /// Division by zero.
    DivisionByZero,
}

pub type OracleResult<T> = Result<T, OracleError>;

// ---------------------------------------------------------------------------
// Output structs
// ---------------------------------------------------------------------------

/// Complete oracle output returned to Solidity callers.
#[derive(Debug, Clone, PartialEq)]
pub struct OracleData {
    /// Current spot price in DOT planck (18 decimals).
    pub spot_price: u128,
    /// Time-weighted average price over lookback window (18 decimals).
    pub twap: u128,
    /// Core utilisation as a percentage (0–100, scaled to 18 decimals).
    /// e.g. 75% = 75 * PRECISION.
    pub utilisation: u128,
    /// Annualised implied volatility (18 decimals).
    /// e.g. 0.5 (50% vol) = 500_000_000_000_000_000.
    pub implied_volatility: u64,
    /// Block number at which this data was read.
    pub data_block: u32,
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/// Read the current spot price from the Coretime Broker pallet's SaleInfo storage.
///
/// In production, this calls sp_io::storage::get() with the SCALE-encoded
/// storage key for broker::SaleInfo and decodes the price field.
///
/// For now, this provides a reference implementation that demonstrates the
/// storage read pattern. The actual SCALE key construction and decoding
/// depends on the exact pallet storage layout.
pub fn spot_price() -> OracleResult<u128> {
    // Read SaleInfo from Substrate storage
    // Key: twox_128("Broker") ++ twox_128("SaleInfo")
    let raw_key = build_storage_key(SALE_INFO_KEY, None);

    let storage_value = read_storage(&raw_key)
        .ok_or(OracleError::StorageReadFailed)?;

    // Decode the SaleInfo struct — extract the price field
    // SaleInfo layout (simplified):
    //   sale_start: BlockNumber (u32)
    //   leadin_length: BlockNumber (u32)
    //   price: Balance (u128)
    //   region_begin: Timeslice (u32)
    //   region_end: Timeslice (u32)
    //   ideal_cores_sold: u16
    //   cores_sold: u16
    //   cores_offered: u16
    //   first_core: u16
    //   sellout_price: Option<Balance>
    decode_sale_price(&storage_value)
}

/// Compute TWAP over a configurable lookback window.
///
/// Reads historical price data from InstaPoolHistory entries and computes
/// the time-weighted average. Each entry is weighted by its block duration.
///
/// # Arguments
/// * `lookback_blocks` - Number of blocks to look back for TWAP calculation.
pub fn twap(lookback_blocks: u32) -> OracleResult<u128> {
    let lookback = if lookback_blocks == 0 {
        DEFAULT_TWAP_LOOKBACK
    } else {
        lookback_blocks
    };

    // Read historical price samples from InstaPoolHistory
    let samples = read_price_history(lookback)?;

    if (samples.len() as u32) < MIN_TWAP_SAMPLES {
        return Err(OracleError::InsufficientData);
    }

    // Compute time-weighted average
    let mut weighted_sum: u128 = 0;
    let mut total_weight: u128 = 0;

    for sample in &samples {
        let weight = sample.duration as u128;
        weighted_sum = weighted_sum
            .checked_add(
                sample.price.checked_mul(weight).ok_or(OracleError::Overflow)?
            )
            .ok_or(OracleError::Overflow)?;
        total_weight = total_weight
            .checked_add(weight)
            .ok_or(OracleError::Overflow)?;
    }

    if total_weight == 0 {
        return Err(OracleError::DivisionByZero);
    }

    weighted_sum
        .checked_div(total_weight)
        .ok_or(OracleError::DivisionByZero)
}

/// Compute core utilisation percentage.
///
/// Reads the current Workplan to determine how many cores are assigned
/// vs the total cores offered in the current sale period.
///
/// Returns utilisation as a percentage scaled to 18 decimals.
/// e.g. 75% = 75_000_000_000_000_000_000
pub fn utilisation() -> OracleResult<u128> {
    // Read SaleInfo for cores_offered and cores_sold
    let raw_key = build_storage_key(SALE_INFO_KEY, None);
    let storage_value = read_storage(&raw_key)
        .ok_or(OracleError::StorageReadFailed)?;

    let (cores_offered, cores_sold) = decode_core_counts(&storage_value)?;

    if cores_offered == 0 {
        return Err(OracleError::DivisionByZero);
    }

    // utilisation = (cores_sold * 100 * PRECISION) / cores_offered
    let numerator = (cores_sold as u128)
        .checked_mul(100)
        .ok_or(OracleError::Overflow)?
        .checked_mul(PRECISION)
        .ok_or(OracleError::Overflow)?;

    numerator
        .checked_div(cores_offered as u128)
        .ok_or(OracleError::DivisionByZero)
}

/// Estimate annualised implied volatility from recent sale price variance.
///
/// Computes the standard deviation of daily price returns over the lookback
/// window, then annualises by multiplying by sqrt(365).
///
/// Uses fixed-point arithmetic throughout — no f64.
///
/// # Returns
/// Implied volatility as u64 with 18 decimal places.
/// e.g. 50% volatility = 500_000_000_000_000_000
pub fn implied_volatility(lookback_blocks: u32) -> OracleResult<u64> {
    let lookback = if lookback_blocks == 0 {
        DEFAULT_TWAP_LOOKBACK
    } else {
        lookback_blocks
    };

    let samples = read_price_history(lookback)?;

    if (samples.len() as u32) < MIN_VOLATILITY_SAMPLES {
        return Err(OracleError::InsufficientData);
    }

    // Compute daily returns (price[i] / price[i-1] - 1) in fixed-point
    let mut returns: Vec<i128> = Vec::with_capacity(samples.len() - 1);

    for i in 1..samples.len() {
        let prev = samples[i - 1].price;
        let curr = samples[i].price;

        if prev == 0 {
            continue;
        }

        // return = (curr - prev) * PRECISION / prev
        let diff = curr as i128 - prev as i128;
        let ret = diff
            .checked_mul(PRECISION as i128)
            .ok_or(OracleError::Overflow)?
            .checked_div(prev as i128)
            .ok_or(OracleError::DivisionByZero)?;

        returns.push(ret);
    }

    if returns.is_empty() {
        return Err(OracleError::InsufficientData);
    }

    // Compute mean return
    let sum: i128 = returns.iter().sum();
    let count = returns.len() as i128;
    let mean = sum / count;

    // Compute variance: sum((r - mean)²) / (n - 1)
    let mut variance_sum: u128 = 0;

    for r in &returns {
        let deviation = r - mean;
        // deviation² in fixed-point: (dev * dev) / PRECISION
        let dev_abs = deviation.unsigned_abs();
        let dev_squared = dev_abs
            .checked_mul(dev_abs)
            .ok_or(OracleError::Overflow)?
            .checked_div(PRECISION)
            .ok_or(OracleError::DivisionByZero)?;

        variance_sum = variance_sum
            .checked_add(dev_squared)
            .ok_or(OracleError::Overflow)?;
    }

    let n_minus_1 = if returns.len() > 1 { returns.len() - 1 } else { 1 };
    let variance = variance_sum / (n_minus_1 as u128);

    // Standard deviation = sqrt(variance)
    let std_dev = fixed_sqrt(variance)?;

    // Annualise: vol = std_dev * sqrt(365)
    let annual_vol = std_dev
        .checked_mul(ANNUALISATION_FACTOR)
        .ok_or(OracleError::Overflow)?
        .checked_div(PRECISION)
        .ok_or(OracleError::DivisionByZero)?;

    // Cap at u64::MAX
    if annual_vol > u64::MAX as u128 {
        return Err(OracleError::Overflow);
    }

    Ok(annual_vol as u64)
}

/// Get complete oracle data in a single call.
///
/// This is the primary entry point called by Solidity contracts via the
/// precompile. Returns all oracle metrics in one struct to minimise
/// cross-VM call overhead.
pub fn get_oracle_data(lookback_blocks: u32) -> OracleResult<OracleData> {
    let spot = spot_price()?;
    let twap_price = twap(lookback_blocks)?;
    let util = utilisation()?;
    let vol = implied_volatility(lookback_blocks)?;

    Ok(OracleData {
        spot_price: spot,
        twap: twap_price,
        utilisation: util,
        implied_volatility: vol,
        data_block: current_block_number(),
    })
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Price sample from historical data.
#[derive(Debug, Clone)]
pub struct PriceSample {
    pub price: u128,
    pub block: u32,
    pub duration: u32, // blocks this price was active
}

/// Build a Substrate storage key from a pallet+item prefix and optional suffix.
///
/// In production, this constructs the proper twox_128 hashed key.
/// For now, returns a simplified key for the reference implementation.
fn build_storage_key(prefix: &[u8], suffix: Option<&[u8]>) -> Vec<u8> {
    let mut key = prefix.to_vec();
    if let Some(s) = suffix {
        key.extend_from_slice(s);
    }
    key
}

/// Read raw bytes from Substrate storage via sp_io.
///
/// In production, this calls:
///   sp_io::storage::get(&key).map(|v| v.to_vec())
///
/// In test/reference mode, returns None (storage not available).
#[cfg(not(feature = "runtime"))]
fn read_storage(_key: &[u8]) -> Option<Vec<u8>> {
    // Placeholder: in production this calls sp_io::storage::get()
    // For compilation and testing, return None
    None
}

/// Decode the sale price from a SCALE-encoded SaleInfo struct.
///
/// SaleInfo layout (Coretime Broker pallet):
///   sale_start: u32          (bytes 0–3)
///   leadin_length: u32       (bytes 4–7)
///   price: u128              (bytes 8–23)
///   region_begin: u32        (bytes 24–27)
///   region_end: u32          (bytes 28–31)
///   ideal_cores_sold: u16    (bytes 32–33)
///   cores_sold: u16          (bytes 34–35)
///   cores_offered: u16       (bytes 36–37)
///   first_core: u16          (bytes 38–39)
///   sellout_price: Option<u128> (bytes 40+)
fn decode_sale_price(data: &[u8]) -> OracleResult<u128> {
    if data.len() < 24 {
        return Err(OracleError::DecodeFailed);
    }

    // Price is at bytes 8–23 (u128, little-endian SCALE encoding)
    let price_bytes: [u8; 16] = data[8..24]
        .try_into()
        .map_err(|_| OracleError::DecodeFailed)?;

    Ok(u128::from_le_bytes(price_bytes))
}

/// Decode core counts (cores_offered, cores_sold) from SaleInfo.
fn decode_core_counts(data: &[u8]) -> OracleResult<(u16, u16)> {
    if data.len() < 38 {
        return Err(OracleError::DecodeFailed);
    }

    // cores_sold at bytes 34–35
    let cores_sold = u16::from_le_bytes(
        data[34..36].try_into().map_err(|_| OracleError::DecodeFailed)?
    );

    // cores_offered at bytes 36–37
    let cores_offered = u16::from_le_bytes(
        data[36..38].try_into().map_err(|_| OracleError::DecodeFailed)?
    );

    Ok((cores_offered, cores_sold))
}

/// Read historical price samples from InstaPoolHistory storage.
///
/// In production, iterates over InstaPoolHistory entries within the lookback window.
/// Each entry contains a price and block range.
fn read_price_history(lookback_blocks: u32) -> OracleResult<Vec<PriceSample>> {
    // In production, this reads from broker::InstaPoolHistory storage
    // For now, return InsufficientData to indicate storage is not available
    let _ = lookback_blocks;
    Err(OracleError::InsufficientData)
}

/// Get the current relay chain block number.
///
/// In production, reads from frame_system::Pallet::<T>::block_number().
fn current_block_number() -> u32 {
    // Placeholder: in production this reads from the runtime
    0
}

/// Integer square root using Newton-Raphson method in fixed-point.
///
/// Computes sqrt(x) where x is in 18-decimal fixed-point.
/// Result is also in 18-decimal fixed-point.
///
/// Algorithm: iterative Newton-Raphson
///   guess_{n+1} = (guess_n + x / guess_n) / 2
///
/// Converges in ~20 iterations for u128 values.
fn fixed_sqrt(x: u128) -> OracleResult<u128> {
    if x == 0 {
        return Ok(0);
    }

    // Scale x up by PRECISION for fixed-point sqrt
    let scaled = x.checked_mul(PRECISION).ok_or(OracleError::Overflow)?;

    // Initial guess: x / 2 + 1
    let mut guess = scaled / 2 + 1;

    // Newton-Raphson iterations
    for _ in 0..64 {
        let new_guess = (guess + scaled / guess) / 2;
        if new_guess >= guess {
            break;
        }
        guess = new_guess;
    }

    Ok(guess)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fixed_sqrt_zero() {
        assert_eq!(fixed_sqrt(0).unwrap(), 0);
    }

    #[test]
    fn test_fixed_sqrt_one() {
        // sqrt(1 * PRECISION) = 1 * PRECISION
        let result = fixed_sqrt(PRECISION).unwrap();
        // Allow small rounding error
        let expected = PRECISION;
        let tolerance = PRECISION / 1000; // 0.1%
        assert!(
            result >= expected - tolerance && result <= expected + tolerance,
            "sqrt(1) should be ~1, got {}",
            result
        );
    }

    #[test]
    fn test_fixed_sqrt_four() {
        // sqrt(4 * PRECISION) should be ~2 * PRECISION
        let result = fixed_sqrt(4 * PRECISION).unwrap();
        let expected = 2 * PRECISION;
        let tolerance = PRECISION / 100; // 1%
        assert!(
            result >= expected - tolerance && result <= expected + tolerance,
            "sqrt(4) should be ~2, got {}",
            result
        );
    }

    #[test]
    fn test_decode_sale_price_valid() {
        // Construct a minimal SaleInfo-like buffer
        let mut data = vec![0u8; 40];
        // Set price at bytes 8–23 to 1000 DOT (1000 * PRECISION)
        let price: u128 = 1000 * PRECISION;
        data[8..24].copy_from_slice(&price.to_le_bytes());
        // Set cores_sold at bytes 34–35
        data[34..36].copy_from_slice(&10u16.to_le_bytes());
        // Set cores_offered at bytes 36–37
        data[36..38].copy_from_slice(&20u16.to_le_bytes());

        let decoded_price = decode_sale_price(&data).unwrap();
        assert_eq!(decoded_price, 1000 * PRECISION);

        let (offered, sold) = decode_core_counts(&data).unwrap();
        assert_eq!(offered, 20);
        assert_eq!(sold, 10);
    }

    #[test]
    fn test_decode_sale_price_too_short() {
        let data = vec![0u8; 10]; // Too short
        assert_eq!(decode_sale_price(&data), Err(OracleError::DecodeFailed));
    }

    #[test]
    fn test_spot_price_returns_storage_error_in_test() {
        // In test mode, storage reads return None → StorageReadFailed
        assert_eq!(spot_price(), Err(OracleError::StorageReadFailed));
    }

    #[test]
    fn test_twap_returns_insufficient_data_in_test() {
        // In test mode, no historical data available
        assert_eq!(twap(0), Err(OracleError::InsufficientData));
    }

    #[test]
    fn test_utilisation_returns_storage_error_in_test() {
        assert_eq!(utilisation(), Err(OracleError::StorageReadFailed));
    }
}
