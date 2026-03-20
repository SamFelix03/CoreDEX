# CoreDEX Rust Contracts (PVM Mocks) - Architecture Guide

This document explains the Rust contract layer in `smart-contracts/rust-contracts` and how it connects to the Solidity protocol.

## 1) Why this folder exists

These Rust binaries are deployed as **PVM contracts** and act as ABI-compatible mock surfaces for:

- coretime oracle data
- option pricing logic
- coretime NFT interface
- assets/DOT transfer interface

They let the protocol demonstrate cross-VM behavior now, while preserving the same call pattern expected in production precompile/runtime-backed environments.

## 2) Main components

The package `coredex-pvm-mocks` (`Cargo.toml`) builds **four independent binaries**. Each binary is a minimal `#![no_std]` / `#![no_main]` program compiled to **RISC‑V for PolkaVM**, then linked to a `.polkavm` artifact for deployment as its **own** PVM contract address.

There is **no shared Rust library** between them: each `src/*.rs` file is self-contained. What they share is the **same execution pattern** and dependency stack:

- **`pallet-revive-uapi`** (`uapi`) — host functions for calldata, return data, contract storage, and caller address (`call_data_copy`, `return_value`, `get_storage` / `set_storage`, `address`, …).
- **`polkavm_derive`** — exported `deploy` and `call` entry points.
- **Manual ABI handling** — selectors are matched on the first four calldata bytes; arguments and return values are read/written in **Solidity ABI layout** (32-byte words, big-endian values right-aligned in each word). There is no separate `ethabi` crate here; encoding rules are implemented inline next to each handler (same discipline as production PVM surfaces, with everything visible in one file).

### `coretime_oracle` (`src/coretime_oracle.rs`)

**Role:** ABI-compatible **oracle mock** for `ForwardMarket` / `OptionsEngine`: spot price, implied vol, sale metadata, and “availability” style fields.

**Behavior today:** Values live in **contract-local storage** under fixed 32-byte keys (documented in the source header): e.g. spot price, implied vol, last sale / renewal prices, sale region bounds, total cores vs sold. Reads use defaults when a key is unset; `setSpotPrice` / `setImpliedVolatility` persist updates; `initialize()` resets the documented defaults (useful for demos).

**Production direction:** The **call surface** (selectors + types) is what matters long-term. A runtime-backed oracle would replace storage-backed mocks with **broker / runtime-derived** data while keeping Solidity call sites stable.

### `pricing_module` (`src/pricing_module.rs`)

**Role:** **Off-EVM option math** for `OptionsEngine`: `price_option(...)` returns premium + delta; `solve_iv(...)` returns a volatility estimate for a target premium.

**Behavior today:** A **simplified** Black–Scholes-style model using `u128` fixed-point (`1e18` scale), Babylonian `sqrt`, and bounded calldata buffers (selector + five ABI words = 164 bytes). This is intentionally lean for the mock; it demonstrates the **cross-VM pricing path**, not the full precision story of `pvm-modules`.

**Why not inline in Solidity:** Same rationale as the architecture doc — tight loops and sqrt/exp-style steps are **cheaper and clearer in Rust on PolkaVM** than as 256-bit EVM opcode sequences at comparable fidelity.

### `coretime_nft` (`src/coretime_nft.rs`)

**Role:** **ERC-721-shaped** mock for **coretime region** NFTs: `ownerOf`, `transferFrom`, `approve`, `getApproved`, region metadata (`regionBegin` / `regionEnd` / `regionCore`), and `mintRegion` / `mintRegionWithId` for test setups.

**Behavior today:** Per-token map in contract storage (key prefixes for owner, approval, begin/end/core, plus a monotonic `nextId`). Reverts on invalid transfers or missing tokens mirror familiar ERC-721 failure modes.

**Why Rust here:** The point is to exercise **the same ABI and call graph** Solidity will use when region ownership is backed by a **broker/runtime precompile** or chain-native surface — without pretending the mock is canonical state.

### `mock_assets` (`src/mock_assets.rs`)

**Role:** **Assets-precompile-shaped** mock for DOT-style **balance**, **transfer** / **transferFrom**, **totalIssuance**, **existentialDeposit**, plus **mint** / **burn** for local testing.

**Behavior today:** Balances and total supply live in contract storage (`balance:{address}` layout as documented in source). `transfer` uses `uapi::address()` as the sender; arithmetic is done on **32-byte big-endian** balance words in helpers.

