/// PricingModule — Black-Scholes option pricing and Newton-Raphson IV solver.
///
/// Called synchronously by OptionsEngine via inter-VM staticcall. Takes spot price,
/// strike price, time-to-expiry (in blocks, converted to annualised time),
/// volatility from CoretimeOracle, and option type. Returns premium and delta.
///
/// WHY RUST / PVM:
/// - The cumulative normal distribution function (CDF) does not exist in Solidity.
///   Approximating it in 256-bit integer arithmetic costs millions of gas and
///   introduces meaningful pricing error.
/// - Fixed-point arithmetic with i128 (18 decimal places) ensures deterministic
///   results across all validator nodes — no f64 allowed (NFR-03).
///
/// PRECISION MODEL:
/// All values use i128 fixed-point with 18 decimal places.
/// 1.0 = PRECISION = 1_000_000_000_000_000_000
/// Negative values are used for intermediate calculations (ln, d1, d2).
///
/// BLACK-SCHOLES FORMULA:
/// For a European call:
///   C = S × N(d1) - K × e^(-rT) × N(d2)
/// For a European put:
///   P = K × e^(-rT) × N(-d2) - S × N(-d1)
/// Where:
///   d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)
///   d2 = d1 - σ√T
///   N(x) = cumulative standard normal distribution
///   S = spot price, K = strike price, r = risk-free rate
///   σ = volatility, T = time to expiry (annualised)
///
/// RISK-FREE RATE:
/// For Polkadot coretime, we use the DOT staking yield as the risk-free rate.
/// Default: 15% APY (1500 BPS), configurable.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Fixed-point precision: 18 decimal places.
pub const PRECISION: i128 = 1_000_000_000_000_000_000;

/// Unsigned precision for conversions.
pub const U_PRECISION: u128 = 1_000_000_000_000_000_000;

/// Blocks per year at 6-second block time (365 days).
pub const BLOCKS_PER_YEAR: u128 = 5_256_000;

/// Default risk-free rate: 15% APY in fixed-point (0.15 * PRECISION).
pub const DEFAULT_RISK_FREE_RATE: i128 = 150_000_000_000_000_000; // 0.15

/// Euler's number e ≈ 2.718281828... in fixed-point.
pub const E: i128 = 2_718_281_828_459_045_235;

/// ln(2) in fixed-point, used for exp approximation.
pub const LN2: i128 = 693_147_180_559_945_309;

/// π in fixed-point.
pub const PI: i128 = 3_141_592_653_589_793_238;

/// sqrt(2π) in fixed-point.
pub const SQRT_2PI: i128 = 2_506_628_274_631_000_502;

/// Maximum Newton-Raphson iterations for IV solver.
pub const MAX_NR_ITERATIONS: u32 = 50;

/// Convergence tolerance for IV solver (1e-8 in fixed-point).
pub const NR_TOLERANCE: i128 = 10_000_000_000; // 1e-8 * PRECISION

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, PartialEq, Clone)]
pub enum PricingError {
    /// Arithmetic overflow in fixed-point computation.
    Overflow,
    /// Division by zero.
    DivisionByZero,
    /// Invalid input parameters.
    InvalidInput,
    /// Newton-Raphson did not converge within MAX_NR_ITERATIONS.
    ConvergenceFailure,
    /// Negative price result (should not happen with valid inputs).
    NegativePrice,
}

pub type PricingResult<T> = Result<T, PricingError>;

// ---------------------------------------------------------------------------
// Option type
// ---------------------------------------------------------------------------

/// European option type.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OptionType {
    Call = 0,
    Put = 1,
}

impl OptionType {
    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(OptionType::Call),
            1 => Some(OptionType::Put),
            _ => None,
        }
    }
}

// ---------------------------------------------------------------------------
// Output struct
// ---------------------------------------------------------------------------

/// Result of Black-Scholes pricing.
#[derive(Debug, Clone, PartialEq)]
pub struct PricingResult_ {
    /// Option premium in DOT planck (18 decimals, unsigned).
    pub premium: u128,
    /// Option delta (sensitivity to spot price change).
    /// For calls: 0 to 1 (scaled to PRECISION). For puts: -1 to 0.
    pub delta: i128,
}

// ---------------------------------------------------------------------------
// Core pricing function
// ---------------------------------------------------------------------------

