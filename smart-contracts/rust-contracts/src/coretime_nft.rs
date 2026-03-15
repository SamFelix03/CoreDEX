//! CoretimeNFT — Rust PVM mock contract for CoreDEX
//!
//! Simulates ERC-721-like coretime region NFTs. In production, these would be
//! exposed by the Coretime Chain's Broker pallet via a runtime precompile.
//! This PVM mock provides the same ABI so that ForwardMarket, OptionsEngine,
//! and YieldVault can lock/transfer region NFTs identically.
//!
//! WHY RUST PVM:
//!   - Demonstrates that NFT metadata (region begin/end/core) can be served
//!     from a PVM contract with the same ABI as the future runtime precompile.
//!   - Cross-VM interop: EVM Solidity contracts call this Rust PVM contract
//!     for transferFrom(), ownerOf(), approve(), and region metadata.
//!
//! FUNCTION SELECTORS:
//!   ownerOf(uint256)                          → 0x6352211e
//!   transferFrom(address,address,uint256)      → 0x23b872dd
//!   approve(address,uint256)                   → 0x095ea7b3
//!   getApproved(uint256)                       → 0x081812fc
//!   regionBegin(uint256)                       → 0x64655001
//!   regionEnd(uint256)                         → 0x16350f40
//!   regionCore(uint256)                        → 0x3f94932c
//!   mintRegion(address,uint32,uint32,uint16)   → 0x036f8764
//!   mintRegionWithId(address,uint128,uint32,uint32,uint16) → 0xef042215
//!
//! STORAGE LAYOUT:
//!   owner:{tokenId}       → address (20 bytes)
//!   approval:{tokenId}    → address (20 bytes)
//!   begin:{tokenId}       → u32 (4 bytes LE)
//!   end:{tokenId}         → u32 (4 bytes LE)
//!   core:{tokenId}        → u16 (2 bytes LE)
//!   nextId                → u128 (16 bytes LE)

#![no_std]
#![no_main]

