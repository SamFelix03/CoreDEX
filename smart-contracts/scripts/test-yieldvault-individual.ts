/**
 * Individual YieldVault Test with 2 Users
 * Tests: depositRegion, borrowRegion, returnRegion, withdrawRegion
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
    console.log("║         YieldVault Individual Test (2 Users)             ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    
    console.log(`  User1 (Depositor/Lender): ${user1.address}`);
    console.log(`  User2 (Borrower):        ${user2.address}\n`);

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

    const YieldVault = await ethers.getContractFactory("YieldVault");
    const yieldVault = YieldVault.attach(deployed.yieldVault);

    // =========================================================================
    // Setup: Mint NFT and DOT
    // =========================================================================
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  [Setup] Minting NFT and DOT");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Use a unique region ID to avoid conflicts
    const startBlock = 200000 + Math.floor(Date.now() / 1000);
    const endBlock = startBlock + 100000;
    const regionId = await nft.mintRegion.staticCall(user1.address, startBlock, endBlock, 1);
    const mintNftTx = await nft.mintRegion(user1.address, startBlock, endBlock, 1);
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
    // Test 1: depositRegion
    // =========================================================================
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  [Test 1] User1 deposits region");
    console.log("═══════════════════════════════════════════════════════════════\n");

    try {
        const depositTx = await yieldVault.connect(user1).deposit(regionId);
        const depositReceipt = await depositTx.wait();
        console.log(`  ✓ depositRegion successful! Tx: ${depositReceipt?.hash}`);

        // Check NFT ownership (should be transferred to vault)
        const owner = await nft.ownerOf.staticCall(regionId);
        console.log(`  NFT owner after deposit: ${owner}`);
        console.log(`  Expected: ${deployed.yieldVault}`);
        
        // Check deposit count
        const depositCount = await yieldVault.totalDeposited.staticCall();
        console.log(`  Total deposits: ${depositCount}\n`);
    } catch (e: any) {
        console.log(`  ✗ depositRegion failed: ${e.message}`);
        if (e.reason) console.log(`    Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`    Error data: ${e.data}`);
        }
        return;
    }

    // =========================================================================
    // Test 2: borrowRegion
    // =========================================================================
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  [Test 2] User2 borrows region");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const durationBlocks = 1000;
    const coreCount = 1;
    
    console.log(`  Borrowing region for ${durationBlocks} blocks (${coreCount} core)...`);
    console.log(`  User2 balance before: ${ethers.formatEther(await assets.balanceOf.staticCall(user2.address))} DOT\n`);

    try {
        // Get fee from the contract (it's calculated in borrow function)
        // For now, just proceed with borrow - fee will be calculated internally
        console.log(`  Borrowing ${coreCount} core(s) for ${durationBlocks} blocks...\n`);

        const borrowTx = await yieldVault.connect(user2).borrow(coreCount, durationBlocks);
        const borrowReceipt = await borrowTx.wait();
        console.log(`  ✓ borrowRegion successful! Tx: ${borrowReceipt?.hash}`);

        // Check loan
        const loanId = await yieldVault.nextLoanId.staticCall() - 1n;
        try {
            const loan = await yieldVault.loans.staticCall(loanId);
            console.log(`  Loan ${loanId} created:`);
            console.log(`    Borrower: ${loan.borrower}`);
            console.log(`    Region: ${loan.regionId}`);
            console.log(`    Duration: ${loan.durationBlocks} blocks`);
            console.log(`    Fee: ${ethers.formatEther(loan.feePaid)} DOT`);
            console.log(`    Expiry: ${loan.expiryBlock}`);
        } catch (e) {
            console.log(`  Loan ${loanId} created (unable to read details)`);
        }

        // Check balances
        const user2BalanceAfter = await assets.balanceOf.staticCall(user2.address);
        const vaultBalance = await assets.balanceOf.staticCall(deployed.yieldVault);
        console.log(`  User2 balance after: ${ethers.formatEther(user2BalanceAfter)} DOT`);
        console.log(`  Vault balance: ${ethers.formatEther(vaultBalance)} DOT\n`);
    } catch (e: any) {
        console.log(`  ✗ borrowRegion failed: ${e.message}`);
        if (e.reason) console.log(`    Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`    Error data: ${e.data}`);
        }
        return;
    }

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║              YieldVault Test Complete                     ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");
    console.log("Note: Return and withdraw tests require waiting for loan expiry, skipping for now.\n");
}

main().catch(console.error);
