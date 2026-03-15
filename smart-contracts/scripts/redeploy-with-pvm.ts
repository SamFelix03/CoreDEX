/**
 * Redeploy CoreDEX Contracts with New PVM Addresses
 * 
 * Redeploys ForwardMarket, OptionsEngine, YieldVault, and SettlementExecutor
 * with the new Rust PVM contract addresses (CoretimeNFT and MockAssets).
 * Uses existing Registry and Ledger if they exist, or deploys new ones.
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const PVM_ADDRESSES_FILE = path.join(__dirname, "../pvm-testnet-addresses.json");
const DEPLOYED_ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   Redeploy CoreDEX Contracts with New PVM Addresses      ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log(`  Network  : ${network.name} (chainId ${network.chainId})`);
    console.log(`  Deployer : ${deployer.address}`);
    console.log(`  Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} PAS\n`);

    // Load PVM addresses
    if (!fs.existsSync(PVM_ADDRESSES_FILE)) {
        throw new Error(`PVM addresses file not found: ${PVM_ADDRESSES_FILE}`);
    }
    const pvmAddresses = JSON.parse(fs.readFileSync(PVM_ADDRESSES_FILE, "utf-8"));
    const CORETIME_NFT_ADDRESS = pvmAddresses.contracts.coretime_nft;
    const MOCK_ASSETS_ADDRESS = pvmAddresses.contracts.mock_assets;
    const CORETIME_ORACLE_ADDRESS = pvmAddresses.contracts.coretime_oracle;
    const PRICING_MODULE_ADDRESS = pvmAddresses.contracts.pricing_module;

    console.log("  Using PVM addresses:");
    console.log(`    CoretimeNFT:    ${CORETIME_NFT_ADDRESS}`);
    console.log(`    MockAssets:     ${MOCK_ASSETS_ADDRESS}`);
    console.log(`    CoretimeOracle: ${CORETIME_ORACLE_ADDRESS}`);
    console.log(`    PricingModule:  ${PRICING_MODULE_ADDRESS}\n`);

    // Load or create deployed addresses
    let deployed: Record<string, string> = {};
    if (fs.existsSync(DEPLOYED_ADDRESSES_FILE)) {
        deployed = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_FILE, "utf-8"));
        console.log("  Found existing deployed addresses:");
        console.log(`    Registry: ${deployed.registry || "NOT FOUND"}`);
        console.log(`    Ledger:   ${deployed.ledger || "NOT FOUND"}\n`);
    }

    const addresses: Record<string, string> = { ...deployed };
    const governance = process.env.GOVERNANCE_ADDRESS || deployer.address;

    // =========================================================================
    // Step 1 & 2: PVM addresses (already deployed)
    // =========================================================================

    addresses.coretimeOracle = CORETIME_ORACLE_ADDRESS;
    addresses.pricingModule = PRICING_MODULE_ADDRESS;

    // =========================================================================
    // Step 3: CoreDexRegistry (use existing or deploy new)
    // =========================================================================

    let registry;
    if (deployed.registry) {
        console.log("[3/8] Using existing CoreDexRegistry...");
        const Registry = await ethers.getContractFactory("CoreDexRegistry");
        registry = Registry.attach(deployed.registry);
        console.log(`  Registry: ${deployed.registry}`);
    } else {
        console.log("[3/8] Deploying CoreDexRegistry...");
        const Registry = await ethers.getContractFactory("CoreDexRegistry");
        registry = await Registry.deploy(governance);
        await registry.waitForDeployment();
        addresses.registry = await registry.getAddress();
        console.log(`  Registry: ${addresses.registry}`);
    }

    // Register/update PVM addresses in registry
    console.log("  Registering PVM addresses in registry...");
    const KEY_CORETIME_ORACLE = ethers.keccak256(ethers.toUtf8Bytes("CoretimeOracle"));
    const KEY_PRICING_MODULE = ethers.keccak256(ethers.toUtf8Bytes("PricingModule"));

    try {
        await registry.register(KEY_CORETIME_ORACLE, CORETIME_ORACLE_ADDRESS);
        console.log("  ✓ CoretimeOracle registered");
    } catch (err: any) {
        console.log(`  ⚠ CoretimeOracle registration: ${err.message?.slice(0, 100)}`);
    }

    try {
        await registry.register(KEY_PRICING_MODULE, PRICING_MODULE_ADDRESS);
        console.log("  ✓ PricingModule registered");
    } catch (err: any) {
        console.log(`  ⚠ PricingModule registration: ${err.message?.slice(0, 100)}`);
    }

    // =========================================================================
    // Step 4: CoretimeLedger (use existing or deploy new)
    // =========================================================================

    if (deployed.ledger) {
        console.log("\n[4/8] Using existing CoretimeLedger...");
        console.log(`  Ledger: ${deployed.ledger}`);
    } else {
        console.log("\n[4/8] Deploying CoretimeLedger...");
        const Ledger = await ethers.getContractFactory("CoretimeLedger");
        const ledger = await Ledger.deploy(addresses.registry);
        await ledger.waitForDeployment();
        addresses.ledger = await ledger.getAddress();
        console.log(`  Ledger: ${addresses.ledger}`);

        await registry.register(
            ethers.keccak256(ethers.toUtf8Bytes("CoretimeLedger")),
            addresses.ledger
        );
        console.log("  ✓ Registered in CoreDexRegistry");
    }

    // =========================================================================
    // Step 5: ForwardMarket (REDEPLOY with new addresses)
    // =========================================================================

    console.log("\n[5/8] Deploying ForwardMarket (with new PVM addresses)...");
    const Forward = await ethers.getContractFactory("ForwardMarket");
    const forwardMarket = await Forward.deploy(addresses.registry, CORETIME_NFT_ADDRESS);
    await forwardMarket.waitForDeployment();
    addresses.forwardMarket = await forwardMarket.getAddress();
    console.log(`  ForwardMarket: ${addresses.forwardMarket}`);
    console.log(`  Using CoretimeNFT: ${CORETIME_NFT_ADDRESS}`);
    console.log(`  Using MockAssets:  ${MOCK_ASSETS_ADDRESS} (hardcoded in contract)`);

    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("ForwardMarket")),
        addresses.forwardMarket
    );
    console.log("  ✓ Registered in CoreDexRegistry");

    // =========================================================================
    // Step 6: OptionsEngine (REDEPLOY with new addresses)
    // =========================================================================

    console.log("\n[6/8] Deploying OptionsEngine (with new PVM addresses)...");
    const Options = await ethers.getContractFactory("OptionsEngine");
    const optionsEngine = await Options.deploy(addresses.registry, CORETIME_NFT_ADDRESS);
    await optionsEngine.waitForDeployment();
    addresses.optionsEngine = await optionsEngine.getAddress();
    console.log(`  OptionsEngine: ${addresses.optionsEngine}`);
    console.log(`  Using CoretimeNFT: ${CORETIME_NFT_ADDRESS}`);
    console.log(`  Using MockAssets:  ${MOCK_ASSETS_ADDRESS} (hardcoded in contract)`);

    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("OptionsEngine")),
        addresses.optionsEngine
    );
    console.log("  ✓ Registered in CoreDexRegistry");

    // =========================================================================
    // Step 7: YieldVault (REDEPLOY with new addresses)
    // =========================================================================

    console.log("\n[7/8] Deploying YieldVault (with new PVM addresses)...");
    const Vault = await ethers.getContractFactory("YieldVault");
    const yieldVault = await Vault.deploy(addresses.registry, CORETIME_NFT_ADDRESS);
    await yieldVault.waitForDeployment();
    addresses.yieldVault = await yieldVault.getAddress();
    console.log(`  YieldVault: ${addresses.yieldVault}`);
    console.log(`  Using CoretimeNFT: ${CORETIME_NFT_ADDRESS}`);
    console.log(`  Using MockAssets:  ${MOCK_ASSETS_ADDRESS} (hardcoded in contract)`);

    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("YieldVault")),
        addresses.yieldVault
    );
    console.log("  ✓ Registered in CoreDexRegistry");

    // =========================================================================
    // Step 8: SettlementExecutor (REDEPLOY with new addresses)
    // =========================================================================

    console.log("\n[8/8] Deploying SettlementExecutor (with new PVM addresses)...");
    const Settlement = await ethers.getContractFactory("SettlementExecutor");
    const settlementExecutor = await Settlement.deploy(addresses.registry, CORETIME_NFT_ADDRESS);
    await settlementExecutor.waitForDeployment();
    addresses.settlementExecutor = await settlementExecutor.getAddress();
    console.log(`  SettlementExecutor: ${addresses.settlementExecutor}`);
    console.log(`  Using CoretimeNFT: ${CORETIME_NFT_ADDRESS}`);
    console.log(`  Using MockAssets:  ${MOCK_ASSETS_ADDRESS} (hardcoded in contract)`);

    await registry.register(
        ethers.keccak256(ethers.toUtf8Bytes("SettlementExecutor")),
        addresses.settlementExecutor
    );
    console.log("  ✓ Registered in CoreDexRegistry");

    // =========================================================================
    // Verification
    // =========================================================================

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              DEPLOYMENT COMPLETE                            ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

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

    fs.writeFileSync(DEPLOYED_ADDRESSES_FILE, JSON.stringify(addresses, null, 2));
    console.log(`\nAddresses written to: ${DEPLOYED_ADDRESSES_FILE}`);

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              NEXT STEPS                                     ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log("1. Update frontend/constants/index.ts with new addresses");
    console.log("2. Test the contracts with the new PVM addresses");
    console.log("3. Verify all cross-VM calls work correctly\n");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
