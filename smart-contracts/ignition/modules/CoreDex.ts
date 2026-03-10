import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "ethers";

// DEPLOYMENT ORDER (from requirements spec §9):
//   1. CoretimeOracle (PVM)  — pre-deployed as runtime precompile
//   2. PricingModule (PVM)   — pre-deployed as runtime precompile
//   3. CoreDexRegistry       — central router, governance address
//   4. CoretimeLedger        — accounting, needs registry
//   5. ForwardMarket         — order book, needs registry + NFT precompile
//   6. OptionsEngine         — options, needs registry + NFT precompile
//   7. YieldVault            — lending vault, needs registry + NFT precompile
//   8. SettlementExecutor    — XCM settlement, needs registry + NFT precompile
//
// PVM precompile addresses must be registered in the pallet-revive runtime
// BEFORE deploying Solidity contracts.

// Registry keys (keccak256 hashes of contract names)
const KEY_CORETIME_ORACLE = ethers.keccak256(ethers.toUtf8Bytes("CoretimeOracle"));
const KEY_PRICING_MODULE  = ethers.keccak256(ethers.toUtf8Bytes("PricingModule"));
const KEY_LEDGER          = ethers.keccak256(ethers.toUtf8Bytes("CoretimeLedger"));
const KEY_FORWARD_MARKET  = ethers.keccak256(ethers.toUtf8Bytes("ForwardMarket"));
const KEY_OPTIONS_ENGINE  = ethers.keccak256(ethers.toUtf8Bytes("OptionsEngine"));
const KEY_YIELD_VAULT     = ethers.keccak256(ethers.toUtf8Bytes("YieldVault"));
const KEY_SETTLEMENT      = ethers.keccak256(ethers.toUtf8Bytes("SettlementExecutor"));

const CoreDexModule = buildModule("CoreDex", (m) => {

    // -------------------------------------------------------------------------
    // Parameters
    // -------------------------------------------------------------------------

    const governance = m.getParameter("governance");
    const coretimeNFT = m.getParameter(
        "coretimeNFT",
        "0x0000000000000000000000000000000000000805"
    );
    const coretimeOracleAddress = m.getParameter(
        "coretimeOracle",
        "0x0000000000000000000000000000000000002001"
    );
    const pricingModuleAddress = m.getParameter(
        "pricingModule",
        "0x0000000000000000000000000000000000002002"
    );

    // -------------------------------------------------------------------------
    // 3. CoreDexRegistry
    // -------------------------------------------------------------------------

    const registry = m.contract("CoreDexRegistry", [governance]);

    // Register PVM precompile addresses in registry
    const regOracle = m.call(registry, "register", [KEY_CORETIME_ORACLE, coretimeOracleAddress], {
        id: "register_oracle",
    });

    const regPricing = m.call(registry, "register", [KEY_PRICING_MODULE, pricingModuleAddress], {
        id: "register_pricing",
    });

    // -------------------------------------------------------------------------
    // 4. CoretimeLedger
    // -------------------------------------------------------------------------

    const ledger = m.contract("CoretimeLedger", [registry], {
        after: [regOracle, regPricing],
    });

    const regLedger = m.call(registry, "register", [KEY_LEDGER, ledger], {
        id: "register_ledger",
        after: [ledger],
    });

    // -------------------------------------------------------------------------
    // 5. ForwardMarket
    // -------------------------------------------------------------------------

    const forwardMarket = m.contract("ForwardMarket", [registry, coretimeNFT], {
        after: [regLedger],
    });

    const regForward = m.call(registry, "register", [KEY_FORWARD_MARKET, forwardMarket], {
        id: "register_forward",
        after: [forwardMarket],
    });

    // -------------------------------------------------------------------------
    // 6. OptionsEngine
    // -------------------------------------------------------------------------

    const optionsEngine = m.contract("OptionsEngine", [registry, coretimeNFT], {
        after: [regLedger],
    });

    const regOptions = m.call(registry, "register", [KEY_OPTIONS_ENGINE, optionsEngine], {
        id: "register_options",
        after: [optionsEngine],
    });

    // -------------------------------------------------------------------------
    // 7. YieldVault
    // -------------------------------------------------------------------------

    const yieldVault = m.contract("YieldVault", [registry, coretimeNFT], {
        after: [regLedger],
    });

    const regVault = m.call(registry, "register", [KEY_YIELD_VAULT, yieldVault], {
        id: "register_vault",
        after: [yieldVault],
    });

    // -------------------------------------------------------------------------
    // 8. SettlementExecutor
    // -------------------------------------------------------------------------

    const settlementExecutor = m.contract("SettlementExecutor", [registry, coretimeNFT], {
        after: [regLedger],
    });

    const regSettlement = m.call(registry, "register", [KEY_SETTLEMENT, settlementExecutor], {
        id: "register_settlement",
        after: [settlementExecutor],
    });

    return {
        registry,
        ledger,
        forwardMarket,
        optionsEngine,
        yieldVault,
        settlementExecutor,
    };
});

export default CoreDexModule;
