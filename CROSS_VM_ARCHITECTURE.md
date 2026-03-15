# CoreDEX Cross-VM Architecture

## Overview

CoreDEX uses Polkadot Hub's **cross-VM architecture** — a unique capability of `pallet-revive` that allows EVM Solidity contracts and PVM Rust contracts to call each other **transparently**, within the same transaction, without bridges or XCM.

```
┌──────────────────────────────────────────────────────────────────┐
│  EVM Executor (Solidity — compiled with solc)                    │
│  ┌─────────────────┐  ┌───────────────┐  ┌─────────────────┐    │
│  │  ForwardMarket   │  │ OptionsEngine │  │   YieldVault    │    │
│  │  CoretimeLedger  │  │ CoreDexReg.   │  │ SettlementExec. │    │
│  └────────┬─────────┘  └──────┬────────┘  └───────┬─────────┘    │
│           │ cross-VM calls    │                    │              │
│           │ (standard external calls — pallet-revive routes)     │
│           ▼                   ▼                    ▼              │
│  PVM Executor (Rust — compiled to RISC-V via polkavm)            │
│  ┌─────────────────┐  ┌───────────────┐  ┌─────────────────┐    │
│  │ CoretimeOracle   │  │PricingModule  │  │  CoretimeNFT    │    │
│  │ (oracle data)    │  │(Black-Scholes)│  │  (ERC-721 mock) │    │
│  └─────────────────┘  └───────────────┘  └─────────────────┘    │
│                                                                  │
│  Real Polkadot Precompile (runtime built-in)                     │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  XCM Precompile @ 0x00000000000000000000000000000000000A0000  │
│  │  (execute, send, weighMessage — for cross-chain settlement)  │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Why Rust PVM Instead of Solidity Mocks?

### 1. Production Readiness

In production, the CoretimeOracle needs to **read Substrate runtime storage** (the Coretime Broker pallet's state) to provide real-time pricing. This is only possible from a PVM contract, not from an EVM contract. By writing the oracle in Rust now, the same contract structure can be upgraded to read real pallet storage when the runtime supports it.

### 2. Computational Efficiency

The **PricingModule** implements Black-Scholes option pricing with iterative square roots and bisection-based IV solving. These tight computational loops are **significantly more efficient** on RISC-V than on the EVM:

- RISC-V: Native 64-bit integer operations, tight loop compilation
- EVM: 256-bit stack machine with per-opcode gas costs

For example, the Babylonian square root in Rust compiles to ~10 RISC-V instructions. The equivalent in Solidity EVM costs ~200+ gas per iteration due to 256-bit arithmetic overhead.

### 3. Cross-VM Demonstration

This architecture showcases Polkadot Hub's **killer feature**: cross-VM interoperability. A Solidity contract can call a Rust contract with a standard `ICoretimeOracle(addr).spotPrice()` call — no special protocol, no bridge, no XCM within the chain. `pallet-revive` detects that the target address is a PVM contract and routes the call to the RISC-V executor transparently.

### 4. Substrate Ecosystem Integration

The Rust PVM contracts use `pallet-revive-uapi` — the same host function API used by Substrate runtime modules. This means:
- Storage read/write via `get_storage` / `set_storage`
- Caller identification via `address()`
- Return value passing via `return_value()`

This is the **natural way** to build precompile-like functionality on Polkadot Hub.

## Rust PVM Contract Structure

Each Rust PVM contract follows the standard `pallet-revive` pattern:

```rust
#![no_std]
#![no_main]

use uapi::{input, HostFn, HostFnImpl as api, ReturnFlags, StorageFlags};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::arch::asm!("unimp", options(noreturn)) }
}

/// Called once at deployment — seed initial storage.
#[polkavm_derive::polkavm_export]
extern "C" fn deploy() { /* ... */ }

