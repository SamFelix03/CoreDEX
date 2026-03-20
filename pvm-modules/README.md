# CoreDEX PVM Modules (Runtime/Precompile-Oriented) - Architecture Guide

This document explains the `pvm-modules` crate and how it fits into the end-to-end CoreDEX architecture.

## 1) What this module represents

`pvm-modules` is the **reference runtime-side design** for CoreDEX precompile functionality.

Unlike `smart-contracts/rust-contracts` (deployed user-space PVM mock contracts), this crate models:

- precompile-set style dispatch
- fixed precompile addresses
- ABI decode/encode logic for oracle and pricing calls
- runtime integration shape under `pallet-revive`

Think of this as the production-aligned template for pallet/runtime-backed behavior.

## 2) Main components

The crate splits responsibilities into **pure computation** (oracle + pricing), **ABI bridging** (bytes in / bytes out), and **runtime wiring** (fixed addresses + dispatch). That separation is deliberate: Solidity keeps protocol and product logic stable, while Rust owns data access and heavy numerics behind a stable ABI.

### `coretime_oracle.rs`

**Role:** Derive market-facing oracle fields from **on-chain broker/Coretime state**, not from external feeds.

**What it models (conceptually):** spot price, TWAP over a configurable lookback, utilisation-style signals, and implied volatility derived from recent on-chain variation — all as **fixed-point, checked integer math** (no floats), with explicit error cases when storage or history is insufficient.

**Production shape:** The design assumes **direct reads of Substrate storage** (e.g. broker pallet keys) from the PVM/precompile context. That is the trust anchor: everything is derivable from chain state the runtime already commits to.

### `pricing_module.rs`

**Role:** **Black–Scholes** pricing and related numerics (e.g. Newton–Raphson style IV solving) for options flows that Solidity would otherwise approximate badly or pay heavily for on the EVM.

**What it models:** Deterministic **i128 fixed-point** arithmetic end-to-end (same inputs → same outputs on every node), including exp/ln/normal-CDF style building blocks needed for premiums and greeks.

**Why it lives outside Solidity:** The operations are loop- and sqrt-heavy; expressing them faithfully in 256-bit stack-machine Solidity tends to be **gas-expensive and error-prone** compared to a tight Rust implementation compiled to the PVM execution model.

### `abi.rs`

**Role:** The **only** stable wire format between EVM callers and these modules: decode calldata, call into `coretime_oracle` / `pricing_module`, ABI-encode return data.

**Why it matters:** Layout (field order, widths, padding) must match Solidity’s `abi.encode` / `abi.decode` exactly. This file is where “silent corruption” is avoided — any drift breaks cross-VM calls without a friendly error.

### `precompiles/*`

**Role:** Thin **precompile handlers** — one per surface area — implementing the full call lifecycle: raw input bytes → decode → execute pure logic → encode → return bytes.

They are intentionally dumb routers: no business rules that belong in `ForwardMarket` / `OptionsEngine`; only “parse, invoke module, serialize.”

### `precompile_set.rs`

**Role:** What the **pallet-revive**-style runtime hooks into:

- **Fixed `H160` addresses** for each CoreDEX precompile (must stay in sync with Solidity constants, registry, and frontend).
- `is_precompile` — fast path: “is this call target one of ours?”
- `execute` — route `(address, input)` to the correct handler, or return `None` so normal contract execution continues.

This is the **integration seam**: the same Solidity `call`/`staticcall` ABI works whether the backend is a mock PVM contract or a runtime-backed precompile.

---

### Why Rust (and this split) instead of “just Solidity”?

**1) Data the EVM cannot see**

Solidity contracts cannot arbitrarily read **raw Substrate pallet storage**. An oracle that must be anchored to broker/Coretime state needs a path that runs **next to the runtime** (PVM contract or precompile). Rust is the natural implementation language in that environment and matches how `pallet-revive` and host APIs are exposed.

**2) Numerics and determinism**

Pricing uses iterative solvers, exp/log/normal approximations, and careful fixed-point ranges. Rust gives **checked integer operations**, structured error types, and straightforward testing — while still compiling to a **deterministic** execution target (no floating point in consensus-critical paths).

**3) Gas / compute efficiency**

Heavy inner loops on the EVM pay per opcode on 256-bit words. The same math on the PVM side is typically **much cheaper in practice** for this workload class, which matters when pricing runs inside user transactions.

---

### Precompile vs embedding the same logic in a Solidity library/contract

| Concern | Precompile (runtime / fixed address) | Logic in Solidity |
|--------|--------------------------------------|-------------------|
| **Runtime storage access** | Can be authorized to use host/runtime reads that plain EVM code cannot. | Stuck with what the EVM exposes; cannot “peek” at arbitrary pallet keys. |
| **Upgrade / governance** | Behavior can be tied to **runtime upgrades** and explicit precompile registration — one place to audit. | Redeploy or upgrade many dependent contracts; harder to keep a single trusted implementation. |
| **Gas / throughput** | Native/PVM-style execution for hot paths. | Often higher gas for the same numerical fidelity. |
| **Trust boundary** | Clear: “calls to `0x…2001` are system-level surfaces.” | Mixed with app contracts; easier to accidentally fork or duplicate math. |
| **EVM UX** | **Unchanged** for protocol contracts: same ABI, same addresses, same `staticcall` patterns. | Same ABI possible, but you lose the above operational and access advantages. |

**Practical takeaway:** Solidity keeps **protocol orchestration** (markets, vaults, registry). Rust precompiles hold **consensus-sensitive numerics and chain-derived oracle data**, exposed through a **frozen ABI** so the Solidity layer does not need rewrites when the backend moves from demo PVM contracts to production precompiles.

## 3) End-to-end system placement

At system level, CoreDEX can be seen as three layers:

1. **EVM protocol layer**
- ForwardMarket, OptionsEngine, YieldVault, Ledger, SettlementExecutor.

2. **PVM computation/data layer**
- Oracle and pricing surfaces that EVM calls cross-VM.

3. **Runtime/precompile integration layer**
- The model represented by this `pvm-modules` crate.

This folder defines how layer (2) can be exposed as runtime-precompile style endpoints with stable addresses and deterministic behavior.

## 4) Why both `rust-contracts` and `pvm-modules` exist

- `smart-contracts/rust-contracts`:
  - deployable now as PVM contracts
  - practical for demos and testnets

- `pvm-modules`:
  - reference for runtime/precompile integration
  - closer to production architecture where surfaces are runtime-backed

Both preserve the same architectural goal: keep Solidity product logic stable while evolving backend execution surfaces.

## 5) Architectural contract with Solidity layer

The Solidity side assumes:

- stable function selectors
- compatible ABI payloads
- deterministic return values

`pvm-modules` encodes this contract in a precompile-set model, which is key for swapping from user-space mocks to runtime-integrated endpoints without rewriting protocol business logic.

## 6) Practical takeaway

This crate is the bridge from "cross-VM prototype" to "runtime-integrated production":

- same high-level flows
- stronger runtime integration
- lower friction for EVM contracts that already depend on oracle/pricing calls

