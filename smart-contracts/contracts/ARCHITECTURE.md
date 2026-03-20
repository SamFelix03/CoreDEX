# CoreDEX Solidity Contracts - Architecture Guide

This document explains the Solidity/EVM layer in `smart-contracts/contracts` and how it participates in the full CoreDEX flow.

## 1) What this layer is responsible for

The Solidity contracts implement the protocol's business logic:

- Market logic for **forwards**, **options**, and **vault lending**
- Shared state coordination and safety checks
- Governance, pause controls, and upgrade routing
- Settlement orchestration through the XCM precompile

These contracts run on the EVM side of Polkadot Hub (`pallet-revive` EVM execution), and call Rust/PVM contracts via cross-VM calls when needed.

## 2) Contract map

### `CoreDexRegistry.sol`
- Global address router and governance entry point.
- Stores canonical addresses (ForwardMarket, OptionsEngine, Oracle, PricingModule, etc.).
- Supports:
  - direct registration
  - timelocked upgrades (`proposeUpdate` -> `executeUpdate`)
  - protocol pause/unpause

### `CoretimeLedger.sol`
- Protocol-wide risk ledger.
- Enforces the key invariant:
  - one coretime region cannot be encumbered in multiple products at the same time.
- Tracks:
  - region lock owner/type
  - margin balances
  - open position counts

### `ForwardMarket.sol`
- Order book for coretime forwards.
- Seller escrows region NFT at ask creation.
- Buyer escrows DOT on match.
- Uses oracle spot checks for strike sanity.
- Calls settlement path when order reaches delivery.

### `OptionsEngine.sol`
- European-style call/put lifecycle:
  - write
  - buy
  - exercise at expiry
  - expire after expiry
- Pulls spot/volatility from oracle and premium from pricing module.
- Uses ledger for region/margin coordination.

### `YieldVault.sol`
- Depositors provide idle coretime regions.
- Borrowers pay DOT fees for time-bound region usage.
- Tracks loans, epochs, and yield distribution.
- Uses ledger locks to prevent double-use of deposited regions.

### `SettlementExecutor.sol`
- Handles settlement execution and recovery flow.
- Dispatches cross-chain program through XCM precompile.
- Maintains settlement phase tracking and timeout-based recovery.

## 3) Shared system invariants

The Solidity layer is designed around a few core invariants:

1. **Global lock invariant**
- Region can be locked in only one active position across products.

2. **Escrow-before-exposure**
- Assets are escrowed before position risk is created.

3. **Registry-driven dependencies**
- Contracts resolve dependencies from registry instead of hardcoding.

4. **Pause-aware state changes**
- State-mutating functions check global pause state.

## 4) End-to-end flow (protocol perspective)

## A. Forward lifecycle
1. Seller creates ask -> NFT escrowed -> region locked in ledger.
2. Buyer matches -> DOT escrowed -> buyer margin recorded.
3. At delivery, settlement path executes.
4. On success, state finalizes and locks/margins are released.

## B. Option lifecycle
1. Writer writes call/put (NFT or DOT collateral).
2. Premium is computed via cross-VM pricing call.
3. Holder buys by paying premium.
4. At expiry:
   - exercise path executes (call/put logic)
   - or expire path returns collateral.

## C. Vault lifecycle
1. Depositor deposits region NFT into vault.
2. Region is ledger-locked as vault position.
3. Borrower borrows capacity and pays fee.
4. Loan returns, region becomes available again.
5. Depositor claims yield from finalized epochs.

## 5) Cross-VM and XCM boundaries

This Solidity layer delegates:

- **Oracle and pricing math** -> Rust/PVM contracts via `staticcall` style cross-VM dispatch.
- **Cross-chain settlement dispatch** -> XCM precompile through SettlementExecutor.

So this layer is the protocol orchestrator, while heavy computation/data surfaces are moved to PVM/runtime paths.

## 6) Why this split matters

- Keeps product logic composable and readable in Solidity.
- Offloads specialized compute/data access to Rust/PVM.
- Preserves deterministic coordination through a single EVM protocol core plus a shared ledger.