/// Called on every transaction — dispatch by 4-byte selector.
#[polkavm_derive::polkavm_export]
extern "C" fn call() {
    input!(buf: &[u8; 164],);
    let selector: [u8; 4] = [buf[0], buf[1], buf[2], buf[3]];
    match selector {
        SEL_SPOT_PRICE => { /* read storage, return ABI-encoded */ }
        SEL_SET_PRICE  => { /* write storage */ }
        _ => api::return_value(ReturnFlags::REVERT, &[]),
    }
}
```

Key points:
- **ABI-compatible**: Function selectors match `keccak256` of Solidity-style signatures
- **Standard calldata**: Arguments are ABI-encoded (32-byte slots, big-endian)
- **Standard return data**: Results are ABI-encoded, identical to Solidity returns
- **Contract storage**: Uses `pallet-revive` host functions for persistent state

## Contract Inventory

### PVM Contracts (Rust → RISC-V)

| Contract | Description | Key Functions |
|----------|-------------|---------------|
| **CoretimeOracle** | Coretime price feed and market data | `spotPrice()`, `impliedVolatility()`, `saleRegion()`, `setSpotPrice()` |
| **PricingModule** | Black-Scholes option pricing engine | `price_option(spot, strike, time, vol, type)`, `solve_iv(...)` |
| **CoretimeNFT** | ERC-721-like coretime region NFTs | `ownerOf()`, `transferFrom()`, `approve()`, `regionBegin()`, `mintRegion()` |
| **MockAssets** | DOT balance and transfer simulation | `balanceOf()`, `transfer()`, `mint()`, `burn()` |

### EVM Contracts (Solidity)

| Contract | Description | Cross-VM Calls |
|----------|-------------|----------------|
| **CoreDexRegistry** | Central registry + governance | — |
| **CoretimeLedger** | Region locking + margin tracking | — |
| **ForwardMarket** | Forward contract order book | → CoretimeOracle, CoretimeNFT |
| **OptionsEngine** | Options trading engine | → CoretimeOracle, PricingModule, CoretimeNFT |
| **YieldVault** | Lending vault for regions | → CoretimeNFT |
| **SettlementExecutor** | XCM settlement dispatch | → CoretimeNFT, **Real XCM Precompile** |

### Real Polkadot Precompile

| Precompile | Address | Usage |
|-----------|---------|-------|
| **XCM** | `0x00000000000000000000000000000000000A0000` | Cross-chain NFT delivery and DOT settlement |

## Build & Deploy

### Prerequisites

```bash
# Rust nightly + RISC-V target
rustup toolchain install nightly-2024-11-19
rustup component add rust-src --toolchain nightly-2024-11-19

# polkatool for linking PVM binaries
cargo install polkatool
```

### Build Rust Contracts

```bash
cd smart-contracts/rust-contracts
npm run build
# Outputs: *.polkavm files (RISC-V bytecode ready for PVM deployment)
```

### Deploy

```bash
# Local (Hardhat node)
cd smart-contracts
npx hardhat node
# In another terminal:
npm run deploy:pvm

# Polkadot Hub TestNet
npm run deploy:pvm:testnet

# Full simulation (deploys everything + runs test flows)
npm run simulate
```

### Run Full Simulation

```bash
# Start a local Hardhat node
npx hardhat node

# In another terminal:
npm run simulate
```

This deploys all PVM + EVM contracts, seeds test data, and exercises every protocol flow:
- Forward Market: create ask → cancel
- Options Engine: write call → expire (with PVM PricingModule premium calculation)
- Yield Vault: deposit → withdraw
- Oracle: read/update (cross-VM EVM → PVM)
- Pricing: Black-Scholes pricing + IV solver (computed in Rust RISC-V)
- Governance: pause/unpause, transfer

## Hackathon Context

For the hackathon, the Rust PVM contracts serve as **mock precompiles** — they provide the same ABI that production runtime precompiles would expose, but they're deployed as user-space contracts rather than being compiled into the runtime.

**What changes for production:**
1. **CoretimeOracle** → reads real Broker pallet storage instead of mock values
2. **PricingModule** → same Rust logic, potentially higher precision math
3. **CoretimeNFT** → replaced by real NFT precompile from the Coretime Chain
4. **MockAssets** → replaced by the real Assets precompile at `0x...0806`
5. **XCM Precompile** → already using the real address (`0x...0a0000`)

The key insight: **the cross-VM calling pattern stays exactly the same**. Solidity contracts call `ICoretimeOracle(addr).spotPrice()` whether `addr` points to a mock PVM contract or a production runtime precompile.

## References

- [Polkadot Hub Cross-VM Demo](https://github.com/polkadot-developers/polkadot-hub-demo-cross-vm) — Official demo showing EVM ↔ PVM interop
- [pallet-revive Documentation](https://docs.polkadot.com/develop/smart-contracts/) — Polkadot Hub smart contracts
- [XCM Precompile](https://docs.polkadot.com/develop/smart-contracts/precompiles/xcm-precompile/) — Real XCM precompile interface
- [polkavm](https://github.com/nicknamenamenick/polkavm) — The RISC-V virtual machine for Polkadot