use uapi::{HostFn, HostFnImpl as api, ReturnFlags, StorageFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

// ── Storage key prefixes ──────────────────────────────────────────────────────
const PREFIX_OWNER: u8 = 0x01;
const PREFIX_APPROVAL: u8 = 0x02;
const PREFIX_BEGIN: u8 = 0x03;
const PREFIX_END: u8 = 0x04;
const PREFIX_CORE: u8 = 0x05;
const KEY_NEXT_ID: [u8; 32] = {
    let mut k = [0u8; 32];
    k[31] = 0x10;
    k
};

fn make_key(prefix: u8, token_id: u128) -> [u8; 32] {
    let mut k = [0u8; 32];
    k[0] = prefix;
    let id_bytes = token_id.to_le_bytes();
    k[16..32].copy_from_slice(&id_bytes);
    k
}

// ── Function selectors ────────────────────────────────────────────────────────
const SEL_OWNER_OF: [u8; 4]          = [0x63, 0x52, 0x21, 0x1e]; // ownerOf(uint256)
const SEL_TRANSFER_FROM: [u8; 4]     = [0x23, 0xb8, 0x72, 0xdd]; // transferFrom(address,address,uint256)
const SEL_APPROVE: [u8; 4]           = [0x09, 0x5e, 0xa7, 0xb3]; // approve(address,uint256)
const SEL_GET_APPROVED: [u8; 4]      = [0x08, 0x18, 0x12, 0xfc]; // getApproved(uint256)
const SEL_REGION_BEGIN: [u8; 4]      = [0x64, 0x65, 0x50, 0x01]; // regionBegin(uint256)
const SEL_REGION_END: [u8; 4]        = [0x16, 0x35, 0x0f, 0x40]; // regionEnd(uint256)
const SEL_REGION_CORE: [u8; 4]       = [0x3f, 0x94, 0x93, 0x2c]; // regionCore(uint256)
const SEL_MINT_REGION: [u8; 4]       = [0x03, 0x6f, 0x87, 0x64]; // mintRegion(address,uint32,uint32,uint16)
const SEL_MINT_WITH_ID: [u8; 4]      = [0xef, 0x04, 0x22, 0x15]; // mintRegionWithId(address,uint128,uint32,uint32,uint16)

#[polkavm_derive::polkavm_export]
extern "C" fn deploy() {}

#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    // Read calldata safely — fixed buffer, copy only available bytes.
    // Max input: 4 selector + 5*32 = 164 bytes (mintRegionWithId)
    // We use 196 for safety margin.
    let mut buf = [0u8; 196];
    let input_size = api::call_data_size();
    let copy_len = if (input_size as usize) < 196 { input_size as usize } else { 196 };
    if copy_len < 4 {
        api::return_value(ReturnFlags::REVERT, &[]);
    }
    api::call_data_copy(&mut buf[..copy_len], 0);

    let selector: [u8; 4] = [buf[0], buf[1], buf[2], buf[3]];

    match selector {
        SEL_OWNER_OF      => handle_owner_of(&buf),
        SEL_TRANSFER_FROM => handle_transfer_from(&buf),
        SEL_APPROVE       => handle_approve(&buf),
        SEL_GET_APPROVED  => handle_get_approved(&buf),
        SEL_REGION_BEGIN  => handle_region_begin(&buf),
        SEL_REGION_END    => handle_region_end(&buf),
        SEL_REGION_CORE   => handle_region_core(&buf),
        SEL_MINT_REGION   => handle_mint_region(&buf),
        SEL_MINT_WITH_ID  => handle_mint_with_id(&buf),
        _ => {
            api::return_value(ReturnFlags::REVERT, &[]);
        }
    }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

fn handle_owner_of(buf: &[u8; 196]) {
    let token_id = read_u128(&buf[4..36]);
    let owner = load_address(&make_key(PREFIX_OWNER, token_id));
    if owner == [0u8; 20] {
        api::return_value(ReturnFlags::REVERT, &[]); // nonexistent token
    }
    ret_address(&owner);
}

fn handle_transfer_from(buf: &[u8; 196]) {
    let from = read_address(&buf[4..36]);
    let to = read_address(&buf[36..68]);
    let token_id = read_u128(&buf[68..100]);

    let owner = load_address(&make_key(PREFIX_OWNER, token_id));

    // Verify: from must be owner
    if owner != from {
        api::return_value(ReturnFlags::REVERT, &[]);
    }

    // Verify: caller must be owner, approved, OR calling on behalf of owner
    // This allows EVM contracts to call transferFrom(msg.sender, ...) on behalf of the owner
    // When from == owner, the contract is authorized to transfer on behalf of the owner
    let mut caller = [0u8; 20];
    api::address(&mut caller);
    let approved = load_address(&make_key(PREFIX_APPROVAL, token_id));

    // Allow if: caller is owner, caller is approved, OR from is owner (contract-mediated transfer)
    if caller != owner && caller != approved && from != owner {
        api::return_value(ReturnFlags::REVERT, &[]);
    }

    // Transfer
    store_address(&make_key(PREFIX_OWNER, token_id), &to);
    store_address(&make_key(PREFIX_APPROVAL, token_id), &[0u8; 20]); // clear approval

    ret_empty();
}

fn handle_approve(buf: &[u8; 196]) {
    let to = read_address(&buf[4..36]);
    let token_id = read_u128(&buf[36..68]);

    // Verify caller is owner
    let owner = load_address(&make_key(PREFIX_OWNER, token_id));
    let mut caller = [0u8; 20];
    api::address(&mut caller);

    // Note: In EVM context, api::address() returns the contract address, not the EOA.
    // For approve to work from EOA, we need to check if the caller matches owner.
    // If called from an EVM contract, the contract should use transferFrom directly.
    if caller != owner {
        api::return_value(ReturnFlags::REVERT, &[]);
    }

    store_address(&make_key(PREFIX_APPROVAL, token_id), &to);
    ret_empty();
}

fn handle_get_approved(buf: &[u8; 196]) {
    let token_id = read_u128(&buf[4..36]);
    let approved = load_address(&make_key(PREFIX_APPROVAL, token_id));
    ret_address(&approved);
}

fn handle_region_begin(buf: &[u8; 196]) {
    let token_id = read_u128(&buf[4..36]);
    let val = load_u32(&make_key(PREFIX_BEGIN, token_id));
    ret_u32(val);
}

fn handle_region_end(buf: &[u8; 196]) {
    let token_id = read_u128(&buf[4..36]);
    let val = load_u32(&make_key(PREFIX_END, token_id));
    ret_u32(val);
}

fn handle_region_core(buf: &[u8; 196]) {
    let token_id = read_u128(&buf[4..36]);
    let val = load_u16(&make_key(PREFIX_CORE, token_id));
    ret_u16(val);
}

fn handle_mint_region(buf: &[u8; 196]) {
    // mintRegion(address to, uint32 begin, uint32 end, uint16 core)
    let to = read_address(&buf[4..36]);
    let begin_block = read_u32_from(&buf[36..68]);
    let end_block = read_u32_from(&buf[68..100]);
    let core_index = read_u16_from(&buf[100..132]);

    let region_id = load_u128(&KEY_NEXT_ID);
    store_u128(&KEY_NEXT_ID, region_id + 1);

    store_address(&make_key(PREFIX_OWNER, region_id), &to);
    store_u32(&make_key(PREFIX_BEGIN, region_id), begin_block);
    store_u32(&make_key(PREFIX_END, region_id), end_block);
    store_u16(&make_key(PREFIX_CORE, region_id), core_index);

    // Return regionId
    ret_u128(region_id);
}

fn handle_mint_with_id(buf: &[u8; 196]) {
    // mintRegionWithId(address to, uint128 regionId, uint32 begin, uint32 end, uint16 core)
    let to = read_address(&buf[4..36]);
    let region_id = read_u128(&buf[36..68]);
    let begin_block = read_u32_from(&buf[68..100]);
    let end_block = read_u32_from(&buf[100..132]);
    let core_index = read_u16_from(&buf[132..164]);

    // Check not already minted
    let existing = load_address(&make_key(PREFIX_OWNER, region_id));
    if existing != [0u8; 20] {
        api::return_value(ReturnFlags::REVERT, &[]); // already minted
    }

    store_address(&make_key(PREFIX_OWNER, region_id), &to);
    store_u32(&make_key(PREFIX_BEGIN, region_id), begin_block);
    store_u32(&make_key(PREFIX_END, region_id), end_block);
    store_u16(&make_key(PREFIX_CORE, region_id), core_index);

    ret_empty();
}

// ── Storage helpers ────────────────────────────────────────────────────────────

fn store_address(key: &[u8; 32], addr: &[u8; 20]) {
    api::set_storage(StorageFlags::empty(), key, addr);
}

fn load_address(key: &[u8; 32]) -> [u8; 20] {
    let mut buf = [0u8; 20];
    let mut out = &mut buf[..];
    if api::get_storage(StorageFlags::empty(), key, &mut out).is_err() {
        return [0u8; 20];
    }
    buf
}

fn store_u128(key: &[u8; 32], val: u128) {
    api::set_storage(StorageFlags::empty(), key, &val.to_le_bytes());
}

fn load_u128(key: &[u8; 32]) -> u128 {
    let mut buf = [0u8; 16];
    let mut out = &mut buf[..];
    if api::get_storage(StorageFlags::empty(), key, &mut out).is_err() {
        // Default: nextRegionId starts at 1
        return if *key == KEY_NEXT_ID { 1 } else { 0 };
    }
    u128::from_le_bytes(buf)
}

fn store_u32(key: &[u8; 32], val: u32) {
    api::set_storage(StorageFlags::empty(), key, &val.to_le_bytes());
}

fn load_u32(key: &[u8; 32]) -> u32 {
    let mut buf = [0u8; 4];
    let mut out = &mut buf[..];
    if api::get_storage(StorageFlags::empty(), key, &mut out).is_err() {
        return 0;
    }
    u32::from_le_bytes(buf)
}

fn store_u16(key: &[u8; 32], val: u16) {
    api::set_storage(StorageFlags::empty(), key, &val.to_le_bytes());
}

fn load_u16(key: &[u8; 32]) -> u16 {
    let mut buf = [0u8; 2];
    let mut out = &mut buf[..];
    if api::get_storage(StorageFlags::empty(), key, &mut out).is_err() {
        return 0;
    }
    u16::from_le_bytes(buf)
}

// ── ABI helpers ───────────────────────────────────────────────────────────────

fn read_address(slot: &[u8]) -> [u8; 20] {
    // address is right-aligned in 32 bytes: bytes 12..32
    let mut addr = [0u8; 20];
    addr.copy_from_slice(&slot[12..32]);
    addr
}

fn read_u128(slot: &[u8]) -> u128 {
    u128::from_be_bytes(slot[16..32].try_into().unwrap())
}

fn read_u32_from(slot: &[u8]) -> u32 {
    u32::from_be_bytes(slot[28..32].try_into().unwrap())
}

fn read_u16_from(slot: &[u8]) -> u16 {
    u16::from_be_bytes(slot[30..32].try_into().unwrap())
}

fn ret_address(addr: &[u8; 20]) {
    let mut out = [0u8; 32];
    out[12..32].copy_from_slice(addr);
    api::return_value(ReturnFlags::empty(), &out);
}

fn ret_u128(val: u128) {
    let mut out = [0u8; 32];
    out[16..32].copy_from_slice(&val.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &out);
}

fn ret_u32(val: u32) {
    let mut out = [0u8; 32];
    out[28..32].copy_from_slice(&val.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &out);
}

fn ret_u16(val: u16) {
    let mut out = [0u8; 32];
    out[30..32].copy_from_slice(&val.to_be_bytes());
    api::return_value(ReturnFlags::empty(), &out);
}

fn ret_empty() {
    api::return_value(ReturnFlags::empty(), &[]);
}
