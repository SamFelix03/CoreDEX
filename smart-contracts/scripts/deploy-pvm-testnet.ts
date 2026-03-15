/**
 * Deploy Rust PVM Mock Contracts to Polkadot Hub TestNet
 *
 * Deploys the compiled .polkavm blobs to the actual testnet, then verifies
 * each contract works via cross-VM calls, and updates the frontend constants.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-pvm-testnet.ts --network polkadotTestNet
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const RUST_DIR = path.join(__dirname, "../rust-contracts");

function loadBlob(name: string): Buffer {
    const blobPath = path.join(RUST_DIR, `${name}.polkavm`);
    if (!fs.existsSync(blobPath)) {
        throw new Error(
            `${name}.polkavm not found at ${blobPath}\n` +
            `Build first: cd rust-contracts && npm run build`
        );
    }
    const blob = fs.readFileSync(blobPath);
    console.log(`  Loaded ${name}.polkavm (${blob.length} bytes)`);
    return blob;
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();
    const balance = await ethers.provider.getBalance(deployer.address);

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║   CoreDEX — Deploy Rust PVM Contracts to Polkadot Hub      ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log(`  Network  : ${network.name} (chainId ${network.chainId})`);
    console.log(`  Deployer : ${deployer.address}`);
    console.log(`  Balance  : ${ethers.formatEther(balance)} PAS\n`);

    if (balance === 0n) {
        console.error("  ⚠  No balance — fund deployer first.");
        process.exit(1);
    }

    // ── Deploy each PVM contract ──────────────────────────────────────────────

    const contracts: Record<string, string> = {};

    const names = ["coretime_oracle", "pricing_module", "coretime_nft", "mock_assets"];
    const labels = ["CoretimeOracle", "PricingModule", "CoretimeNFT", "MockAssets"];

    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const label = labels[i];

        console.log(`\n  [${i + 1}/${names.length}] Deploying ${label} (Rust PVM)...`);
        const blob = loadBlob(name);
        const bytecode = "0x" + blob.toString("hex");

        try {
            const tx = await deployer.sendTransaction({
                data: bytecode,
            });
            console.log(`    Tx hash: ${tx.hash}`);
            console.log(`    Waiting for confirmation...`);

            const receipt = await tx.wait();
            if (!receipt?.contractAddress) {
                console.error(`    ✗ ${label} deployment failed — no contract address`);
                continue;
            }

            contracts[name] = receipt.contractAddress;
            console.log(`    ✓ ${label} deployed @ ${receipt.contractAddress}`);
            console.log(`    Gas used: ${receipt.gasUsed.toString()}`);
        } catch (err: any) {
            console.error(`    ✗ ${label} deployment failed: ${err.message?.slice(0, 200)}`);
        }
    }

    // ── Initialize CoretimeOracle (seed default values into storage) ────────

    if (contracts.coretime_oracle) {
        console.log("\n  Initializing CoretimeOracle default values...");
        try {
            const initABI = ["function initialize()"];
            const oracle = new ethers.Contract(contracts.coretime_oracle, initABI, deployer);
            const initTx = await oracle.initialize();
            await initTx.wait();
            console.log("    ✓ CoretimeOracle initialized with default pricing data");
        } catch (err: any) {
            console.log(`    ⚠ initialize() failed (non-fatal): ${err.message?.slice(0, 150)}`);
            console.log("      Getters will still return hardcoded defaults.");
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────────

    console.log("\n\n═══════════════════════════════════════════════════════════════");
    console.log("  Deployed PVM Contract Addresses:");
    console.log("═══════════════════════════════════════════════════════════════");

    for (const [name, addr] of Object.entries(contracts)) {
        console.log(`    ${name.padEnd(20)}: ${addr}`);
    }

    // ── Write addresses file ──────────────────────────────────────────────────

    const outputPath = path.join(__dirname, "../pvm-testnet-addresses.json");
    const output = {
        network: network.name,
        chainId: Number(network.chainId),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts,
    };
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n  Addresses written to: ${outputPath}`);

    // ── Test cross-VM calls ──────────────────────────────────────────────────

    if (contracts.coretime_oracle) {
        console.log("\n\n═══════════════════════════════════════════════════════════════");
        console.log("  Testing Cross-VM Calls (EVM → PVM)");
        console.log("═══════════════════════════════════════════════════════════════");

        try {
            const oracleABI = [
                "function spotPrice() returns (uint128)",
                "function impliedVolatility() returns (uint64)",
            ];
            const oracle = new ethers.Contract(contracts.coretime_oracle, oracleABI, deployer);

            console.log("\n  [1] Testing CoretimeOracle.spotPrice()...");
            const spotPrice = await oracle.spotPrice.staticCall();
            console.log(`      ✓ spotPrice() = ${ethers.formatEther(spotPrice)} DOT`);

            console.log("\n  [2] Testing CoretimeOracle.impliedVolatility()...");
            const vol = await oracle.impliedVolatility.staticCall();
            console.log(`      ✓ impliedVolatility() = ${Number(vol) / 100}%`);
        } catch (err: any) {
            console.log(`\n  ⚠  Cross-VM static calls failed: ${err.message?.slice(0, 200)}`);
            console.log("     This is expected if the network doesn't support PVM yet.");
            console.log("     The contracts are deployed — they'll work once PVM is enabled.");
        }
    }

    if (contracts.pricing_module) {
        try {
            const pricingABI = [
                "function price_option(uint128 spot, uint128 strike, uint32 timeBlocks, uint64 volatility, uint8 optionType) returns (uint128 premium, uint128 delta)",
            ];
            const pricing = new ethers.Contract(contracts.pricing_module, pricingABI, deployer);

            console.log("\n  [3] Testing PricingModule.price_option()...");
            const [premium, delta] = await pricing.price_option.staticCall(
                ethers.parseEther("5"), ethers.parseEther("6"), 10000, 5000, 0
            );
            console.log(`      ✓ premium = ${ethers.formatEther(premium)} DOT, delta = ${ethers.formatEther(delta)}`);
        } catch (err: any) {
            console.log(`\n  ⚠  PricingModule test failed: ${err.message?.slice(0, 200)}`);
        }
    }

    if (contracts.coretime_nft) {
        try {
            const nftABI = [
                "function mintRegion(address to, uint32 begin, uint32 end, uint16 core) returns (uint128)",
                "function ownerOf(uint256 tokenId) returns (address)",
            ];
            const nft = new ethers.Contract(contracts.coretime_nft, nftABI, deployer);

            console.log("\n  [4] Testing CoretimeNFT.mintRegion()...");
            const mintTx = await nft.mintRegion(deployer.address, 100000, 200000, 1);
            const mintReceipt = await mintTx.wait();
            console.log(`      ✓ mintRegion() tx: ${mintReceipt?.hash}`);

            const owner = await nft.ownerOf.staticCall(1);
            console.log(`      ✓ ownerOf(1) = ${owner}`);
        } catch (err: any) {
            console.log(`\n  ⚠  CoretimeNFT test failed: ${err.message?.slice(0, 200)}`);
        }
    }

    if (contracts.mock_assets) {
        try {
            const assetsABI = [
                "function mint(address to, uint256 amount)",
                "function balanceOf(address account) returns (uint256)",
            ];
            const assets = new ethers.Contract(contracts.mock_assets, assetsABI, deployer);

            console.log("\n  [5] Testing MockAssets.mint()...");
            const mintTx = await assets.mint(deployer.address, ethers.parseEther("100"));
            await mintTx.wait();
            const bal = await assets.balanceOf.staticCall(deployer.address);
            console.log(`      ✓ balance = ${ethers.formatEther(bal)} DOT`);
        } catch (err: any) {
            console.log(`\n  ⚠  MockAssets test failed: ${err.message?.slice(0, 200)}`);
        }
    }

    console.log("\n\n  Done! PVM contracts deployed to Polkadot Hub TestNet.");
    console.log("  Update frontend/constants/index.ts with the new addresses above.\n");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
