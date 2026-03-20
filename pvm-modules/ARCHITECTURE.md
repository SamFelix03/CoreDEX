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

### `coretime_oracle.rs`
- Oracle computation interface and data derivation model.
- Intended to read chain/runtime state in production context.

### `pricing_module.rs`
- Option pricing engine and implied-volatility routines.
- Deterministic fixed-point math intended for fast PVM execution.

### `precompiles/*`
- Precompile handlers that map ABI call data to module logic.

### `precompile_set.rs`
- Address-based routing:
  - checks whether call target is a registered CoreDEX precompile
  - dispatches to oracle/pricing precompile handlers

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