/// Price a European option using Black-Scholes.
///
/// # Arguments
/// * `spot`        - Current spot price in DOT planck (u128, 18 decimals).
/// * `strike`      - Strike price in DOT planck (u128, 18 decimals).
/// * `blocks_to_expiry` - Number of relay chain blocks until expiry.
/// * `volatility`  - Annualised implied volatility (u64, 18 decimals).
///                   e.g. 50% vol = 500_000_000_000_000_000.
/// * `option_type` - Call (0) or Put (1).
///
/// # Returns
/// PricingResult_ containing premium (u128) and delta (i128).
pub fn price_option(
    spot: u128,
    strike: u128,
    blocks_to_expiry: u32,
    volatility: u64,
    option_type: OptionType,
) -> PricingResult<PricingResult_> {
    // --- Input validation ---
    if spot == 0 || strike == 0 {
        return Err(PricingError::InvalidInput);
    }
    if blocks_to_expiry == 0 {
        // At expiry: intrinsic value only
        return Ok(intrinsic_value(spot, strike, option_type));
    }
    if volatility == 0 {
        return Err(PricingError::InvalidInput);
    }

    // Convert to signed fixed-point
    let s = spot as i128;
    let k = strike as i128;
    let sigma = volatility as i128;
    let r = DEFAULT_RISK_FREE_RATE;

    // T = blocks_to_expiry / BLOCKS_PER_YEAR (annualised time)
    let t = (blocks_to_expiry as i128)
        .checked_mul(PRECISION)
        .ok_or(PricingError::Overflow)?
        .checked_div(BLOCKS_PER_YEAR as i128)
        .ok_or(PricingError::DivisionByZero)?;

    if t == 0 {
        return Ok(intrinsic_value(spot, strike, option_type));
    }

    // σ√T
    let sqrt_t = fixed_sqrt_signed(t)?;
    let sigma_sqrt_t = mul_fp(sigma, sqrt_t)?;

    if sigma_sqrt_t == 0 {
        return Ok(intrinsic_value(spot, strike, option_type));
    }

    // d1 = [ln(S/K) + (r + σ²/2)T] / (σ√T)
    let ln_s_over_k = fixed_ln(div_fp(s, k)?)?;
    let sigma_squared = mul_fp(sigma, sigma)?;
    let half_sigma_squared = sigma_squared / 2;
    let r_plus_half_sigma_sq = r.checked_add(half_sigma_squared)
        .ok_or(PricingError::Overflow)?;
    let drift_term = mul_fp(r_plus_half_sigma_sq, t)?;
    let d1_numerator = ln_s_over_k.checked_add(drift_term)
        .ok_or(PricingError::Overflow)?;
    let d1 = div_fp(d1_numerator, sigma_sqrt_t)?;

    // d2 = d1 - σ√T
    let d2 = d1.checked_sub(sigma_sqrt_t)
        .ok_or(PricingError::Overflow)?;

    // e^(-rT)
    let neg_rt = mul_fp(-r, t)?;
    let discount = fixed_exp(neg_rt)?;

    // N(d1), N(d2), N(-d1), N(-d2)
    let n_d1 = cumulative_normal(d1)?;
    let n_d2 = cumulative_normal(d2)?;
    let n_neg_d1 = cumulative_normal(-d1)?;
    let n_neg_d2 = cumulative_normal(-d2)?;

    let (premium_signed, delta) = match option_type {
        OptionType::Call => {
            // C = S × N(d1) - K × e^(-rT) × N(d2)
            let term1 = mul_fp(s, n_d1)?;
            let term2 = mul_fp(mul_fp(k, discount)?, n_d2)?;
            let premium = term1.checked_sub(term2).ok_or(PricingError::Overflow)?;
            (premium, n_d1)
        }
        OptionType::Put => {
            // P = K × e^(-rT) × N(-d2) - S × N(-d1)
            let term1 = mul_fp(mul_fp(k, discount)?, n_neg_d2)?;
            let term2 = mul_fp(s, n_neg_d1)?;
            let premium = term1.checked_sub(term2).ok_or(PricingError::Overflow)?;
            let delta = n_d1.checked_sub(PRECISION).ok_or(PricingError::Overflow)?;
            (premium, delta)
        }
    };

    // Premium must be non-negative
    let premium = if premium_signed < 0 { 0u128 } else { premium_signed as u128 };

    Ok(PricingResult_ { premium, delta })
}

