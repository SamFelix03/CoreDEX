//! CoretimeOracle — Rust PVM mock contract for CoreDEX
//!
//! This contract simulates a Coretime Oracle that would, in production, read
//! the Coretime Broker pallet's on-chain storage to provide real-time pricing
//! data. As a PVM contract it demonstrates the cross-VM architecture:
//! Solidity EVM contracts (ForwardMarket, OptionsEngine) call this Rust PVM
//! contract transparently via pallet-revive's cross-VM dispatch.
//!
//! WHY RUST PVM instead of Solidity:
//!   - In production, the oracle needs to read Substrate runtime storage
//!     (Broker pallet state), which is only accessible from PVM, not EVM.
//!   - Fixed-point arithmetic for price calculations is more efficient in
//!     Rust's tight RISC-V loops than in EVM opcodes.
//!   - The same contract binary can be upgraded to read real pallet storage
//!     when deployed on a chain with the Broker pallet available.
//!
//! FUNCTION SELECTORS (keccak256 of Solidity-compatible signatures):
//!   spotPrice()                  → 0x398482d8
//!   impliedVolatility()          → 0xd014d77b
//!   lastSalePrice()              → 0x86f5960f
//!   renewalPrice()               → 0x7b55297a
//!   saleRegion()                 → 0x49e825b9
//!   coreAvailability()           → 0xedcb8495
//!   setSpotPrice(uint128)        → 0xf13645c3
//!   setImpliedVolatility(uint64) → 0xe7c89d51
//!   initialize()                 → 0x8129fc1c
//!
//! STORAGE LAYOUT (contract-local storage via pallet-revive host fns):
//!   Key 0x01: spotPrice       (u128, 16 bytes LE)
//!   Key 0x02: impliedVol      (u64,  8 bytes LE)
//!   Key 0x03: lastSalePrice   (u128, 16 bytes LE)
//!   Key 0x04: renewalPrice    (u128, 16 bytes LE)
//!   Key 0x05: saleRegionBegin (u32,  4 bytes LE)
//!   Key 0x06: saleRegionEnd   (u32,  4 bytes LE)
//!   Key 0x07: totalCores      (u16,  2 bytes LE)
//!   Key 0x08: coresSold       (u16,  2 bytes LE)

#![no_std]
#![no_main]

use uapi::{HostFn, HostFnImpl as api, ReturnFlags, StorageFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_SPOT_PRICE: [u8; 32]    = key(0x01);
const KEY_IMPLIED_VOL: [u8; 32]   = key(0x02);
const KEY_LAST_SALE: [u8; 32]     = key(0x03);
const KEY_RENEWAL: [u8; 32]       = key(0x04);
const KEY_SALE_BEGIN: [u8; 32]    = key(0x05);
const KEY_SALE_END: [u8; 32]     = key(0x06);
const KEY_TOTAL_CORES: [u8; 32]  = key(0x07);
const KEY_CORES_SOLD: [u8; 32]   = key(0x08);

const fn key(id: u8) -> [u8; 32] {
    let mut k = [0u8; 32];
    k[31] = id;
    k
}

// ── Function selectors ────────────────────────────────────────────────────────
// Computed from keccak256 of the Solidity-compatible function signature.
const SEL_SPOT_PRICE: [u8; 4]       = [0x39, 0x84, 0x82, 0xd8]; // spotPrice()
const SEL_IMPLIED_VOL: [u8; 4]      = [0xd0, 0x14, 0xd7, 0x7b]; // impliedVolatility()
const SEL_LAST_SALE: [u8; 4]        = [0x86, 0xf5, 0x96, 0x0f]; // lastSalePrice()
const SEL_RENEWAL: [u8; 4]          = [0x7b, 0x55, 0x29, 0x7a]; // renewalPrice()
const SEL_SALE_REGION: [u8; 4]      = [0x49, 0xe8, 0x25, 0xb9]; // saleRegion()
const SEL_CORE_AVAIL: [u8; 4]       = [0xed, 0xcb, 0x84, 0x95]; // coreAvailability()
const SEL_SET_SPOT: [u8; 4]         = [0xf1, 0x36, 0x45, 0xc3]; // setSpotPrice(uint128)
const SEL_SET_VOL: [u8; 4]          = [0xe7, 0xc8, 0x9d, 0x51]; // setImpliedVolatility(uint64)
const SEL_INITIALIZE: [u8; 4]       = [0x81, 0x29, 0xfc, 0x1c]; // initialize()

// ── Default values ───────────────────────────────────────────────────────────
const DEFAULT_SPOT: u128 = 5_000_000_000_000_000_000;       // 5 DOT
const DEFAULT_VOL: u64 = 5000;                               // 50.00%
const DEFAULT_LAST_SALE: u128 = 4_800_000_000_000_000_000;   // 4.8 DOT
const DEFAULT_RENEWAL: u128 = 4_500_000_000_000_000_000;     // 4.5 DOT
const DEFAULT_SALE_BEGIN: u32 = 100_000;
const DEFAULT_SALE_END: u32 = 200_000;
const DEFAULT_TOTAL_CORES: u16 = 50;
const DEFAULT_CORES_SOLD: u16 = 12;

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // Read calldata into a fixed buffer. The input! macro panics when
    // actual calldata is shorter than the declared buffer, so we use
    // call_data_copy directly with a generous buffer.
    let mut buf = [0u8; 36]; // 4 selector + up to 32 bytes arg
    let input_size = api::call_data_size();
    let copy_len = if (input_size as usize) < 36 { input_size as usize } else { 36 };
    if copy_len < 4 {
        api::return_value(ReturnFlags::REVERT, &[]);
    }
    api::call_data_copy(&mut buf[..copy_len], 0);

    let selector: [u8; 4] = [buf[0], buf[1], buf[2], buf[3]];

    match selector {
        SEL_SPOT_PRICE  => ret_u128(load_u128_or(&KEY_SPOT_PRICE, DEFAULT_SPOT)),
        SEL_IMPLIED_VOL => ret_u64(load_u64_or(&KEY_IMPLIED_VOL, DEFAULT_VOL)),
        SEL_LAST_SALE   => ret_u128(load_u128_or(&KEY_LAST_SALE, DEFAULT_LAST_SALE)),
        SEL_RENEWAL     => ret_u128(load_u128_or(&KEY_RENEWAL, DEFAULT_RENEWAL)),
        SEL_SALE_REGION => ret_two_u32(load_u32_or(&KEY_SALE_BEGIN, DEFAULT_SALE_BEGIN), load_u32_or(&KEY_SALE_END, DEFAULT_SALE_END)),
        SEL_CORE_AVAIL  => ret_two_u16(load_u16_or(&KEY_TOTAL_CORES, DEFAULT_TOTAL_CORES), load_u16_or(&KEY_CORES_SOLD, DEFAULT_CORES_SOLD)),
        SEL_SET_SPOT    => {
            let val = u128::from_be_bytes(buf[20..36].try_into().unwrap());
            store_u128(&KEY_SPOT_PRICE, val);
            ret_empty();
        }
        SEL_SET_VOL     => {
            let val = u64::from_be_bytes(buf[28..36].try_into().unwrap());
            store_u64(&KEY_IMPLIED_VOL, val);
            ret_empty();
        }
        SEL_INITIALIZE  => {
            store_u128(&KEY_SPOT_PRICE, DEFAULT_SPOT);
            store_u64(&KEY_IMPLIED_VOL, DEFAULT_VOL);
            store_u128(&KEY_LAST_SALE, DEFAULT_LAST_SALE);
            store_u128(&KEY_RENEWAL, DEFAULT_RENEWAL);
            store_u32(&KEY_SALE_BEGIN, DEFAULT_SALE_BEGIN);
            store_u32(&KEY_SALE_END, DEFAULT_SALE_END);
            store_u16(&KEY_TOTAL_CORES, DEFAULT_TOTAL_CORES);
            store_u16(&KEY_CORES_SOLD, DEFAULT_CORES_SOLD);
            ret_empty();
        }
        _ => {
            api::return_value(ReturnFlags::REVERT, &[]);
        }
    }
}

