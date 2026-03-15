/**
 * Update Registry with New PVM Contract Addresses
 * 
 * Updates the CoreDexRegistry with the newly deployed Rust PVM contract addresses.
 * This allows the Solidity contracts to resolve the correct PVM addresses via registry.resolve().
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
    console.log("║   Update Registry with New PVM Addresses                  ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log(`  Network  : ${network.name} (chainId ${network.chainId})`);
    console.log(`  Deployer : ${deployer.address}\n`);

    // Load PVM addresses
    if (!fs.existsSync(PVM_ADDRESSES_FILE)) {
        throw new Error(`PVM addresses file not found: ${PVM_ADDRESSES_FILE}`);
    }
    const pvmAddresses = JSON.parse(fs.readFileSync(PVM_ADDRESSES_FILE, "utf-8"));
    console.log("  Loaded PVM addresses:");
    console.log(`    CoretimeOracle: ${pvmAddresses.contracts.coretime_oracle}`);
    console.log(`    PricingModule:  ${pvmAddresses.contracts.pricing_module}`);
    console.log(`    CoretimeNFT:    ${pvmAddresses.contracts.coretime_nft}`);
    console.log(`    MockAssets:     ${pvmAddresses.contracts.mock_assets}\n`);

    // Load deployed addresses
    if (!fs.existsSync(DEPLOYED_ADDRESSES_FILE)) {
        throw new Error(`Deployed addresses file not found: ${DEPLOYED_ADDRESSES_FILE}`);
    }
    const deployed = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_FILE, "utf-8"));
    const registryAddress = deployed.registry;
    console.log(`  Registry: ${registryAddress}\n`);

    // Connect to registry
    const Registry = await ethers.getContractFactory("CoreDexRegistry");
    const registry = Registry.attach(registryAddress);

    // Registry keys
    const KEY_CORETIME_ORACLE = ethers.keccak256(ethers.toUtf8Bytes("CoretimeOracle"));
    const KEY_PRICING_MODULE = ethers.keccak256(ethers.toUtf8Bytes("PricingModule"));

    // Check current addresses
    console.log("  Current registry values:");
    try {
        const currentOracle = await registry.resolve(KEY_CORETIME_ORACLE);
        console.log(`    CoretimeOracle: ${currentOracle}`);
    } catch {
        console.log(`    CoretimeOracle: NOT REGISTERED`);
    }
    try {
        const currentPricing = await registry.resolve(KEY_PRICING_MODULE);
        console.log(`    PricingModule:  ${currentPricing}`);
    } catch {
        console.log(`    PricingModule:  NOT REGISTERED`);
    }
    console.log();

    // Update addresses
    console.log("  Updating registry...\n");

    // Check if deployer is governance
    const governance = await registry.governance();
    if (deployer.address.toLowerCase() !== governance.toLowerCase()) {
        console.log(`  ⚠  WARNING: Deployer is not governance!`);
        console.log(`     Governance: ${governance}`);
        console.log(`     Deployer:   ${deployer.address}`);
        console.log(`     This will fail unless deployer is governance.\n`);
    }

    // Update CoretimeOracle
    console.log("  [1/2] Updating CoretimeOracle...");
    try {
        const tx1 = await registry.register(KEY_CORETIME_ORACLE, pvmAddresses.contracts.coretime_oracle);
        await tx1.wait();
        console.log(`    ✓ Updated to ${pvmAddresses.contracts.coretime_oracle}`);
    } catch (err: any) {
        console.log(`    ✗ Failed: ${err.message?.slice(0, 200)}`);
    }

    // Update PricingModule
    console.log("  [2/2] Updating PricingModule...");
    try {
        const tx2 = await registry.register(KEY_PRICING_MODULE, pvmAddresses.contracts.pricing_module);
        await tx2.wait();
        console.log(`    ✓ Updated to ${pvmAddresses.contracts.pricing_module}`);
    } catch (err: any) {
        console.log(`    ✗ Failed: ${err.message?.slice(0, 200)}`);
    }

    // Verify
    console.log("\n  Verification:");
    try {
        const verifiedOracle = await registry.resolve(KEY_CORETIME_ORACLE);
        const match1 = verifiedOracle.toLowerCase() === pvmAddresses.contracts.coretime_oracle.toLowerCase();
        console.log(`    CoretimeOracle: ${verifiedOracle} ${match1 ? "✓" : "✗"}`);
    } catch {
        console.log(`    CoretimeOracle: NOT REGISTERED ✗`);
    }
    try {
        const verifiedPricing = await registry.resolve(KEY_PRICING_MODULE);
        const match2 = verifiedPricing.toLowerCase() === pvmAddresses.contracts.pricing_module.toLowerCase();
        console.log(`    PricingModule:  ${verifiedPricing} ${match2 ? "✓" : "✗"}`);
    } catch {
        console.log(`    PricingModule:  NOT REGISTERED ✗`);
    }

    console.log("\n  ⚠  NOTE: ASSETS_PRECOMPILE and CORETIME_NFT are hardcoded in contracts.");
    console.log("     To use new PVM addresses, those contracts need to be redeployed.");
    console.log("     Current hardcoded addresses:");
    console.log(`       ASSETS_PRECOMPILE: 0x0000000000000000000000000000000000000806`);
    console.log(`       CORETIME_NFT:      (passed in constructor)`);
    console.log(`     New PVM addresses:`);
    console.log(`       MockAssets:        ${pvmAddresses.contracts.mock_assets}`);
    console.log(`       CoretimeNFT:       ${pvmAddresses.contracts.coretime_nft}\n`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