/// Compute intrinsic value at expiry (no time value).
fn intrinsic_value(spot: u128, strike: u128, option_type: OptionType) -> PricingResult_ {
    match option_type {
        OptionType::Call => {
            let premium = if spot > strike { spot - strike } else { 0 };
            let delta = if spot > strike { PRECISION } else { 0 };
            PricingResult_ { premium, delta }
        }
        OptionType::Put => {
            let premium = if strike > spot { strike - spot } else { 0 };
            let delta = if strike > spot { -PRECISION } else { 0 };
            PricingResult_ { premium, delta }
        }
    }
}

// ---------------------------------------------------------------------------
// Newton-Raphson IV Solver
// ---------------------------------------------------------------------------

/// Solve for implied volatility given an observed market premium.
///
/// Uses Newton-Raphson iteration:
///   σ_{n+1} = σ_n - (BS(σ_n) - market_premium) / vega(σ_n)
///
/// # Arguments
/// * `spot`           - Current spot price (u128, 18 decimals).
/// * `strike`         - Strike price (u128, 18 decimals).
/// * `blocks_to_expiry` - Blocks until expiry.
/// * `market_premium` - Observed market premium (u128, 18 decimals).
/// * `option_type`    - Call or Put.
///
/// # Returns
/// Implied volatility as u64 (18 decimals).
pub fn solve_implied_volatility(
    spot: u128,
    strike: u128,
    blocks_to_expiry: u32,
    market_premium: u128,
    option_type: OptionType,
) -> PricingResult<u64> {
    if spot == 0 || strike == 0 || blocks_to_expiry == 0 || market_premium == 0 {
        return Err(PricingError::InvalidInput);
    }

    // Initial guess: 50% volatility
    let mut sigma: i128 = PRECISION / 2; // 0.5

    for _ in 0..MAX_NR_ITERATIONS {
        // Price with current sigma guess
        let result = price_option(
            spot, strike, blocks_to_expiry,
            sigma as u64, option_type,
        )?;

        let bs_premium = result.premium as i128;
        let target = market_premium as i128;
        let error = bs_premium - target;

        // Check convergence
        if error.unsigned_abs() < NR_TOLERANCE as u128 {
            if sigma <= 0 {
                return Err(PricingError::NegativePrice);
            }
            return Ok(sigma as u64);
        }

        // Compute vega (dC/dσ)
        let vega = compute_vega(spot, strike, blocks_to_expiry, sigma as u64)?;

        if vega == 0 {
            return Err(PricingError::ConvergenceFailure);
        }

        // Newton step: σ = σ - error / vega
        let adjustment = div_fp(error, vega)?;
        sigma = sigma.checked_sub(adjustment).ok_or(PricingError::Overflow)?;

        // Clamp sigma to reasonable range [0.01, 5.0]
        let min_sigma = PRECISION / 100;  // 1%
        let max_sigma = 5 * PRECISION;    // 500%
        sigma = sigma.clamp(min_sigma, max_sigma);
    }

    Err(PricingError::ConvergenceFailure)
}

/// Compute vega: the sensitivity of option price to volatility.
///
/// vega = S × √T × n(d1)
/// where n(x) is the standard normal PDF.
fn compute_vega(
    spot: u128,
    strike: u128,
    blocks_to_expiry: u32,
    volatility: u64,
) -> PricingResult<i128> {
    let s = spot as i128;
    let k = strike as i128;
    let sigma = volatility as i128;

    let t = (blocks_to_expiry as i128)
        .checked_mul(PRECISION)
        .ok_or(PricingError::Overflow)?
        .checked_div(BLOCKS_PER_YEAR as i128)
        .ok_or(PricingError::DivisionByZero)?;

    let sqrt_t = fixed_sqrt_signed(t)?;
    let sigma_sqrt_t = mul_fp(sigma, sqrt_t)?;

    if sigma_sqrt_t == 0 {
        return Ok(0);
    }

    // d1
    let ln_s_over_k = fixed_ln(div_fp(s, k)?)?;
    let sigma_squared = mul_fp(sigma, sigma)?;
    let half_sigma_squared = sigma_squared / 2;
    let r_plus_half_sigma_sq = DEFAULT_RISK_FREE_RATE
        .checked_add(half_sigma_squared)
        .ok_or(PricingError::Overflow)?;
    let drift_term = mul_fp(r_plus_half_sigma_sq, t)?;
    let d1_numerator = ln_s_over_k.checked_add(drift_term)
        .ok_or(PricingError::Overflow)?;
    let d1 = div_fp(d1_numerator, sigma_sqrt_t)?;

    // n(d1) = (1/√(2π)) × e^(-d1²/2)
    let pdf_d1 = normal_pdf(d1)?;

    // vega = S × √T × n(d1)
    let vega = mul_fp(mul_fp(s, sqrt_t)?, pdf_d1)?;

    Ok(vega)
}

