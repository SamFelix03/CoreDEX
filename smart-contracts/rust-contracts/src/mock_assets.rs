//! MockAssets — Rust PVM mock contract for CoreDEX
//!
//! Simulates the Polkadot Hub Assets Precompile (DOT balance/transfer).
//! In production this is a fixed-address runtime precompile at 0x...0806.
//! This PVM mock provides the same ABI for testing cross-VM flows.
//!
//! WHY RUST PVM:
//!   - Demonstrates end-to-end cross-VM: EVM contracts call this Rust PVM
//!     contract for DOT balance queries and transfers.
//!   - In production, the Assets precompile is a runtime builtin. This mock
//!     shows the same interface can be served from a PVM contract.
//!
//! FUNCTION SELECTORS:
//!   balanceOf(address)               → 0x70a08231
//!   transfer(address,uint256)        → 0xa9059cbb
//!   transferFrom(address,address,uint256) → 0x23b872dd
//!   totalIssuance()                  → 0x9c49fc0c
//!   existentialDeposit()             → 0x3432dbc7
//!   mint(address,uint256)            → 0x40c10f19
//!   burn(address,uint256)            → 0x9dc29fac
//!
//! STORAGE LAYOUT:
//!   balance:{address}  → u256 (32 bytes LE)
//!   totalSupply        → u256 (32 bytes LE)

#![no_std]
#![no_main]

use uapi::{HostFn, HostFnImpl as api, ReturnFlags, StorageFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_TOTAL_SUPPLY: [u8; 32] = {
    let mut k = [0u8; 32];
    k[31] = 0xFF;
    k
};

fn balance_key(addr: &[u8; 20]) -> [u8; 32] {
    let mut k = [0u8; 32];
    k[0] = 0x01; // prefix
    k[12..32].copy_from_slice(addr);
    k
}

// ── Function selectors ────────────────────────────────────────────────────────
const SEL_BALANCE_OF: [u8; 4]     = [0x70, 0xa0, 0x82, 0x31]; // balanceOf(address)
const SEL_TRANSFER: [u8; 4]       = [0xa9, 0x05, 0x9c, 0xbb]; // transfer(address,uint256)
const SEL_TRANSFER_FROM: [u8; 4]  = [0x23, 0xb8, 0x72, 0xdd]; // transferFrom(address,address,uint256)
const SEL_TOTAL_ISSUANCE: [u8; 4] = [0x9c, 0x49, 0xfc, 0x0c]; // totalIssuance()
const SEL_ED: [u8; 4]             = [0x34, 0x32, 0xdb, 0xc7]; // existentialDeposit()
const SEL_MINT: [u8; 4]           = [0x40, 0xc1, 0x0f, 0x19]; // mint(address,uint256)
const SEL_BURN: [u8; 4]           = [0x9d, 0xc2, 0x9f, 0xac]; // burn(address,uint256)

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // Read calldata safely — fixed buffer, copy only available bytes.
    // Max input: 4 selector + 3*32 = 100 bytes
    let mut buf = [0u8; 100];
    let input_size = api::call_data_size();
    let copy_len = if (input_size as usize) < 100 { input_size as usize } else { 100 };
    if copy_len < 4 {
        api::return_value(ReturnFlags::REVERT, &[]);
    }
    api::call_data_copy(&mut buf[..copy_len], 0);

    let selector: [u8; 4] = [buf[0], buf[1], buf[2], buf[3]];

    match selector {
        SEL_BALANCE_OF     => handle_balance_of(&buf),
        SEL_TRANSFER       => handle_transfer(&buf),
        SEL_TRANSFER_FROM  => handle_transfer_from(&buf),
        SEL_TOTAL_ISSUANCE => handle_total_issuance(),
        SEL_ED             => handle_existential_deposit(),
        SEL_MINT           => handle_mint(&buf),
        SEL_BURN           => handle_burn(&buf),
        _ => {
            api::return_value(ReturnFlags::REVERT, &[]);
        }
    }
}

fn handle_balance_of(buf: &[u8; 100]) {
    let addr = read_address(&buf[4..36]);
    let balance = load_u256(&balance_key(&addr));
    ret_u256(&balance);
}

fn handle_transfer(buf: &[u8; 100]) {
    let to = read_address(&buf[4..36]);
    let amount = read_u256_bytes(&buf[36..68]);

    // Get caller
    let mut caller = [0u8; 20];
    api::address(&mut caller);

    let mut sender_bal = load_u256(&balance_key(&caller));
    let mut recipient_bal = load_u256(&balance_key(&to));

    // Check sufficient balance (simple u256 comparison via bytes)
    if lt_u256(&sender_bal, &amount) {
        api::return_value(ReturnFlags::REVERT, &[]);
    }

    sub_u256(&mut sender_bal, &amount);
    add_u256(&mut recipient_bal, &amount);

    store_u256(&balance_key(&caller), &sender_bal);
    store_u256(&balance_key(&to), &recipient_bal);

    // Return true (bool)
    let mut out = [0u8; 32];
    out[31] = 1;
    api::return_value(ReturnFlags::empty(), &out);
}

