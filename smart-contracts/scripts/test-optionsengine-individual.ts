/**
 * Individual OptionsEngine Test with 2 Users
 * Tests: writeCall, buyOption, exerciseCall
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DEPLOYED_ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");
const PVM_ADDRESSES_FILE = path.join(__dirname, "../pvm-testnet-addresses.json");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    // Create user2 from private key
    const user2PrivateKey = process.env.USER2_PRIVATE_KEY;
    if (!user2PrivateKey) {
        throw new Error("USER2_PRIVATE_KEY environment variable is required");
    }
    const user2Wallet = new ethers.Wallet(user2PrivateKey, ethers.provider);
    const user1 = deployer;
    const user2 = user2Wallet;
    
    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║         OptionsEngine Individual Test (2 Users)            ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    
    console.log(`  User1 (Writer): ${user1.address}`);
    console.log(`  User2 (Buyer/Holder): ${user2.address}\n`);

    // Load addresses
    const deployed = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_FILE, "utf-8"));
    const pvmAddresses = JSON.parse(fs.readFileSync(PVM_ADDRESSES_FILE, "utf-8"));

    // Setup contracts
    const nft = new ethers.Contract(
        pvmAddresses.contracts.coretime_nft,
        [
            "function mintRegion(address,uint32,uint32,uint16) returns (uint128)",
            "function ownerOf(uint256) view returns (address)",
        ],
        deployer
    );
    
    const assets = new ethers.Contract(
        pvmAddresses.contracts.mock_assets,
        [
            "function mint(address,uint256)",
            "function balanceOf(address) view returns (uint256)",
        ],
        deployer
    );
    
    const oracle = new ethers.Contract(
        pvmAddresses.contracts.coretime_oracle,
        ["function spotPrice() view returns (uint128)"],
        deployer
    );

    const OptionsEngine = await ethers.getContractFactory("OptionsEngine");
    const optionsEngine = OptionsEngine.attach(deployed.optionsEngine);

    // =========================================================================
    // Setup: Mint NFT and DOT
    // =========================================================================
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  [Setup] Minting NFT and DOT");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const regionId = await nft.mintRegion.staticCall(user1.address, 100000, 200000, 1);
    const mintNftTx = await nft.mintRegion(user1.address, 100000, 200000, 1);
    await mintNftTx.wait();
    console.log(`  ✓ Minted NFT region ${regionId} to user1`);

    const mintAssets1Tx = await assets.mint(user1.address, ethers.parseEther("10000"));
    await mintAssets1Tx.wait();
    const balance1 = await assets.balanceOf.staticCall(user1.address);
    console.log(`  ✓ Minted ${ethers.formatEther(balance1)} DOT to user1`);

    const mintAssets2Tx = await assets.mint(user2.address, ethers.parseEther("10000"));
    await mintAssets2Tx.wait();
    const balance2 = await assets.balanceOf.staticCall(user2.address);
    console.log(`  ✓ Minted ${ethers.formatEther(balance2)} DOT to user2\n`);

    // =========================================================================
    // Test 1: writeCall
    // =========================================================================
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  [Test 1] User1 writes call option");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const spotPrice = await oracle.spotPrice.staticCall();
    const strikePrice = spotPrice * 120n / 100n; // 20% above spot
    const currentBlock = await ethers.provider.getBlockNumber();
    const expiryBlock = currentBlock + 10000;

    console.log(`  Spot price: ${ethers.formatEther(spotPrice)} DOT`);
    console.log(`  Strike price: ${ethers.formatEther(strikePrice)} DOT (within ±50% band)`);
    console.log(`  Expiry block: ${expiryBlock} (current: ${currentBlock})\n`);

    try {
        const writeTx = await optionsEngine.connect(user1).writeCall(regionId, strikePrice, expiryBlock);
        const writeReceipt = await writeTx.wait();
        console.log(`  ✓ writeCall successful! Tx: ${writeReceipt?.hash}`);

        const optionId = await optionsEngine.nextOptionId.staticCall() - 1n;
        const option = await optionsEngine.options.staticCall(optionId);
        console.log(`  Option ${optionId} created:`);
        console.log(`    Writer: ${option.writer}`);
        console.log(`    Region: ${option.coretimeRegion}`);
        console.log(`    Strike: ${ethers.formatEther(option.strikePriceDOT)} DOT`);
        console.log(`    Expiry: ${option.expiryBlock}`);
        console.log(`    Premium: ${ethers.formatEther(option.premiumDOT)} DOT`);
        console.log(`    Status: ${option.status} (0=Open)\n`);
    } catch (e: any) {
        console.log(`  ✗ writeCall failed: ${e.message}`);
        if (e.reason) console.log(`    Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`    Error data: ${e.data}`);
        }
        return;
    }

    // =========================================================================
    // Test 2: buyOption
    // =========================================================================
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  [Test 2] User2 buys option");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const optionId = await optionsEngine.nextOptionId.staticCall() - 1n;
    const optionBefore = await optionsEngine.options.staticCall(optionId);
    const premium = optionBefore.premiumDOT;
    
    console.log(`  Buying option ${optionId}...`);
    console.log(`  Premium: ${ethers.formatEther(premium)} DOT`);
    console.log(`  User2 balance before: ${ethers.formatEther(await assets.balanceOf.staticCall(user2.address))} DOT\n`);

    try {
        const buyTx = await optionsEngine.connect(user2).buyOption(optionId);
        const buyReceipt = await buyTx.wait();
        console.log(`  ✓ buyOption successful! Tx: ${buyReceipt?.hash}`);

        const optionAfter = await optionsEngine.options.staticCall(optionId);
        console.log(`  Option ${optionId} after purchase:`);
        console.log(`    Holder: ${optionAfter.holder}`);
        console.log(`    Status: ${optionAfter.status} (1=Active)`);

        // Check balances
        const user2BalanceAfter = await assets.balanceOf.staticCall(user2.address);
        const user1BalanceAfter = await assets.balanceOf.staticCall(user1.address);
        console.log(`  User2 balance after: ${ethers.formatEther(user2BalanceAfter)} DOT`);
        console.log(`  User1 balance after: ${ethers.formatEther(user1BalanceAfter)} DOT`);
        console.log(`  Premium should have been transferred to user1\n`);
    } catch (e: any) {
        console.log(`  ✗ buyOption failed: ${e.message}`);
        if (e.reason) console.log(`    Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`    Error data: ${e.data}`);
        }
        return;
    }

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              OptionsEngine Test Complete                  ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    console.log("Note: Exercise test requires waiting for expiry block, skipping for now.\n");
}

main().catch(console.error);