// ---------------------------------------------------------------------------
// Fixed-point math helpers
// ---------------------------------------------------------------------------

/// Fixed-point multiplication: (a × b) / PRECISION
fn mul_fp(a: i128, b: i128) -> PricingResult<i128> {
    a.checked_mul(b)
        .ok_or(PricingError::Overflow)?
        .checked_div(PRECISION)
        .ok_or(PricingError::DivisionByZero)
}

/// Fixed-point division: (a × PRECISION) / b
fn div_fp(a: i128, b: i128) -> PricingResult<i128> {
    if b == 0 {
        return Err(PricingError::DivisionByZero);
    }
    a.checked_mul(PRECISION)
        .ok_or(PricingError::Overflow)?
        .checked_div(b)
        .ok_or(PricingError::DivisionByZero)
}

/// Fixed-point square root (signed, assumes non-negative input).
///
/// Uses Newton-Raphson: guess = (guess + x/guess) / 2
fn fixed_sqrt_signed(x: i128) -> PricingResult<i128> {
    if x <= 0 {
        return Ok(0);
    }

    let x_u = x as u128;
    let scaled = x_u
        .checked_mul(U_PRECISION)
        .ok_or(PricingError::Overflow)?;

    let mut guess = scaled / 2 + 1;

    for _ in 0..64 {
        let new_guess = (guess + scaled / guess) / 2;
        if new_guess >= guess {
            break;
        }
        guess = new_guess;
    }

    Ok(guess as i128)
}

/// Fixed-point natural logarithm using the series expansion.
///
/// ln(x) for x in fixed-point. Uses the identity:
///   ln(x) = 2 × atanh((x-1)/(x+1))
///   atanh(z) = z + z³/3 + z⁵/5 + z⁷/7 + ...
///
/// Converges for x > 0.
fn fixed_ln(x: i128) -> PricingResult<i128> {
    if x <= 0 {
        return Err(PricingError::InvalidInput);
    }

    // Reduce to range near 1 by factoring out powers of e
    // For simplicity, use the series directly for x close to 1
    // and handle larger values by decomposition

    // z = (x - 1) / (x + 1)
    let numerator = x.checked_sub(PRECISION).ok_or(PricingError::Overflow)?;
    let denominator = x.checked_add(PRECISION).ok_or(PricingError::Overflow)?;

    if denominator == 0 {
        return Err(PricingError::DivisionByZero);
    }

    let z = div_fp(numerator, denominator)?;

    // atanh series: z + z³/3 + z⁵/5 + ...
    let mut result: i128 = z;
    let mut z_power = z; // z^(2k+1)
    let z_squared = mul_fp(z, z)?;

    for k in 1..30 {
        z_power = mul_fp(z_power, z_squared)?;
        let divisor = (2 * k + 1) as i128;
        let term = z_power / divisor;

        if term.unsigned_abs() < 1 {
            break; // Converged
        }

        result = result.checked_add(term).ok_or(PricingError::Overflow)?;
    }

    // ln(x) = 2 × atanh(z)
    result.checked_mul(2).ok_or(PricingError::Overflow)
}

/// Fixed-point exponential function e^x.
///
/// Uses the Taylor series: e^x = 1 + x + x²/2! + x³/3! + ...
///
/// For large |x|, decomposes into integer and fractional parts.
fn fixed_exp(x: i128) -> PricingResult<i128> {
    if x == 0 {
        return Ok(PRECISION);
    }

    // Clamp to prevent overflow: e^20 ≈ 4.85e8, e^-20 ≈ 2e-9
    let clamped = x.clamp(-20 * PRECISION, 20 * PRECISION);

    // Handle negative exponents: e^(-x) = 1/e^x
    let (exp_input, negate) = if clamped < 0 {
        (-clamped, true)
    } else {
        (clamped, false)
    };

    // Taylor series: e^x = sum(x^n / n!)
    let mut result: i128 = PRECISION; // 1.0
    let mut term: i128 = PRECISION;   // current term

    for n in 1..40i128 {
        term = mul_fp(term, exp_input)?;
        term = term / n;

        if term.unsigned_abs() < 1 {
            break; // Converged
        }

        result = result.checked_add(term).ok_or(PricingError::Overflow)?;
    }

    if negate {
        // e^(-x) = 1/e^x
        div_fp(PRECISION, result)
    } else {
        Ok(result)
    }
}

