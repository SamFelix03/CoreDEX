# CoreDEX

## Important links

| Resource | Link |
|----------|------|
| Smart contracts (Solidity, Hardhat) | [github.com/SamFelix03/coreDEX/tree/main/smart-contracts](https://github.com/SamFelix03/coreDEX/tree/main/smart-contracts) |
| Rust PVM contracts (PolkaVM binaries built from `rust-contracts`) | [github.com/SamFelix03/coreDEX/tree/main/smart-contracts/rust-contracts](https://github.com/SamFelix03/coreDEX/tree/main/smart-contracts/rust-contracts) |
| PVM precompiles (reference Substrate / precompile implementations) | [github.com/SamFelix03/coreDEX/tree/main/pvm-modules](https://github.com/SamFelix03/coreDEX/tree/main/pvm-modules) |
| Demo video | *Link to be added.* |
| Pitch deck | *Link to be added.* |

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

## How Polkadot Hub’s architecture enables CoreDEX

This stack is **not** a generic “EVM dApp ported to another chain.” It depends on Hub-specific execution and precompiles.

### Cross-VM Solidity ↔ PVM

`pallet-revive` lets an EVM contract treat a PVM contract like any other address: **cross-VM calls reuse standard ABI encoding**. The options engine pulls `spotPrice()` and `impliedVolatility()` from the oracle, then calls `price_option` on the pricing module—all via `staticcall`, which the runtime routes to PolkaVM when the target is a PVM program.

Relevant implementation ([OptionsEngine.sol](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/contracts/OptionsEngine.sol)):

```359:394:smart-contracts/contracts/OptionsEngine.sol
    function _getPremium(
        uint128 strike,
        uint32  expiryBlock,
        uint8   optionType
    ) internal view returns (uint128 premium) {
        // Get spot price and volatility from CoretimeOracle
        address oracleAddr = registry.resolve(KEY_CORETIME_ORACLE);

        (bool spotSuccess, bytes memory spotResult) = oracleAddr.staticcall(
            abi.encodeWithSignature("spotPrice()")
        );
        ...
        (bool volSuccess, bytes memory volResult) = oracleAddr.staticcall(
            abi.encodeWithSignature("impliedVolatility()")
        );
        ...
        address pricingAddr = registry.resolve(KEY_PRICING_MODULE);
        bytes memory calldata_ = abi.encodeWithSignature(
            "price_option(uint128,uint128,uint32,uint64,uint8)",
            spotPrice,
            strike,
            expiryBlock - uint32(block.number),
            volatility,
            optionType
        );

        (bool success, bytes memory result) = pricingAddr.staticcall(calldata_);
        ...
        (premium, ) = abi.decode(result, (uint128, uint128));
    }
```

The PVM side exposes the same selectors and return layout as Solidity would; see [pricing_module.rs](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/rust-contracts/src/pricing_module.rs) (`SEL_PRICE_OPTION`, `handle_price_option`, ABI-encoded returns).

### PVM Rust modules (oracle and pricing)

- **[coretime_oracle.rs](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/rust-contracts/src/coretime_oracle.rs)** — Documented path to **Broker pallet storage reads** in production; the mock build uses contract storage and fixed defaults to emulate oracle outputs while preserving **cross-VM callability** and selector compatibility (see module header: `spotPrice`, `impliedVolatility`, etc.).
- **[pricing_module.rs](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/rust-contracts/src/pricing_module.rs)** — Black-Scholes-style pricing in a tight RISC-V loop; avoids EVM costs for sqrt / norm-like math paths described in [CROSS_VM_ARCHITECTURE.md](https://github.com/SamFelix03/coreDEX/blob/main/CROSS_VM_ARCHITECTURE.md).

Reference precompile-style Rust in [pvm-modules](https://github.com/SamFelix03/coreDEX/tree/main/pvm-modules) (e.g. `precompiles/`).

### XCM precompile (real runtime hook)

[SettlementExecutor.sol](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/contracts/SettlementExecutor.sol) pins the **canonical XCM precompile** and dispatches SCALE-encoded programs through it:

```43:47:smart-contracts/contracts/SettlementExecutor.sol
    /// @notice XCM Precompile — REAL Polkadot Hub precompile address.
    ///         This is the canonical address provided by the Polkadot runtime.
    ///         See: https://docs.polkadot.com/develop/smart-contracts/precompiles/xcm-precompile/
    address public constant XCM_PRECOMPILE =
        0x00000000000000000000000000000000000a0000;
```

```365:376:smart-contracts/contracts/SettlementExecutor.sol
    function _dispatchNFTDelivery(uint128 regionId, address buyer)
        internal
        returns (bytes32 xcmHash)
    {
        bytes memory xcmProgram = _buildNFTDeliveryXcm(regionId, buyer);

        bool success = IXcmPrecompile(XCM_PRECOMPILE)
            .execute(xcmProgram, DEFAULT_REF_TIME);
```

That pattern is what ties **contract escrow on Hub** to **cross-chain delivery** of the underlying coretime NFT representation. Interface: [IXcmPrecompile.sol](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/contracts/interfaces/IXcmPrecompile.sol).

### Assets path (testnet vs production)

EVM contracts use [IAssetsPrecompile.sol](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/contracts/interfaces/IAssetsPrecompile.sol) against **`MockAssets`** on this deployment; [CROSS_VM_ARCHITECTURE.md](https://github.com/SamFelix03/coreDEX/blob/main/CROSS_VM_ARCHITECTURE.md) notes substitution with the **real Assets precompile** in production while **keeping call sites stable**.

### Global encumbrance ledger

[CoretimeLedger.sol](https://github.com/SamFelix03/coreDEX/blob/main/smart-contracts/contracts/CoretimeLedger.sol) centralizes **region locks** so a coretime region cannot back a forward, option, and vault position simultaneously (`FORWARD_POSITION`, `OPTION_POSITION`, `VAULT_POSITION`). Every product module must cooperate with this constraint.

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
