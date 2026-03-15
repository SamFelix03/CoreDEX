//! PricingModule — Rust PVM mock contract for CoreDEX
//!
//! Implements simplified Black-Scholes option pricing in pure Rust, compiled
//! to RISC-V and deployed as a PVM contract. EVM contracts (OptionsEngine)
//! call this via cross-VM dispatch for option premium calculation.
//!
//! WHY RUST PVM instead of Solidity:
//!   - Fixed-point arithmetic for Black-Scholes is significantly more
//!     efficient in Rust's tight RISC-V loops than EVM's 256-bit opcodes.
//!   - Production version would use higher-precision math (128-bit fixed-point)
//!     that's impractical in Solidity without excessive gas costs.
//!   - The iterative square root and exponential approximations compile to
//!     ~20 RISC-V instructions vs ~200+ EVM opcodes.
//!
//! FUNCTION SELECTORS:
//!   price_option(uint128,uint128,uint32,uint64,uint8) → 0x26ff79f7
//!   solve_iv(uint128,uint128,uint32,uint128,uint8)    → 0x4eb063f3
//!
//! ABI LAYOUT for price_option:
//!   bytes  0..4   : selector
//!   bytes  4..36  : spot       (uint128, right-aligned in 32 bytes)
//!   bytes 36..68  : strike     (uint128, right-aligned in 32 bytes)
//!   bytes 68..100 : timeBlocks (uint32, right-aligned in 32 bytes)
//!   bytes 100..132: volatility (uint64, right-aligned in 32 bytes)
//!   bytes 132..164: optionType (uint8, right-aligned in 32 bytes)
//!
//! Returns: (uint128 premium, uint128 delta) — 64 bytes

#![no_std]
#![no_main]

use uapi::{HostFn, HostFnImpl as api, ReturnFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PRECISION: u128 = 1_000_000_000_000_000_000; // 1e18
const BLOCKS_PER_YEAR: u128 = 5_256_000; // ~6s blocks
const MIN_PREMIUM: u128 = 10_000_000_000_000_000; // 0.01 DOT

// ── Function selectors ────────────────────────────────────────────────────────
const SEL_PRICE_OPTION: [u8; 4] = [0x26, 0xff, 0x79, 0xf7]; // price_option(uint128,uint128,uint32,uint64,uint8)
const SEL_SOLVE_IV: [u8; 4]     = [0x4e, 0xb0, 0x63, 0xf3]; // solve_iv(uint128,uint128,uint32,uint128,uint8)

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // Read calldata safely — allocate max buffer, copy only what's available
    let mut buf = [0u8; 164]; // 4 selector + 5*32 = 164 bytes max
    let input_size = api::call_data_size();
    let copy_len = if (input_size as usize) < 164 { input_size as usize } else { 164 };
    if copy_len < 4 {
        api::return_value(ReturnFlags::REVERT, &[]);
    }
    api::call_data_copy(&mut buf[..copy_len], 0);

    let selector: [u8; 4] = [buf[0], buf[1], buf[2], buf[3]];

    match selector {
        SEL_PRICE_OPTION => handle_price_option(&buf),
        SEL_SOLVE_IV     => handle_solve_iv(&buf),
        _ => {
            api::return_value(ReturnFlags::REVERT, &[]);
        }
    }
}

fn handle_price_option(buf: &[u8; 164]) {
    // Decode ABI-encoded arguments (each right-aligned in 32 bytes)
    let spot       = read_u128(&buf[4..36]);
    let strike     = read_u128(&buf[36..68]);
    let time_blocks = read_u32(&buf[68..100]);
    let volatility = read_u64(&buf[100..132]);
    let option_type = buf[163]; // last byte of 5th arg

    let (premium, delta) = price_option(spot, strike, time_blocks, volatility, option_type);

    // ABI-encode return: (uint128 premium, uint128 delta)
    let mut out = [0u8; 64];
    out[16..32].copy_from_slice(&premium.to_be_bytes());
    out[48..64].copy_from_slice(&delta.to_be_bytes());

    api::return_value(ReturnFlags::empty(), &out);
}