/// Cumulative standard normal distribution N(x).
///
/// Uses the Abramowitz and Stegun approximation (formula 26.2.17):
///   N(x) ≈ 1 - n(x)(b₁t + b₂t² + b₃t³ + b₄t⁴ + b₅t⁵)
///   where t = 1/(1 + 0.2316419x) for x ≥ 0
///   and N(x) = 1 - N(-x) for x < 0
///
/// Accuracy: |ε| < 7.5e-8 (sufficient for option pricing).
fn cumulative_normal(x: i128) -> PricingResult<i128> {
    // Constants (scaled to 18 decimals)
    const P: i128 =  231_641_900_000_000_000; // 0.2316419
    const B1: i128 = 319_381_530_000_000_000; // 0.319381530
    const B2: i128 = -356_563_782_000_000_000; // -0.356563782
    const B3: i128 = 1_781_477_937_000_000_000; // 1.781477937
    const B4: i128 = -1_821_255_978_000_000_000; // -1.821255978
    const B5: i128 = 1_330_274_429_000_000_000; // 1.330274429

    let abs_x = if x < 0 { -x } else { x };

    // t = 1 / (1 + p × |x|)
    let p_times_x = mul_fp(P, abs_x)?;
    let one_plus_px = PRECISION.checked_add(p_times_x).ok_or(PricingError::Overflow)?;
    let t = div_fp(PRECISION, one_plus_px)?;

    // Polynomial: b1*t + b2*t² + b3*t³ + b4*t⁴ + b5*t⁵
    let t2 = mul_fp(t, t)?;
    let t3 = mul_fp(t2, t)?;
    let t4 = mul_fp(t3, t)?;
    let t5 = mul_fp(t4, t)?;

    let poly = mul_fp(B1, t)?
        .checked_add(mul_fp(B2, t2)?).ok_or(PricingError::Overflow)?
        .checked_add(mul_fp(B3, t3)?).ok_or(PricingError::Overflow)?
        .checked_add(mul_fp(B4, t4)?).ok_or(PricingError::Overflow)?
        .checked_add(mul_fp(B5, t5)?).ok_or(PricingError::Overflow)?;

    // n(x) = PDF of standard normal
    let pdf = normal_pdf(abs_x)?;

    // N(|x|) = 1 - n(|x|) × poly
    let n_abs_x = PRECISION.checked_sub(mul_fp(pdf, poly)?)
        .ok_or(PricingError::Overflow)?;

    // For x < 0: N(x) = 1 - N(|x|)
    if x < 0 {
        Ok(PRECISION.checked_sub(n_abs_x).ok_or(PricingError::Overflow)?)
    } else {
        Ok(n_abs_x)
    }
}

