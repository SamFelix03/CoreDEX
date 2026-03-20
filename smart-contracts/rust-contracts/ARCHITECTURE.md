# CoreDEX Rust Contracts (PVM Mocks) - Architecture Guide

This document explains the Rust contract layer in `smart-contracts/rust-contracts` and how it connects to the Solidity protocol.

## 1) Why this folder exists

These Rust binaries are deployed as **PVM contracts** and act as ABI-compatible mock surfaces for:

- coretime oracle data
- option pricing logic
- coretime NFT interface
- assets/DOT transfer interface

They let the protocol demonstrate cross-VM behavior now, while preserving the same call pattern expected in production precompile/runtime-backed environments.

## 2) Binaries and responsibilities

From `Cargo.toml`, this folder builds four separate PVM programs:

1. `coretime_oracle`
- Provides spot/volatility and related oracle-like methods.
- Current implementation uses contract storage defaults and setters.
- In production intent, this surface maps to real broker/runtime data sources.

2. `pricing_module`
- Provides option premium and IV-related calculations.
- Called by `OptionsEngine.sol` for premium logic.
- Keeps pricing compute off the EVM path.

3. `coretime_nft`
- ERC721-like interface for region ownership and transfer.
- Used by forward/options/vault contracts for NFT escrow and movement.

4. `mock_assets`
- Assets-like interface for balance and transfer operations.
- Used for DOT-style transfer simulation in current build.

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

1. Build Rust binaries (`cargo build --release`).
2. Link to `.polkavm` artifacts (`polkatool link ...` from `package.json` scripts).
3. Deploy binaries as contracts.
4. Register addresses in `CoreDexRegistry`.

This gives a full deployable cross-VM stack without modifying Solidity call sites.

## 6) Relationship to production

Current folder contains **mock contracts for hackathon/testnet usability**.

Production direction:

- keep same interface expectations in Solidity
- replace mock behavior with runtime/precompile-backed data and transfers
- preserve call graph so product logic does not need redesign

In short: this layer is the cross-VM compatibility bridge between today's deployable demo and tomorrow's runtime-integrated deployment.

