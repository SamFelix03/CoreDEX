import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * CoreDEX Deployment Script
 *
 * DEPLOYMENT ORDER (from requirements spec §9):
 *   1. CoretimeOracle (PVM)  — pre-deployed as runtime precompile
 *   2. PricingModule (PVM)   — pre-deployed as runtime precompile
 *   3. CoreDexRegistry       — central router, governance address
 *   4. CoretimeLedger        — accounting, needs registry
 *   5. ForwardMarket         — order book, needs registry + NFT precompile
 *   6. OptionsEngine         — options, needs registry + NFT precompile
 *   7. YieldVault            — lending vault, needs registry + NFT precompile
 *   8. SettlementExecutor    — XCM settlement, needs registry + NFT precompile
 *
 * PVM precompile addresses must be registered in the pallet-revive runtime
 * BEFORE deploying Solidity contracts. The precompile addresses are:
 *   CoretimeOracle:  0x0000000000000000000000000000000000002001
 *   PricingModule:   0x0000000000000000000000000000000000002002
 */

// Precompile addresses (must match pvm-modules/src/precompile_set.rs)
const CORETIME_ORACLE_ADDRESS  = "0x0000000000000000000000000000000000002001";
const PRICING_MODULE_ADDRESS   = "0x0000000000000000000000000000000000002002";

// System precompile addresses on Asset Hub
const CORETIME_NFT_PRECOMPILE  = process.env.CORETIME_NFT_ADDRESS || "0x0000000000000000000000000000000000000805";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║              CoreDEX Deployment Script                  ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "DOT");
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("");

    const addresses: Record<string, string> = {};
    const governance = process.env.GOVERNANCE_ADDRESS || deployer.address;

    // =========================================================================
    // Step 1 & 2: PVM Precompiles (pre-deployed at fixed addresses)
    // =========================================================================

    console.log("[1/8] CoretimeOracle (PVM) — pre-deployed at", CORETIME_ORACLE_ADDRESS);
    addresses.coretimeOracle = CORETIME_ORACLE_ADDRESS;

    console.log("[2/8] PricingModule (PVM)  — pre-deployed at", PRICING_MODULE_ADDRESS);
    addresses.pricingModule = PRICING_MODULE_ADDRESS;

    // =========================================================================
    // Step 3: CoreDexRegistry
    // =========================================================================

    console.log("\n[3/8] Deploying CoreDexRegistry...");
    const Registry = await ethers.getContractFactory("CoreDexRegistry");
    const registry = await Registry.deploy(governance);
    await registry.waitForDeployment();
    addresses.registry = await registry.getAddress();
    console.log("  CoreDexRegistry:", addresses.registry);

    // Register PVM precompile addresses
    console.log("  Registering PVM precompiles...");
    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("CoretimeOracle")),
        CORETIME_ORACLE_ADDRESS
    );
    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("PricingModule")),
        PRICING_MODULE_ADDRESS
    );
    console.log("  ✓ CoretimeOracle registered");
    console.log("  ✓ PricingModule registered");

    // =========================================================================
    // Step 4: CoretimeLedger
    // =========================================================================

    console.log("\n[4/8] Deploying CoretimeLedger...");
    const Ledger = await ethers.getContractFactory("CoretimeLedger");
    const ledger = await Ledger.deploy(addresses.registry);
    await ledger.waitForDeployment();
    addresses.ledger = await ledger.getAddress();
    console.log("  CoretimeLedger:", addresses.ledger);

    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("CoretimeLedger")),
        addresses.ledger
    );
    console.log("  ✓ Registered in CoreDexRegistry");

    // =========================================================================
    // Step 5: ForwardMarket
    // =========================================================================

    console.log("\n[5/8] Deploying ForwardMarket...");
    const Forward = await ethers.getContractFactory("ForwardMarket");
    const forwardMarket = await Forward.deploy(addresses.registry, CORETIME_NFT_PRECOMPILE);
    await forwardMarket.waitForDeployment();
    addresses.forwardMarket = await forwardMarket.getAddress();
    console.log("  ForwardMarket:", addresses.forwardMarket);

    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("ForwardMarket")),
        addresses.forwardMarket
    );
    console.log("  ✓ Registered in CoreDexRegistry");

    // =========================================================================
    // Step 6: OptionsEngine
    // =========================================================================

    console.log("\n[6/8] Deploying OptionsEngine...");
    const Options = await ethers.getContractFactory("OptionsEngine");
    const optionsEngine = await Options.deploy(addresses.registry, CORETIME_NFT_PRECOMPILE);
    await optionsEngine.waitForDeployment();
    addresses.optionsEngine = await optionsEngine.getAddress();
    console.log("  OptionsEngine:", addresses.optionsEngine);

    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("OptionsEngine")),
        addresses.optionsEngine
    );
    console.log("  ✓ Registered in CoreDexRegistry");

    // =========================================================================
    // Step 7: YieldVault
    // =========================================================================

    console.log("\n[7/8] Deploying YieldVault...");
    const Vault = await ethers.getContractFactory("YieldVault");
    const yieldVault = await Vault.deploy(addresses.registry, CORETIME_NFT_PRECOMPILE);
    await yieldVault.waitForDeployment();
    addresses.yieldVault = await yieldVault.getAddress();
    console.log("  YieldVault:", addresses.yieldVault);

    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("YieldVault")),
        addresses.yieldVault
    );
    console.log("  ✓ Registered in CoreDexRegistry");

    // =========================================================================
    // Step 8: SettlementExecutor
    // =========================================================================

    console.log("\n[8/8] Deploying SettlementExecutor...");
    const Settlement = await ethers.getContractFactory("SettlementExecutor");
    const settlementExecutor = await Settlement.deploy(addresses.registry, CORETIME_NFT_PRECOMPILE);
    await settlementExecutor.waitForDeployment();
    addresses.settlementExecutor = await settlementExecutor.getAddress();
    console.log("  SettlementExecutor:", addresses.settlementExecutor);

    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("SettlementExecutor")),
        addresses.settlementExecutor
    );
    console.log("  ✓ Registered in CoreDexRegistry");

    // =========================================================================
    // Post-deploy verification
    // =========================================================================

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║              DEPLOYMENT COMPLETE                        ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("");
    console.log("Deployed Addresses:");
    console.log("─".repeat(60));
    for (const [name, addr] of Object.entries(addresses)) {
        console.log(`  ${name.padEnd(24)}: ${addr}`);
    }
    console.log("");

    // Verify all contracts are registered
    console.log("Verification:");
    console.log("─".repeat(60));
    const contractKeys = [
        "CoretimeOracle", "PricingModule", "CoretimeLedger",
        "ForwardMarket", "OptionsEngine", "YieldVault", "SettlementExecutor",
    ];

    for (const key of contractKeys) {
        try {
            const resolved = await registry.resolve(ethers.keccak256(ethers.toUtf8Bytes(key)));
            console.log(`  ${key.padEnd(24)}: ${resolved} ✓`);
        } catch {
            console.log(`  ${key.padEnd(24)}: NOT REGISTERED ✗`);
        }
    }

    // =========================================================================
    // Write addresses to file
    // =========================================================================

    const outputPath = path.join(__dirname, "../deployed-addresses.json");
    fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
    console.log("\nAddresses written to:", outputPath);

    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log("║              NEXT STEPS                                 ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log("1. Copy deployed-addresses.json values into frontend/.env.local");
    console.log("2. Update NEXT_PUBLIC_* environment variables for each contract");
    console.log("3. Transfer governance to OpenGov proxy if deploying to mainnet");
    console.log("4. Verify contracts on block explorer");
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