// ── Storage helpers ────────────────────────────────────────────────────────────

fn store_u128(key: &[u8; 32], val: u128) {
    api::set_storage(StorageFlags::empty(), key, &val.to_le_bytes());
}

fn store_u64(key: &[u8; 32], val: u64) {
    api::set_storage(StorageFlags::empty(), key, &val.to_le_bytes());
}

fn store_u32(key: &[u8; 32], val: u32) {
    api::set_storage(StorageFlags::empty(), key, &val.to_le_bytes());
}

fn store_u16(key: &[u8; 32], val: u16) {
    api::set_storage(StorageFlags::empty(), key, &val.to_le_bytes());
}

fn load_u128_or(key: &[u8; 32], default: u128) -> u128 {
    let mut buf = [0u8; 16];
    let mut out = &mut buf[..];
    if api::get_storage(StorageFlags::empty(), key, &mut out).is_err() {
        return default;
    }
    u128::from_le_bytes(buf)
}

fn load_u64_or(key: &[u8; 32], default: u64) -> u64 {
    let mut buf = [0u8; 8];
    let mut out = &mut buf[..];
    if api::get_storage(StorageFlags::empty(), key, &mut out).is_err() {
        return default;
    }
    u64::from_le_bytes(buf)
}

fn load_u32_or(key: &[u8; 32], default: u32) -> u32 {
    let mut buf = [0u8; 4];
    let mut out = &mut buf[..];
    if api::get_storage(StorageFlags::empty(), key, &mut out).is_err() {
        return default;
    }
    u32::from_le_bytes(buf)
}

fn load_u16_or(key: &[u8; 32], default: u16) -> u16 {
    let mut buf = [0u8; 2];
    let mut out = &mut buf[..];
    if api::get_storage(StorageFlags::empty(), key, &mut out).is_err() {
        return default;
    }
    u16::from_le_bytes(buf)
}

// ── ABI return helpers ─────────────────────────────────────────────────────────

fn ret_u128(val: u128) {
    let mut out = [0u8; 32];
    out[16..32].copy_from_slice(&val.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &out);
}

fn ret_u64(val: u64) {
    let mut out = [0u8; 32];
    out[24..32].copy_from_slice(&val.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &out);
}

fn ret_two_u32(a: u32, b: u32) {
    let mut out = [0u8; 64];
    out[28..32].copy_from_slice(&a.to_be_bytes());
    out[60..64].copy_from_slice(&b.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &out);
}

fn ret_two_u16(a: u16, b: u16) {
    let mut out = [0u8; 64];
    out[30..32].copy_from_slice(&a.to_be_bytes());
    out[62..64].copy_from_slice(&b.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &out);
}

fn ret_empty() {
    api::return_value(ReturnFlags::empty(), &[]);
}