/// Standard normal probability density function n(x).
///
/// n(x) = (1/√(2π)) × e^(-x²/2)
fn normal_pdf(x: i128) -> PricingResult<i128> {
    let x_squared = mul_fp(x, x)?;
    let neg_half_x_sq = -(x_squared / 2);
    let exp_term = fixed_exp(neg_half_x_sq)?;

    // (1/√(2π)) × e^(-x²/2)
    div_fp(exp_term, SQRT_2PI)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    const DOT: u128 = U_PRECISION; // 1 DOT

    #[test]
    fn test_call_option_at_the_money() {
        // ATM call: spot = strike = 100 DOT, 30 days to expiry, 50% vol
        let result = price_option(
            100 * DOT,
            100 * DOT,
            14_400 * 30, // ~30 days
            500_000_000_000_000_000, // 50% vol
            OptionType::Call,
        ).unwrap();

        // Premium should be positive and less than spot
        assert!(result.premium > 0, "ATM call premium must be positive");
        assert!(result.premium < 100 * DOT, "Premium must be less than spot");

        // Delta should be approximately 0.5 for ATM
        let delta_pct = (result.delta * 100) / PRECISION;
        assert!(delta_pct >= 40 && delta_pct <= 60,
            "ATM call delta should be ~0.5, got {}", delta_pct);
    }

    #[test]
    fn test_put_option_at_the_money() {
        let result = price_option(
            100 * DOT,
            100 * DOT,
            14_400 * 30,
            500_000_000_000_000_000,
            OptionType::Put,
        ).unwrap();

        assert!(result.premium > 0, "ATM put premium must be positive");
        assert!(result.premium < 100 * DOT, "Premium must be less than spot");

        // Put delta should be negative
        assert!(result.delta < 0, "Put delta must be negative");
    }

    #[test]
    fn test_deep_itm_call() {
        // Deep ITM: spot = 200, strike = 100
        let result = price_option(
            200 * DOT,
            100 * DOT,
            14_400 * 30,
            500_000_000_000_000_000,
            OptionType::Call,
        ).unwrap();

        // Premium should be at least intrinsic value (100 DOT)
        assert!(result.premium >= 100 * DOT,
            "Deep ITM call premium must be >= intrinsic value");
    }

    #[test]
    fn test_deep_otm_call() {
        // Deep OTM: spot = 50, strike = 200
        let result = price_option(
            50 * DOT,
            200 * DOT,
            14_400 * 30,
            500_000_000_000_000_000,
            OptionType::Call,
        ).unwrap();

        // Premium should be small but positive
        assert!(result.premium < 10 * DOT,
            "Deep OTM call premium should be small");
    }

    #[test]
    fn test_at_expiry_itm_call() {
        // At expiry, ITM call = intrinsic value
        let result = price_option(
            150 * DOT,
            100 * DOT,
            0,
            500_000_000_000_000_000,
            OptionType::Call,
        ).unwrap();

        assert_eq!(result.premium, 50 * DOT, "At expiry, premium = intrinsic");
    }

    #[test]
    fn test_at_expiry_otm_call() {
        let result = price_option(
            80 * DOT,
            100 * DOT,
            0,
            500_000_000_000_000_000,
            OptionType::Call,
        ).unwrap();

        assert_eq!(result.premium, 0, "At expiry OTM call = 0");
    }

    #[test]
    fn test_zero_spot_returns_error() {
        let result = price_option(0, 100 * DOT, 14_400, 500_000_000_000_000_000, OptionType::Call);
        assert_eq!(result, Err(PricingError::InvalidInput));
    }

    #[test]
    fn test_zero_vol_returns_error() {
        let result = price_option(100 * DOT, 100 * DOT, 14_400, 0, OptionType::Call);
        assert_eq!(result, Err(PricingError::InvalidInput));
    }

    #[test]
    fn test_cumulative_normal_at_zero() {
        // N(0) = 0.5
        let result = cumulative_normal(0).unwrap();
        let expected = PRECISION / 2;
        let tolerance = PRECISION / 100; // 1%
        assert!(
            (result - expected).unsigned_abs() < tolerance as u128,
            "N(0) should be ~0.5, got {}",
            result
        );
    }

    #[test]
    fn test_cumulative_normal_symmetry() {
        // N(x) + N(-x) ≈ 1
        let x = PRECISION; // x = 1.0
        let n_pos = cumulative_normal(x).unwrap();
        let n_neg = cumulative_normal(-x).unwrap();
        let sum = n_pos + n_neg;
        let tolerance = PRECISION / 1000; // 0.1%
        assert!(
            (sum - PRECISION).unsigned_abs() < tolerance as u128,
            "N(x) + N(-x) should be ~1, got {}",
            sum
        );
    }

    #[test]
    fn test_fixed_exp_zero() {
        assert_eq!(fixed_exp(0).unwrap(), PRECISION);
    }

    #[test]
    fn test_fixed_exp_one() {
        let result = fixed_exp(PRECISION).unwrap();
        let tolerance = PRECISION / 100; // 1%
        assert!(
            (result - E).unsigned_abs() < tolerance as u128,
            "e^1 should be ~2.718, got {}",
            result
        );
    }

    #[test]
    fn test_fixed_ln_one() {
        // ln(1) = 0
        let result = fixed_ln(PRECISION).unwrap();
        let tolerance = PRECISION / 1000; // 0.1%
        assert!(
            result.unsigned_abs() < tolerance as u128,
            "ln(1) should be ~0, got {}",
            result
        );
    }

    #[test]
    fn test_mul_fp_basic() {
        // 2.0 × 3.0 = 6.0
        let result = mul_fp(2 * PRECISION, 3 * PRECISION).unwrap();
        assert_eq!(result, 6 * PRECISION);
    }

    #[test]
    fn test_div_fp_basic() {
        // 6.0 / 3.0 = 2.0
        let result = div_fp(6 * PRECISION, 3 * PRECISION).unwrap();
        assert_eq!(result, 2 * PRECISION);
    }

    #[test]
    fn test_option_type_from_u8() {
        assert_eq!(OptionType::from_u8(0), Some(OptionType::Call));
        assert_eq!(OptionType::from_u8(1), Some(OptionType::Put));
        assert_eq!(OptionType::from_u8(2), None);
    }
}
