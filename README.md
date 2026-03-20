# CoreDEX

## Important links

| Resource | Link |
|----------|------|
| Smart contracts (Solidity, Hardhat) | [github.com/SamFelix03/coreDEX/tree/main/smart-contracts](https://github.com/SamFelix03/coreDEX/tree/main/smart-contracts) |
| Rust PVM contracts (PolkaVM binaries built from `rust-contracts`) | [github.com/SamFelix03/coreDEX/tree/main/smart-contracts/rust-contracts](https://github.com/SamFelix03/coreDEX/tree/main/smart-contracts/rust-contracts) |
| PVM precompiles (reference Substrate / precompile implementations) | [github.com/SamFelix03/coreDEX/tree/main/pvm-modules](https://github.com/SamFelix03/coreDEX/tree/main/pvm-modules) |
| Demo video | [View Here](https://www.canva.com/design/DAHEdeXrTPY/jjcR6n7bLREfQAiUqf-jjA/watch?utm_content=DAHEdeXrTPY&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hcfce4f3504) |
| Pitch deck | [View Here](https://www.canva.com/design/DAHEendUZ_4/binGCcNj3CUyIqOCY04S5A/view?utm_content=DAHEendUZ_4&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hbc5722e6ea) |

## Introduction

CoreDEX is a **coretime derivatives protocol** for Polkadot: a native layer on **Agile Coretime** that treats blockspace allocations as first-class, financeable assets. It combines Solidity contracts on Polkadot Hub (`pallet-revive`) with **PVM (PolkaVM) Rust** modules for pricing and oracle-style data, and uses **runtime precompiles** (notably the **XCM precompile**) for trust-minimized cross-chain settlement.

- **Forward contracts** — binding agreements to deliver a specific coretime region (NFT) at a future block for an agreed DOT price, with on-chain escrow and settlement.
- **European-style options** — calls and puts on coretime; premiums are computed via a **Black-Scholes** engine on PVM, using spot and volatility inputs from the **CoretimeOracle** PVM contract.
- **Yield vaults** — deposit idle coretime NFTs into a pooled lending facility; borrowers pay DOT fees that accrue to depositors, with rates driven by an on-chain utilisation curve.

---

## Problem

Agile Coretime gives Polkadot a **spot market** for blockspace: allocations can be bought, held, and transferred as NFTs. Teams still face **unhedged cost and utilisation risk** — bulk purchases lock capital, demand spikes are hard to insure, and idle capacity earns nothing structured. Traditional commodity and power markets solved this with **forwards, options, and secured lending**; blockspace on most chains cannot be tokenized as a discrete, deliverable asset, so those patterns do not port over. On Polkadot, transferable coretime NFTs plus cross-chain messaging make a **delivery-based** derivatives stack plausible without inventing a synthetic bridge asset.

---

## Solution and innovation

CoreDEX layers **forwards, options, and vault lending** on top of coretime NFTs. The design leans on primitives that are unusual outside Polkadot Hub:

| Primitive | Role in CoreDEX |
|-----------|-----------------|
| **Cross-VM (`pallet-revive`)** | Solidity contracts call PVM contracts with normal `staticcall` semantics; the executor routes to RISC-V when the callee is a PVM program. Oracle reads and option math stay in Rust while business logic stays in Solidity. |
| **PVM Rust modules** | `CoretimeOracle` and `PricingModule` are ABI-compatible RISC-V blobs (see [smart-contracts/rust-contracts](https://github.com/SamFelix03/coreDEX/tree/main/smart-contracts/rust-contracts)). In production, oracle logic is intended to read **real Broker pallet state**; the same cross-VM calling pattern applies whether the callee is a user contract or a runtime hook. |
| **Runtime precompiles (production)** | On Polkadot Hub, **native precompiles** are the supported way to expose assets, XCM, and other system features to contracts with low overhead. CoreDEX is designed to call those interfaces in production: **XCM** for cross-chain NFT delivery, **Assets** (and related ERC-style interfaces) for DOT/stable balances, and **coretime NFT** interfaces from the Coretime / system chain as specified in Hub documentation — not ad hoc user-deployed “precompiles.” |
| **Shared security & messaging** | Settlement is framed as **programmatic XCM** from the executor, aligning with the protocol’s goal of physical delivery of the underlying NFT rather than purely cash-settled claims. |

**Production precompiles vs this repository’s PVM contracts.** In a live deployment, oracle, pricing, assets, and coretime-NFT surfaces are expected to be satisfied by **official Hub precompiles** and **pallet-backed state**, exactly as described in Polkadot’s smart-contract docs. **Custom runtime precompiles are not something you can add ad hoc on Polkadot Hub**: they ship with the relay-governed runtime, and extending that set means a **runtime upgrade**—typically viable on **your own parachain** or via ecosystem governance, which is **operationally heavy** compared to deploying contracts. To **demonstrate PVM and cross-VM flows on Hub today** without operating a dedicated chain, this project deploys **Rust PVM contracts** that **mimic the ABI and role** of those future or remote precompiles (see **Hackathon Context** in [CROSS_VM_ARCHITECTURE.md](https://github.com/SamFelix03/coreDEX/blob/main/CROSS_VM_ARCHITECTURE.md#hackathon-context): mock oracle, pricing, NFT, and assets alongside the **real** XCM precompile address). The important architectural point from that doc: **the Solidity ↔ PVM calling pattern is unchanged** when mocks are swapped for real precompiles—only the callee addresses and runtime backing change.

**Official precompile documentation (Polkadot Developer Docs):**

- [Precompiles overview](https://docs.polkadot.com/develop/smart-contracts/precompiles/)
- [Interact with precompiles](https://docs.polkadot.com/develop/smart-contracts/precompiles/interact-with-precompiles)
- [XCM precompile](https://docs.polkadot.com/develop/smart-contracts/precompiles/xcm-precompile/)
- [Polkadot Hub smart contracts (`pallet-revive`)](https://docs.polkadot.com/develop/smart-contracts/)

In the current testnet deployment, **XCM** uses the real precompile at `0x000…0a0000`; **MockAssets** and **CoretimeNFT** PVM contracts stand in for production Assets / coretime NFT interfaces ([CROSS_VM_ARCHITECTURE.md](https://github.com/SamFelix03/coreDEX/blob/main/CROSS_VM_ARCHITECTURE.md#hackathon-context) — *What changes for production*).

Use [Blockscout (Polkadot Testnet)](https://blockscout-testnet.polkadot.io/) for address and transaction inspection on Hub testnet.

---

## Deployed contracts (Polkadot Hub testnet)

**Package / spec:** `smart-contracts` npm version **1.0.0**; on-chain addresses below match [pvm-testnet-addresses.json](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/pvm-testnet-addresses.json) and [deployed-addresses.json](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/deployed-addresses.json) (snapshot **2026-03-15**, chain id **420420417**).

| Contract | Address | Blockscout |
|----------|---------|------------|
| CoreDexRegistry | `0x26D215752f68bc2254186F9f6FF068b8C4BdFd37` | [View](https://blockscout-testnet.polkadot.io/address/0x26D215752f68bc2254186F9f6FF068b8C4BdFd37) |
| CoretimeLedger | `0x14d42947929F1ECf882aA6a07dd4279ADb49345d` | [View](https://blockscout-testnet.polkadot.io/address/0x14d42947929F1ECf882aA6a07dd4279ADb49345d) |
| ForwardMarket | `0x7000469F063Da54d23965Ba254CAA77CCC3E0D1c` | [View](https://blockscout-testnet.polkadot.io/address/0x7000469F063Da54d23965Ba254CAA77CCC3E0D1c) |
| OptionsEngine | `0xAA1c5a2ae781506B8629E7ADdBdB8650254ba59e` | [View](https://blockscout-testnet.polkadot.io/address/0xAA1c5a2ae781506B8629E7ADdBdB8650254ba59e) |
| YieldVault | `0x790294681B3A8475DcF791f158D42Eb961dD8553` | [View](https://blockscout-testnet.polkadot.io/address/0x790294681B3A8475DcF791f158D42Eb961dD8553) |
| SettlementExecutor | `0xf2dF3Ea8C0c802678c427e4D280D48c00AC040f3` | [View](https://blockscout-testnet.polkadot.io/address/0xf2dF3Ea8C0c802678c427e4D280D48c00AC040f3) |
| CoretimeOracle (PVM) | `0xE1f895FcA63839401C3d0Cc2F194b1ae9902CB8A` | [View](https://blockscout-testnet.polkadot.io/address/0xE1f895FcA63839401C3d0Cc2F194b1ae9902CB8A) |
| PricingModule (PVM) | `0xCFAF1e5a2df41738472029869Be7fA5e375C7A1f` | [View](https://blockscout-testnet.polkadot.io/address/0xCFAF1e5a2df41738472029869Be7fA5e375C7A1f) |
| CoretimeNFT (PVM mock) | `0x2fc7308a6D40c68fc47990eD29656fF7c8F6FBB2` | [View](https://blockscout-testnet.polkadot.io/address/0x2fc7308a6D40c68fc47990eD29656fF7c8F6FBB2) |
| MockAssets (PVM mock) | `0xc82e04234549D48b961d8Cb3F3c60609dDF3F006` | [View](https://blockscout-testnet.polkadot.io/address/0xc82e04234549D48b961d8Cb3F3c60609dDF3F006) |

---

## How Polkadot Hub's architecture enables CoreDEX

This section is the architecture deep-dive for why CoreDEX is viable on Polkadot Hub and what happens end-to-end at execution time.

At a high level, CoreDEX needs all three of these properties at once:

1. **Expressive product state machines** (forwards, options, vault lending) with strict invariants.
2. **Deterministic pricing/oracle computation** that is too awkward or expensive for EVM-only arithmetic.
3. **Delivery-capable settlement** that can drive real cross-chain execution (not only local balance accounting).

Polkadot Hub provides a rare combination that matches those requirements:

- EVM contracts for protocol orchestration.
- Cross-VM EVM <-> PVM calls under `pallet-revive`.
- Runtime precompiles (especially XCM) callable from contracts.
- Native cross-chain message execution for settlement semantics.

CoreDEX is intentionally built to map each responsibility to the correct layer.

### 1) Layered architecture and responsibility split

CoreDEX is not an "EVM app with add-ons"; it is a layered system.

#### A. EVM orchestration layer (Solidity)

Primary contracts in `smart-contracts/contracts`:

- `CoreDexRegistry`
- `CoretimeLedger`
- `ForwardMarket`
- `OptionsEngine`
- `YieldVault`
- `SettlementExecutor`

What this layer owns:

- user-facing lifecycle transitions (create/match/cancel/settle, write/buy/exercise/expire, deposit/borrow/withdraw/claim)
- escrow coordination
- protocol pause controls
- governance address routing
- global consistency constraints via ledger locking

What this layer intentionally does **not** own:

- heavy pricing engines
- deep runtime data read paths
- raw cross-chain transport internals

#### B. PVM compute/data layer (Rust contracts in this repo)

Current deployment uses PVM Rust contracts that expose Solidity-compatible ABI surfaces:

- `CoretimeOracle` (spot/volatility data surface)
- `PricingModule` (premium/IV compute surface)
- `CoretimeNFT` mock (region NFT interface)
- `MockAssets` (DOT/asset-like transfer interface)

These are called from EVM with normal ABI calls; runtime routes execution to PVM based on target address type.

#### C. Runtime precompile/system layer

CoreDEX directly depends on canonical runtime capability, especially:

- `XCM precompile` at `0x00000000000000000000000000000000000a0000` for settlement dispatch.

For assets/NFT surfaces, this repository currently uses mocks to demonstrate the flow, but the contract interfaces are shaped for runtime-backed production substitution.

### 2) Exact execution model: what "cross-VM" means here

In Hub's `pallet-revive` model, EVM contracts do not need a separate protocol to call PVM code. They use familiar ABI calls (`call`/`staticcall`) and receive ABI-encoded return data.

That gives CoreDEX two important properties:

1. **Call-site stability**: Solidity business logic remains unchanged whether backend target is mock PVM contract or production runtime-backed surface.
2. **Atomic local composition**: EVM and PVM calls are composed within one on-chain execution path instead of requiring bridge-like asynchronous indirection for same-chain compute.

Concrete example in `OptionsEngine._getPremium(...)`:

- resolve oracle address from registry
- `staticcall` `spotPrice()`
- `staticcall` `impliedVolatility()`
- resolve pricing module address
- `staticcall` `price_option(...)`
- decode `(premium, delta)`

From the caller's perspective this is normal Solidity ABI I/O; from runtime perspective it is cross-VM dispatch under revive.

### 3) The registry as protocol control plane

`CoreDexRegistry` is not just a convenience map; it is the protocol control plane.

It provides:

- address resolution by key (`resolve(bytes32)`)
- governance-controlled updates
- timelock path for upgrade safety (`proposeUpdate` + `executeUpdate`)
- global pause bit consumed by all state mutating modules

Architectural consequence:

- Product modules are **dependency-injected at runtime** via registry keys.
- Upgrades are operationally centralized and observable.
- Cross-module rewiring is possible without redeploying every caller.

### 4) The ledger as protocol-wide risk kernel

`CoretimeLedger` is the risk kernel for cross-product correctness.

The critical invariant enforced system-wide:

- one region cannot be simultaneously encumbered across multiple active positions.

It tracks:

- region lock state
- locker address
- position type (`FORWARD`, `OPTION`, `VAULT`)
- margin balance by account
- open position counts

Every product module must cooperate with this ledger. Without this, each module might be locally correct but globally unsafe due to double-encumbrance across products.

### 5) End-to-end call trace by product

#### A. Forward product trace

Create ask path:

1. Seller submits `createAsk(regionId, strike, deliveryBlock)`.
2. `ForwardMarket` validates time and strike constraints.
3. Oracle spot sanity check is performed through cross-VM call path.
4. Ledger lock is acquired (`FORWARD_POSITION`).
5. Region NFT transferred to escrow contract.
6. Seller position count increments.

Match path:

1. Buyer calls `matchOrder(orderId)`.
2. Order transitions open -> matched.
3. DOT transferFrom via assets interface into escrow.
4. Buyer margin and position count updated in ledger.

Settlement path:

1. At/after delivery block, `settle(orderId)` is called.
2. `ForwardMarket` delegates settlement orchestration to `SettlementExecutor`.
3. Executor dispatches XCM program through canonical XCM precompile.
4. DOT release and lock/margin updates are finalized according to settlement flow.

Cancel/expire path:

- cancel returns NFT and unlocks ledger when still open.
- expire path after grace window returns assets and cleans state.

#### B. Options product trace

Write call path:

1. Writer calls `writeCall(regionId, strike, expiryBlock)`.
2. Engine computes premium via `_getPremium` (oracle + pricing cross-VM calls).
3. Region lock is acquired in ledger (`OPTION_POSITION`).
4. NFT collateral escrowed.

Write put path:

1. Writer calls `writePut(...)`.
2. Same premium pipeline.
3. DOT strike collateral escrowed through assets interface.
4. Margin bookkeeping updated.

Buy path:

1. Holder calls `buyOption(optionId)`.
2. Premium is transferred from holder to writer.
3. Holder position count updated.

Exercise/expire paths:

- European exercise at exact expiry block.
- Call exercise drives settlement flow and region unlocking.
- Put exercise handles strike release path.
- Expire returns collateral according to option type.

#### C. Vault product trace

Deposit path:

1. Depositor transfers region NFT to vault.
2. Ledger lock acquired (`VAULT_POSITION`).
3. Receipt/deposit state created.

Borrow path:

1. Borrower requests `(coreCount, durationBlocks)`.
2. Utilization-aware rate is computed on-chain.
3. Fee collected via assets interface.
4. Available region is assigned to loan and marked lent.

Return/claim/withdraw:

- return marks loan complete after duration.
- epoch finalization snapshots fees and active deposit count.
- claim distributes pro-rata yield by epoch/receipt.
- withdraw allowed only when specific region is not lent.

### 6) SettlementExecutor and cross-chain semantics

`SettlementExecutor` is where protocol state meets cross-chain execution.

Core responsibilities:

- construct dispatch payload for delivery
- call XCM precompile
- track settlement phase
- handle callback/failure/recovery logic

Why this matters:

- For blockspace derivatives, settlement is not just transferring a local ERC20 balance.
- The protocol needs a chain-native path to execute cross-chain delivery intent.
- XCM precompile provides that runtime-native entry point.

Recovery model:

- Settlements can move through dispatched/confirmed/failed/recovered phases.
- Timeout-gated recovery protects against unresolved states.
- Ledger/margin/position cleanup is tied to settlement outcome paths.

### 7) Interface contract and ABI stability across layers

CoreDEX's interoperability contract is ABI stability, not implementation sameness.

Solidity depends on interfaces:

- `ICoretimeNFT`
- `IAssetsPrecompile`
- `IXcmPrecompile`

As long as selector/encoding/return layouts remain stable, caller logic can remain intact while underlying provider changes (mock PVM contracts today, runtime-backed implementations tomorrow).

This is a central architectural design decision: preserve EVM business logic while allowing execution substrate evolution.

### 8) Determinism, precision, and computation placement

Pricing/oracle paths are computationally sensitive:

- option premium math
- iterative numeric routines (e.g., volatility solving)
- structured fixed-point handling

Placing these in Rust/PVM yields:

- lower compute friction than equivalent EVM-heavy loops
- tighter control over deterministic numeric behavior
- cleaner separation between product state logic and math engines

Meanwhile Solidity handles lifecycle state transitions where composability with user actions and protocol invariants matters most.

### 9) Governance and operability model

Governance surface:

- Registry ownership controls routing/pause/update authority.
- Timelock update mechanism introduces operational delay for safer upgrades.

Operational observability:

- protocol events are standardized in `libraries/Events.sol`.
- custom errors in `libraries/Errors.sol` make failure reasons machine-decodable and gas-efficient.

This is important for indexers, monitoring, and incident response.

### 10) Security and failure-boundary assumptions

Important assumptions and controls:

1. **Pause everywhere**
- mutable operations gate on registry pause flag.

2. **Lock discipline**
- region lock/unlock operations are restricted to registered contracts.

3. **Escrow first**
- assets are taken into escrow before risk-bearing states are created.

4. **Typed failure paths**
- explicit custom errors for state preconditions and transfer failures.

5. **Settlement fallback**
- recovery mechanism for non-finalized cross-chain states.

### 11) Summary: architecture in one sentence

CoreDEX uses Solidity contracts as the deterministic market/state machine, Rust/PVM endpoints as the computation and system-data surface, and runtime XCM precompile as the delivery bridge - all coordinated by a registry-controlled, ledger-enforced risk core.

---
## The three products in detail

### 1. Coretime forwards

**Contracts:** [ForwardMarket.sol](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/contracts/ForwardMarket.sol), [SettlementExecutor.sol](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/contracts/SettlementExecutor.sol), [CoretimeLedger.sol](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/contracts/CoretimeLedger.sol), registry-resolved **CoretimeOracle** and **ICoretimeNFT**.

**Behavior:** Sellers post **asks** with the region ID, strike (DOT), and delivery block. The NFT moves into the market contract **immediately**; buyers **match** by escrowing DOT via the assets interface. Strikes are constrained to a band around **`spotPrice()`** from the oracle to limit absurd off-oracle prints. At delivery, settlement goes through the executor and **XCM precompile** for physical delivery semantics.

Oracle-banded strike validation and escrow:

```128:176:smart-contracts/contracts/ForwardMarket.sol
    function createAsk(
        uint128 regionId,
        uint128 strikePrice,
        uint32  deliveryBlock
    )
        external
        whenNotPaused
        returns (uint256 orderId)
    {
        ...
        _validateStrikePrice(strikePrice);
        ...
        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.lockRegion(regionId, ledger.FORWARD_POSITION());
        ...
        coretimeNFT.transferFrom(msg.sender, address(this), uint256(regionId));
```

Buyer DOT escrow on match:

```198:206:smart-contracts/contracts/ForwardMarket.sol
        bool transferred = IAssetsPrecompile(ASSETS_PRECOMPILE)
            .transferFrom(msg.sender, address(this), uint256(order.strikePriceDOT));
        if (!transferred) revert Errors.DOTTransferFailed(uint256(order.strikePriceDOT));

        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.addMargin(msg.sender, uint256(order.strikePriceDOT));
```

### 2. Coretime options

**Contracts:** [OptionsEngine.sol](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/contracts/OptionsEngine.sol), **PricingModule** (PVM), **CoretimeOracle** (PVM), **CoretimeNFT**, **SettlementExecutor**, **CoretimeLedger**.

**Behavior:** Writers post collateral (NFT for calls, DOT for puts). **Premium is not user-chosen**: `_getPremium` queries the oracle and pricing module (cross-VM). Exercise is **European** (at expiry). Settlement reuses the executor’s XCM path when physical delivery applies.

See the `_getPremium` excerpt in the previous section; it is the integration point between **REVM** and **PVM**.

### 3. Yield vault

**Contracts:** [YieldVault.sol](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/contracts/YieldVault.sol), **CoretimeLedger**, **ICoretimeNFT**, **MockAssets** (testnet).

**Behavior:** Depositors transfer NFTs into the vault and receive receipt IDs; regions are **ledger-locked** as vault positions. Borrowers pay **`fee = coreCount × durationBlocks × rate / RATE_PRECISION`** where **`rate = BASE_RATE × (utilisation² + 1)`**, producing a steepening curve as the pool fills.

Deposit + lock:

```182:214:smart-contracts/contracts/YieldVault.sol
    function deposit(uint128 regionId)
        external
        whenNotPaused
        returns (uint256 receiptTokenId)
    {
        ...
        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.lockRegion(regionId, ledger.VAULT_POSITION());
        ...
        coretimeNFT.transferFrom(msg.sender, address(this), uint256(regionId));
        ledger.incrementPositionCount(msg.sender);
```

Borrow fee and assets pull:

```261:304:smart-contracts/contracts/YieldVault.sol
    function borrow(uint32 coreCount, uint32 durationBlocks)
        external
        whenNotPaused
        returns (uint256 loanId)
    {
        ...
        uint128 rate = currentLendingRate();
        uint128 fee = uint128(
            uint256(coreCount) * uint256(durationBlocks) * uint256(rate) / uint256(RATE_PRECISION)
        );
        ...
        bool feePaid_ = IAssetsPrecompile(ASSETS_PRECOMPILE)
            .transferFrom(msg.sender, address(this), uint256(fee));
```

Utilisation curve:

```419:434:smart-contracts/contracts/YieldVault.sol
    function currentLendingRate() public view returns (uint128 rate) {
        if (totalDeposited == 0) return BASE_RATE;

        uint256 utilisation = (totalLent * RATE_PRECISION) / totalDeposited;
        uint256 utilisationSquared = (utilisation * utilisation) / RATE_PRECISION;

        rate = uint128(
            (uint256(BASE_RATE) * (utilisationSquared + RATE_PRECISION)) / RATE_PRECISION
        );
    }
```

---

## Repository layout

| Path | Contents |
|------|----------|
| [smart-contracts/](https://github.com/SamFelix03/coreDEX/tree/main/smart-contracts) | Hardhat project, Solidity protocol, deploy and simulation scripts |
| [smart-contracts/rust-contracts/](https://github.com/SamFelix03/coreDEX/tree/main/smart-contracts/rust-contracts) | PVM Rust contracts (oracle, pricing, NFT mock, assets mock) |
| [pvm-modules/](https://github.com/SamFelix03/coreDEX/tree/main/pvm-modules) | Reference precompile-oriented Rust modules |
| [reference/docs/](https://github.com/SamFelix03/coreDEX/tree/main/reference/docs) | Requirements and contract specifications |
| [CROSS_VM_ARCHITECTURE.md](https://github.com/SamFelix03/coreDEX/blob/main/CROSS_VM_ARCHITECTURE.md) | Cross-VM diagram, build/deploy commands, production vs hackathon notes |

**Build / deploy (summary):** see [CROSS_VM_ARCHITECTURE.md](https://github.com/SamFelix03/coreDEX/blob/main/CROSS_VM_ARCHITECTURE.md) — `npm run build` in `rust-contracts`, `npm run deploy:pvm:testnet` and related scripts from [package.json](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/package.json).

---

## Conclusion

CoreDEX uses **Agile Coretime NFTs** as the underlying, **Solidity** for composable financial logic, **PVM Rust** for oracle and pricing workloads that are awkward or costly on the EVM alone, and the **XCM precompile** to connect contract-level settlement to **real cross-chain execution**. Together, those pieces implement forwards, options, and vault lending in a way that maps to Polkadot’s actual blockspace economics rather than a synthetic off-chain derivative—a combination that is structurally anchored to **Hub cross-VM execution, PolkaVM, and runtime precompiles**.