**Production direction:** On Polkadot Hub, real asset behavior is expected at **system precompile** addresses; this contract proves the **interface and cross-VM routing** before that wiring is available everywhere you deploy.

---

### Why Rust for these mocks (instead of Solidity-only)

**1) Cross-VM is the product demo**

`pallet-revive` routes a normal EVM external call to a **PVM program** when the target is a PVM contract. Writing the callee in Rust is the **direct** way to ship that bytecode and match how non-EVM execution is done on Hub.

**2) Oracle and pricing paths match production**

Production oracle/pricing are **Rust-shaped** (PVM or precompile), not EVM libraries. Mocks in Rust keep **types, selectors, and mental model** aligned with the path you intend to run in production.

**3) Execution and storage ergonomics**

`no_std` PolkaVM programs use **small fixed buffers**, explicit storage keys, and **no allocator surprise**. For mocks that must be deterministic and easy to audit, that’s a good fit.

**4) NFT / assets could be Solidity in theory**

You *could* implement ERC-721–like or ERC-20–like mocks in Solidity on the EVM side. These Rust versions exist so **ForwardMarket / OptionsEngine / YieldVault** still perform **cross-VM** calls — the same architecture you want on testnets and in demos.

---

### PVM mock contract vs runtime precompile vs “logic in Solidity”

| Concern | PVM mock (this folder) | Runtime precompile (e.g. `pvm-modules` model) | Logic in Solidity |
|--------|-------------------------|-----------------------------------------------|-------------------|
| **Deployment** | You deploy bytecode; **address varies** unless you fix it in your registry/scripts. | Fixed **well-known addresses**; registered in runtime. | One EVM contract address. |
| **State** | **Contract storage** via `uapi` (mock data, balances, NFT maps). | Often **stateless** or reads **runtime/pallet** storage; not a user-deployed contract. | EVM contract storage. |
| **Upgrade** | Redeploy binary, update registry — **your** migration story. | **Runtime upgrade** changes behavior; callers keep the same address. | Proxy pattern or redeploy + migrate links. |
| **Trust boundary** | “Whatever bytecode was deployed at this address.” | “Chain-defined surface at this address.” | Same as any app contract. |
| **Broker / real coretime state** | **Not** wired to real broker storage in the mock; simulates via storage + scripts. | Intended to **read** authoritative runtime state. | Cannot read arbitrary pallet keys. |
| **Solidity call sites** | Unchanged: normal `call` / `staticcall` to configured addresses. | Same. | No cross-VM to PVM for that call. |

**Practical takeaway:** This folder is **intentionally deployable and hackable** (setters, mint, mock balances). `pvm-modules` is **intentionally runtime-shaped** (fixed precompile addresses, dispatch-only wiring). Solidity keeps **protocol flow**; these Rust programs are **replaceable backends** that preserve the ABI.

## 3) ABI compatibility contract

The core design rule in this folder is:

- expose Solidity-compatible selectors and ABI layouts
- return data exactly as EVM callers expect

This is why EVM contracts can call these PVM contracts through ordinary `call/staticcall` style interactions under `pallet-revive` routing.

## 4) End-to-end role in protocol execution

When protocol actions occur in EVM contracts:

- `ForwardMarket` uses oracle checks and NFT/assets interfaces
- `OptionsEngine` uses oracle + pricing + NFT/assets interfaces
- `YieldVault` uses NFT/assets interfaces

All of these can be resolved to addresses pointing to these PVM binaries.

So the Solidity side remains unchanged while backend capability lives in Rust modules.

## 5) Build and artifact model

Typical flow:

1. Build Rust binaries (`cargo build --release` for target `riscv64emac-unknown-none-polkavm`).
2. Link each release binary with `polkatool link --strip` (`package.json` → `build` / `link:*`), producing `coretime_oracle.polkavm`, `pricing_module.polkavm`, `coretime_nft.polkavm`, and `mock_assets.polkavm` in this directory.
3. Deploy each `.polkavm` as its own PVM contract.
4. Register deployed addresses in `CoreDexRegistry` (and any frontend/env constants).

This gives a full deployable cross-VM stack without modifying Solidity call sites.

## 6) Relationship to production

Current folder contains **mock contracts for hackathon/testnet usability**.

Production direction:

- keep same interface expectations in Solidity
- replace mock behavior with runtime/precompile-backed data and transfers
- preserve call graph so product logic does not need redesign

In short: this layer is the cross-VM compatibility bridge between today's deployable demo and tomorrow's runtime-integrated deployment.