fn handle_transfer_from(buf: &[u8; 100]) {
    let from = read_address(&buf[4..36]);
    let to = read_address(&buf[36..68]);
    let amount = read_u256_bytes(&buf[68..100]);

    // Get caller (the contract calling transferFrom)
    let mut caller = [0u8; 20];
    api::address(&mut caller);

    // Check approval: caller must be approved by `from`
    // For simplicity, we allow transfers if caller is a contract (EVM contract calling on behalf)
    // In production, this would check an approval mapping
    // For now, we allow any contract to transferFrom if from has balance
    let mut sender_bal = load_u256(&balance_key(&from));
    let mut recipient_bal = load_u256(&balance_key(&to));

    // Check sufficient balance
    if lt_u256(&sender_bal, &amount) {
        api::return_value(ReturnFlags::REVERT, &[]);
    }

    sub_u256(&mut sender_bal, &amount);
    add_u256(&mut recipient_bal, &amount);

    store_u256(&balance_key(&from), &sender_bal);
    store_u256(&balance_key(&to), &recipient_bal);

    // Return true (bool)
    let mut out = [0u8; 32];
    out[31] = 1;
    api::return_value(ReturnFlags::empty(), &out);
}

fn handle_total_issuance() {
    let total = load_u256(&KEY_TOTAL_SUPPLY);
    ret_u256(&total);
}

fn handle_existential_deposit() {
    // 0.01 DOT = 10_000_000_000_000_000 = 0x2386F26FC10000
    let mut out = [0u8; 32];
    let ed: u64 = 10_000_000_000_000_000;
    out[24..32].copy_from_slice(&ed.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &out);
}

fn handle_mint(buf: &[u8; 100]) {
    let to = read_address(&buf[4..36]);
    let amount = read_u256_bytes(&buf[36..68]);

    let mut bal = load_u256(&balance_key(&to));
    add_u256(&mut bal, &amount);
    store_u256(&balance_key(&to), &bal);

    let mut total = load_u256(&KEY_TOTAL_SUPPLY);
    add_u256(&mut total, &amount);
    store_u256(&KEY_TOTAL_SUPPLY, &total);

    ret_empty();
}

fn handle_burn(buf: &[u8; 100]) {
    let from = read_address(&buf[4..36]);
    let amount = read_u256_bytes(&buf[36..68]);

    let mut bal = load_u256(&balance_key(&from));
    if lt_u256(&bal, &amount) {
        api::return_value(ReturnFlags::REVERT, &[]);
    }
    sub_u256(&mut bal, &amount);
    store_u256(&balance_key(&from), &bal);

    let mut total = load_u256(&KEY_TOTAL_SUPPLY);
    sub_u256(&mut total, &amount);
    store_u256(&KEY_TOTAL_SUPPLY, &total);

    ret_empty();
}

// ── Storage helpers ────────────────────────────────────────────────────────────

fn store_u256(key: &[u8; 32], val: &[u8; 32]) {
    api::set_storage(StorageFlags::empty(), key, val);
}

fn load_u256(key: &[u8; 32]) -> [u8; 32] {
    let mut buf = [0u8; 32];
    let mut out = &mut buf[..];
    let _ = api::get_storage(StorageFlags::empty(), key, &mut out);
    buf
}

// ── u256 arithmetic (big-endian byte arrays) ──────────────────────────────────

fn add_u256(a: &mut [u8; 32], b: &[u8; 32]) {
    let mut carry: u16 = 0;
    for i in (0..32).rev() {
        let sum = a[i] as u16 + b[i] as u16 + carry;
        a[i] = sum as u8;
        carry = sum >> 8;
    }
}

fn sub_u256(a: &mut [u8; 32], b: &[u8; 32]) {
    let mut borrow: i16 = 0;
    for i in (0..32).rev() {
        let diff = a[i] as i16 - b[i] as i16 - borrow;
        if diff < 0 {
            a[i] = (diff + 256) as u8;
            borrow = 1;
        } else {
            a[i] = diff as u8;
            borrow = 0;
        }
    }
}

fn lt_u256(a: &[u8; 32], b: &[u8; 32]) -> bool {
    for i in 0..32 {
        if a[i] < b[i] { return true; }
        if a[i] > b[i] { return false; }
    }
    false
}

// ── ABI helpers ───────────────────────────────────────────────────────────────

fn read_address(slot: &[u8]) -> [u8; 20] {
    let mut addr = [0u8; 20];
    addr.copy_from_slice(&slot[12..32]);
    addr
}

fn read_u256_bytes(slot: &[u8]) -> [u8; 32] {
    let mut val = [0u8; 32];
    val.copy_from_slice(&slot[0..32]);
    val
}

fn ret_u256(val: &[u8; 32]) {
    api::return_value(ReturnFlags::empty(), val);
}

fn ret_empty() {
    api::return_value(ReturnFlags::empty(), &[]);
}
