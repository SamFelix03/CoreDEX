/**
 * Individual ForwardMarket Test with 2 Users
 * Tests: createAsk, matchOrder, settle
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
    console.log("║         ForwardMarket Individual Test (2 Users)            ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    
    console.log(`  User1 (Seller): ${user1.address}`);
    console.log(`  User2 (Buyer):  ${user2.address}\n`);

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

    const ForwardMarket = await ethers.getContractFactory("ForwardMarket");
    const forwardMarket = ForwardMarket.attach(deployed.forwardMarket);

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
    // Test 1: createAsk
    // =========================================================================
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  [Test 1] User1 creates ask order");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const spotPrice = await oracle.spotPrice.staticCall();
    const strikePrice = spotPrice * 120n / 100n; // 20% above spot
    const currentBlock = await ethers.provider.getBlockNumber();
    const deliveryBlock = currentBlock + 10000;

    console.log(`  Spot price: ${ethers.formatEther(spotPrice)} DOT`);
    console.log(`  Strike price: ${ethers.formatEther(strikePrice)} DOT (within ±50% band)`);
    console.log(`  Delivery block: ${deliveryBlock} (current: ${currentBlock})\n`);

    try {
        const createTx = await forwardMarket.connect(user1).createAsk(regionId, strikePrice, deliveryBlock);
        const createReceipt = await createTx.wait();
        console.log(`  ✓ createAsk successful! Tx: ${createReceipt?.hash}`);

        const orderId = await forwardMarket.nextOrderId.staticCall() - 1n;
        const order = await forwardMarket.orders.staticCall(orderId);
        console.log(`  Order ${orderId} created:`);
        console.log(`    Seller: ${order.seller}`);
        console.log(`    Region: ${order.coretimeRegion}`);
        console.log(`    Strike: ${ethers.formatEther(order.strikePriceDOT)} DOT`);
        console.log(`    Delivery: ${order.deliveryBlock}`);
        console.log(`    Status: ${order.status} (0=Open)\n`);
    } catch (e: any) {
        console.log(`  ✗ createAsk failed: ${e.message}`);
        if (e.reason) console.log(`    Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`    Error data: ${e.data}`);
        }
        return;
    }

    // =========================================================================
    // Test 2: matchOrder
    // =========================================================================
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  [Test 2] User2 matches order");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const orderId = await forwardMarket.nextOrderId.staticCall() - 1n;
    const orderBefore = await forwardMarket.orders.staticCall(orderId);
    
    console.log(`  Matching order ${orderId}...`);
    console.log(`  User2 balance before: ${ethers.formatEther(await assets.balanceOf.staticCall(user2.address))} DOT\n`);

    try {
        const matchTx = await forwardMarket.connect(user2).matchOrder(orderId);
        const matchReceipt = await matchTx.wait();
        console.log(`  ✓ matchOrder successful! Tx: ${matchReceipt?.hash}`);

        const orderAfter = await forwardMarket.orders.staticCall(orderId);
        console.log(`  Order ${orderId} after match:`);
        console.log(`    Buyer: ${orderAfter.buyer}`);
        console.log(`    Status: ${orderAfter.status} (1=Matched)`);

        // Check balances
        const user2BalanceAfter = await assets.balanceOf.staticCall(user2.address);
        const fmBalance = await assets.balanceOf.staticCall(deployed.forwardMarket);
        console.log(`  User2 balance after: ${ethers.formatEther(user2BalanceAfter)} DOT`);
        console.log(`  ForwardMarket balance: ${ethers.formatEther(fmBalance)} DOT`);
        console.log(`  Expected ForwardMarket balance: ${ethers.formatEther(strikePrice)} DOT\n`);
    } catch (e: any) {
        console.log(`  ✗ matchOrder failed: ${e.message}`);
        if (e.reason) console.log(`    Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`    Error data: ${e.data}`);
            // Try to decode
            try {
                const iface = new ethers.Interface([
                    "error Unauthorised(address)",
                    "error OrderNotFound(uint256)",
                    "error OrderNotOpen(uint256)",
                    "error DOTTransferFailed(uint256)",
                ]);
                const decoded = iface.parseError(e.data);
                console.log(`    Decoded error: ${decoded.name}(${decoded.args})`);
            } catch {}
        }
        return;
    }

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              ForwardMarket Test Complete                  ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
}

main().catch(console.error);