fn handle_solve_iv(buf: &[u8; 164]) {
    let spot          = read_u128(&buf[4..36]);
    let strike        = read_u128(&buf[36..68]);
    let time_blocks   = read_u32(&buf[68..100]);
    let target_premium = read_u128(&buf[100..132]);
    let option_type   = buf[163];

    let iv = solve_implied_volatility(spot, strike, time_blocks, target_premium, option_type);

    // ABI-encode return: uint64
    let mut out = [0u8; 32];
    out[24..32].copy_from_slice(&iv.to_be_bytes());

    api::return_value(ReturnFlags::empty(), &out);
}

// ── Core pricing logic ────────────────────────────────────────────────────────

fn price_option(spot: u128, strike: u128, time_blocks: u32, volatility: u64, option_type: u8) -> (u128, u128) {
    // time in years (scaled to PRECISION)
    let time_years = if time_blocks == 0 {
        1u128
    } else {
        (time_blocks as u128) * PRECISION / BLOCKS_PER_YEAR
    };

    // sqrt(time) via Babylonian method
    let sqrt_time = isqrt(time_years * PRECISION);

    // vol as decimal: volatility / 10000 * PRECISION
    let vol_decimal = (volatility as u128) * PRECISION / 10000;

    // Base premium = spot × vol × sqrt(time) / PRECISION²
    let base_premium = spot
        .checked_mul(vol_decimal).unwrap_or(0)
        / PRECISION
        * sqrt_time
        / PRECISION;

    let (premium, delta) = if option_type == 0 {
        // CALL
        if spot > strike {
            // ITM: intrinsic + time value
            let intrinsic = spot - strike;
            (intrinsic + base_premium, (PRECISION * 7) / 10)
        } else {
            // OTM: discounted time value
            let moneyness = (strike - spot) * PRECISION / spot;
            let discount = if moneyness > PRECISION { 10u128 } else { (PRECISION - moneyness) * 100 / PRECISION };
            (base_premium * discount / 100, (PRECISION * 3) / 10)
        }
    } else {
        // PUT
        if strike > spot {
            let intrinsic = strike - spot;
            (intrinsic + base_premium, (PRECISION * 7) / 10)
        } else {
            let moneyness = (spot - strike) * PRECISION / strike;
            let discount = if moneyness > PRECISION { 10u128 } else { (PRECISION - moneyness) * 100 / PRECISION };
            (base_premium * discount / 100, (PRECISION * 3) / 10)
        }
    };

    // Enforce minimum premium
    let final_premium = if premium < MIN_PREMIUM { MIN_PREMIUM } else { premium };

    (final_premium, delta)
}

fn solve_implied_volatility(
    spot: u128,
    strike: u128,
    time_blocks: u32,
    target_premium: u128,
    option_type: u8,
) -> u64 {
    // Bisection: search vol in [1000, 20000] (10% → 200%)
    let mut low: u64 = 1000;
    let mut high: u64 = 20000;

    for _ in 0..20 {
        let mid = (low + high) / 2;
        let (mid_premium, _) = price_option(spot, strike, time_blocks, mid, option_type);

        if mid_premium < target_premium {
            low = mid;
        } else {
            high = mid;
        }
    }

    (low + high) / 2
}

// ── Math helpers ──────────────────────────────────────────────────────────────

/// Babylonian integer square root
fn isqrt(x: u128) -> u128 {
    if x == 0 { return 0; }
    let mut z = (x + 1) / 2;
    let mut y = x;
    while z < y {
        y = z;
        z = (x / z + z) / 2;
    }
    y
}

// ── ABI decode helpers ────────────────────────────────────────────────────────

fn read_u128(slot: &[u8]) -> u128 {
    // uint128 is right-aligned in 32 bytes — last 16 bytes
    u128::from_be_bytes(slot[16..32].try_into().unwrap())
}

fn read_u64(slot: &[u8]) -> u64 {
    u64::from_be_bytes(slot[24..32].try_into().unwrap())
}

fn read_u32(slot: &[u8]) -> u32 {
    u32::from_be_bytes(slot[28..32].try_into().unwrap())
}
