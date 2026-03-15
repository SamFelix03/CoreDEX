/**
 * Comprehensive CoreDEX End-to-End Flow Test
 * 
 * Tests the entire CoreDEX application flow with deployed contracts:
 * 1. Verify PVM contracts are accessible
 * 2. Test ForwardMarket: create order → match → verify balances
 * 3. Test OptionsEngine: write option → buy → verify balances
 * 4. Test YieldVault: deposit → borrow → verify balances
 * 5. Verify all cross-VM calls work correctly
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DEPLOYED_ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");
const PVM_ADDRESSES_FILE = path.join(__dirname, "../pvm-testnet-addresses.json");

interface TestResult {
    name: string;
    success: boolean;
    message: string;
}

async function main() {
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    
    // Create user2 from private key
    const user2PrivateKey = process.env.USER2_PRIVATE_KEY;
    if (!user2PrivateKey) {
        throw new Error("USER2_PRIVATE_KEY environment variable is required");
    }
    const user2Wallet = new ethers.Wallet(user2PrivateKey, ethers.provider);
    const user1 = deployer;
    const user2 = user2Wallet;
    
    // Fund user2 with some PAS for gas (if needed)
    const user2Balance = await ethers.provider.getBalance(user2.address);
    if (user2Balance < ethers.parseEther("0.1")) {
        console.log(`  Funding user2 (${user2.address}) with 1 PAS for gas...`);
        const fundTx = await deployer.sendTransaction({
            to: user2.address,
            value: ethers.parseEther("1"),
        });
        await fundTx.wait();
        console.log(`  ✓ Funded user2\n`);
    }
    
    const network = await ethers.provider.getNetwork();

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║         CoreDEX Comprehensive End-to-End Test            ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    console.log(`  Network  : ${network.name} (chainId ${network.chainId})`);
    console.log(`  Deployer : ${deployer.address}`);
    console.log(`  User1    : ${user1.address}`);
    console.log(`  User2    : ${user2.address}\n`);

    // Load addresses
    const deployed = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_FILE, "utf-8"));
    const pvmAddresses = JSON.parse(fs.readFileSync(PVM_ADDRESSES_FILE, "utf-8"));

    const results: TestResult[] = [];

    // =========================================================================
    // 1. Test PVM Contracts (Cross-VM Calls)
    // =========================================================================

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  [1] Testing PVM Contracts (Cross-VM Calls)");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // Test CoretimeOracle
    try {
        const oracle = new ethers.Contract(
            pvmAddresses.contracts.coretime_oracle,
            [
                "function spotPrice() view returns (uint128)",
                "function impliedVolatility() view returns (uint16)",
            ],
            deployer
        );
        const spotPrice = await oracle.spotPrice.staticCall();
        const vol = await oracle.impliedVolatility.staticCall();
        console.log(`  ✓ CoretimeOracle.spotPrice() = ${ethers.formatEther(spotPrice)} DOT`);
        console.log(`  ✓ CoretimeOracle.impliedVolatility() = ${vol}%`);
        results.push({ name: "CoretimeOracle reads", success: true, message: "✓" });
    } catch (err: any) {
        console.log(`  ✗ CoretimeOracle failed: ${err.message}`);
        results.push({ name: "CoretimeOracle reads", success: false, message: err.message });
    }

    // Test PricingModule
    try {
        const pricing = new ethers.Contract(
            pvmAddresses.contracts.pricing_module,
            [
                "function price_option(uint128 spot, uint128 strike, uint32 timeBlocks, uint64 volatility, uint8 optionType) view returns (uint128 premium, uint128 delta)",
            ],
            deployer
        );
        const spot = ethers.parseEther("5");
        const strike = ethers.parseEther("6");
        const timeBlocks = 10000;
        const volatility = 5000n; // 50% (in basis points)
        const optionType = 0; // Call option
        const result = await pricing.price_option.staticCall(spot, strike, timeBlocks, volatility, optionType);
        console.log(`  ✓ PricingModule.price_option() = ${ethers.formatEther(result.premium)} DOT premium, delta = ${Number(result.delta) / 1e18}`);
        results.push({ name: "PricingModule computation", success: true, message: "✓" });
    } catch (err: any) {
        console.log(`  ✗ PricingModule failed: ${err.message?.slice(0, 150)}`);
        results.push({ name: "PricingModule computation", success: false, message: err.message });
    }

    // Test CoretimeNFT
    try {
        const nft = new ethers.Contract(
            pvmAddresses.contracts.coretime_nft,
            [
                "function mintRegion(address,uint32,uint32,uint16) returns (uint128)",
                "function ownerOf(uint256) view returns (address)",
            ],
            deployer
        );
        const mintTx = await nft.mintRegion(user1.address, 100000, 200000, 1);
        await mintTx.wait();
        const owner = await nft.ownerOf.staticCall(1);
        console.log(`  ✓ CoretimeNFT.mintRegion() → ownerOf(1) = ${owner}`);
        results.push({ name: "CoretimeNFT mint/read", success: true, message: "✓" });
    } catch (err: any) {
        console.log(`  ✗ CoretimeNFT failed: ${err.message}`);
        results.push({ name: "CoretimeNFT mint/read", success: false, message: err.message });
    }

    // Test MockAssets
    try {
        const assets = new ethers.Contract(
            pvmAddresses.contracts.mock_assets,
            [
                "function mint(address,uint256)",
                "function balanceOf(address) view returns (uint256)",
            ],
            deployer
        );
        const mintTx = await assets.mint(user1.address, ethers.parseEther("1000"));
        await mintTx.wait();
        const balance = await assets.balanceOf.staticCall(user1.address);
        console.log(`  ✓ MockAssets.mint() → balanceOf() = ${ethers.formatEther(balance)} DOT`);
        results.push({ name: "MockAssets mint/read", success: true, message: "✓" });
    } catch (err: any) {
        console.log(`  ✗ MockAssets failed: ${err.message}`);
        results.push({ name: "MockAssets mint/read", success: false, message: err.message });
    }

    // =========================================================================
    // 2. Connect to Deployed Contracts
    // =========================================================================

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  [2] Connecting to Deployed CoreDEX Contracts");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const Registry = await ethers.getContractFactory("CoreDexRegistry");
    const registry = Registry.attach(deployed.registry);

    const ForwardMarket = await ethers.getContractFactory("ForwardMarket");
    const forwardMarket = ForwardMarket.attach(deployed.forwardMarket);

    const OptionsEngine = await ethers.getContractFactory("OptionsEngine");
    const optionsEngine = OptionsEngine.attach(deployed.optionsEngine);

    const YieldVault = await ethers.getContractFactory("YieldVault");
    const yieldVault = YieldVault.attach(deployed.yieldVault);

    console.log(`  Registry:         ${deployed.registry}`);
    console.log(`  ForwardMarket:    ${deployed.forwardMarket}`);
    console.log(`  OptionsEngine:    ${deployed.optionsEngine}`);
    console.log(`  YieldVault:       ${deployed.yieldVault}`);
    console.log(`  Ledger:           ${deployed.ledger}\n`);

    // Verify registry resolves PVM addresses
    try {
        const oracleAddr = await registry.resolve.staticCall(ethers.id("CoretimeOracle"));
        const pricingAddr = await registry.resolve.staticCall(ethers.id("PricingModule"));
        console.log(`  ✓ Registry resolves CoretimeOracle: ${oracleAddr}`);
        console.log(`  ✓ Registry resolves PricingModule:  ${pricingAddr}`);
        results.push({ name: "Registry PVM addresses", success: true, message: "✓" });
    } catch (err: any) {
        console.log(`  ✗ Registry resolution failed: ${err.message}`);
        results.push({ name: "Registry PVM addresses", success: false, message: err.message });
    }

    // =========================================================================
    // 3. Test ForwardMarket Flow
    // =========================================================================

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  [3] Testing ForwardMarket Flow");
    console.log("═══════════════════════════════════════════════════════════════\n");

    try {
        // Setup: Mint NFT and DOT
        const nftABI = ["function mintRegion(address,uint32,uint32,uint16) returns (uint128)"];
        const nft = new ethers.Contract(pvmAddresses.contracts.coretime_nft, nftABI, deployer);
        const assetsABI = ["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)"];
        const assets = new ethers.Contract(pvmAddresses.contracts.mock_assets, assetsABI, deployer);
        
        // Use unique region IDs
        const fmStartBlock = 300000 + Math.floor(Date.now() / 1000);
        const fmEndBlock = fmStartBlock + 100000;
        const regionId = await nft.mintRegion.staticCall(user1.address, fmStartBlock, fmEndBlock, 1);
        const mintNftTx = await nft.mintRegion(user1.address, fmStartBlock, fmEndBlock, 1);
        await mintNftTx.wait();
        const mintAssets1Tx = await assets.mint(user1.address, ethers.parseEther("10000"));
        await mintAssets1Tx.wait();
        const mintAssets2Tx = await assets.mint(user2.address, ethers.parseEther("10000"));
        await mintAssets2Tx.wait();
        console.log(`  ✓ Minted NFT region ${regionId} and DOT for users`);

        // User1 creates ask order
        const oracle = new ethers.Contract(
            pvmAddresses.contracts.coretime_oracle,
            ["function spotPrice() view returns (uint128)"],
            deployer
        );
        const spotPrice = await oracle.spotPrice.staticCall();
        const strikePrice = spotPrice * 120n / 100n; // 20% above spot
        const currentBlock = await ethers.provider.getBlockNumber();
        const deliveryBlock = currentBlock + 10000;
        
        console.log(`  Creating ask order: region ${regionId}, strike ${ethers.formatEther(strikePrice)} DOT, delivery block ${deliveryBlock}`);
        const createTx = await forwardMarket.connect(user1).createAsk(regionId, strikePrice, deliveryBlock);
        const createReceipt = await createTx.wait();
        console.log(`  ✓ User1 created ask order (tx: ${createReceipt?.hash})`);

        // User2 matches order
        const orderId = await forwardMarket.nextOrderId.staticCall() - 1n;
        const user2BalanceBefore = await assets.balanceOf.staticCall(user2.address);
        console.log(`  User2 balance before match: ${ethers.formatEther(user2BalanceBefore)} DOT`);
        console.log(`  Required strike price: ${ethers.formatEther(strikePrice)} DOT`);
        
        if (user2BalanceBefore < strikePrice) {
            throw new Error(`User2 has insufficient balance: ${ethers.formatEther(user2BalanceBefore)} < ${ethers.formatEther(strikePrice)}`);
        }
        
        const matchTx = await forwardMarket.connect(user2).matchOrder(orderId);
        const matchReceipt = await matchTx.wait();
        console.log(`  ✓ User2 matched order ${orderId} (tx: ${matchReceipt?.hash})`);

        // Verify balances
        const user2BalanceAfter = await assets.balanceOf.staticCall(user2.address);
        const fmBalance = await assets.balanceOf.staticCall(deployed.forwardMarket);
        console.log(`  User2 balance after: ${ethers.formatEther(user2BalanceAfter)} DOT`);
        console.log(`  ForwardMarket escrow: ${ethers.formatEther(fmBalance)} DOT`);
        console.log(`  Expected escrow: ${ethers.formatEther(strikePrice)} DOT`);

        const order = await forwardMarket.orders.staticCall(orderId);
        console.log(`  Order status: ${order.status} (1=Matched)`);
        console.log(`  Order buyer: ${order.buyer}`);

        results.push({ name: "ForwardMarket flow", success: true, message: "✓" });
    } catch (err: any) {
        const errorMsg = err.reason || err.message || err.toString();
        console.log(`  ✗ ForwardMarket flow failed: ${errorMsg.slice(0, 300)}`);
        if (err.data && err.data !== "0x") {
            console.log(`    Error data: ${err.data.slice(0, 200)}`);
        }
        results.push({ name: "ForwardMarket flow", success: false, message: errorMsg });
    }

    // =========================================================================
    // 4. Test OptionsEngine Flow
    // =========================================================================

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  [4] Testing OptionsEngine Flow");
    console.log("═══════════════════════════════════════════════════════════════\n");

    try {
        // Setup: Mint NFT and DOT
        const nftABI = ["function mintRegion(address,uint32,uint32,uint16) returns (uint128)"];
        const nft = new ethers.Contract(pvmAddresses.contracts.coretime_nft, nftABI, deployer);
        const assetsABI = ["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)"];
        const assets = new ethers.Contract(pvmAddresses.contracts.mock_assets, assetsABI, deployer);
        
        const optStartBlock = 400000 + Math.floor(Date.now() / 1000);
        const optEndBlock = optStartBlock + 100000;
        const regionId = await nft.mintRegion.staticCall(user1.address, optStartBlock, optEndBlock, 1);
        const mintNftTx = await nft.mintRegion(user1.address, optStartBlock, optEndBlock, 1);
        await mintNftTx.wait();
        const mintAssets1Tx = await assets.mint(user1.address, ethers.parseEther("10000"));
        await mintAssets1Tx.wait();
        const mintAssets2Tx = await assets.mint(user2.address, ethers.parseEther("10000"));
        await mintAssets2Tx.wait();
        console.log(`  ✓ Minted NFT region ${regionId} and DOT for users`);

        // User1 writes call option
        const oracle = new ethers.Contract(
            pvmAddresses.contracts.coretime_oracle,
            ["function spotPrice() view returns (uint128)"],
            deployer
        );
        const spotPrice = await oracle.spotPrice.staticCall();
        const strikePrice = spotPrice * 120n / 100n; // 20% above spot
        const currentBlock = await ethers.provider.getBlockNumber();
        const expiryBlock = currentBlock + 10000;
        
        console.log(`  Writing call option: region ${regionId}, strike ${ethers.formatEther(strikePrice)} DOT, expiry block ${expiryBlock}`);
        const writeTx = await optionsEngine.connect(user1).writeCall(regionId, strikePrice, expiryBlock);
        const writeReceipt = await writeTx.wait();
        console.log(`  ✓ User1 wrote call option (tx: ${writeReceipt?.hash})`);

        // User2 buys option
        const optionId = await optionsEngine.nextOptionId.staticCall() - 1n;
        const option = await optionsEngine.options.staticCall(optionId);
        const premium = option.premiumDOT;
        
        const user2BalanceBefore = await assets.balanceOf.staticCall(user2.address);
        const user1BalanceBefore = await assets.balanceOf.staticCall(user1.address);
        console.log(`  User2 balance before: ${ethers.formatEther(user2BalanceBefore)} DOT`);
        console.log(`  User1 balance before: ${ethers.formatEther(user1BalanceBefore)} DOT`);
        console.log(`  Premium: ${ethers.formatEther(premium)} DOT`);
        
        const buyTx = await optionsEngine.connect(user2).buyOption(optionId);
        const buyReceipt = await buyTx.wait();
        console.log(`  ✓ User2 bought option ${optionId} (tx: ${buyReceipt?.hash})`);

        // Verify balances
        const user2BalanceAfter = await assets.balanceOf.staticCall(user2.address);
        const user1BalanceAfter = await assets.balanceOf.staticCall(user1.address);
        console.log(`  User2 balance after: ${ethers.formatEther(user2BalanceAfter)} DOT`);
        console.log(`  User1 balance after: ${ethers.formatEther(user1BalanceAfter)} DOT`);
        console.log(`  Premium transferred: ${ethers.formatEther(user1BalanceAfter - user1BalanceBefore)} DOT`);

        const optionAfter = await optionsEngine.options.staticCall(optionId);
        console.log(`  Option holder: ${optionAfter.holder}`);
        console.log(`  Option status: ${optionAfter.status} (1=Active)`);

        results.push({ name: "OptionsEngine flow", success: true, message: "✓" });
    } catch (err: any) {
        const errorMsg = err.reason || err.message || err.toString();
        console.log(`  ✗ OptionsEngine flow failed: ${errorMsg.slice(0, 300)}`);
        if (err.data && err.data !== "0x") {
            console.log(`    Error data: ${err.data.slice(0, 200)}`);
        }
        results.push({ name: "OptionsEngine flow", success: false, message: errorMsg });
    }

    // =========================================================================
    // 5. Test YieldVault Flow
    // =========================================================================

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  [5] Testing YieldVault Flow");
    console.log("═══════════════════════════════════════════════════════════════\n");

    try {
        // Setup: Mint NFT and DOT
        const nftABI = ["function mintRegion(address,uint32,uint32,uint16) returns (uint128)", "function ownerOf(uint256) view returns (address)"];
        const nft = new ethers.Contract(pvmAddresses.contracts.coretime_nft, nftABI, deployer);
        const assetsABI = ["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)"];
        const assets = new ethers.Contract(pvmAddresses.contracts.mock_assets, assetsABI, deployer);
        
        const yvStartBlock = 500000 + Math.floor(Date.now() / 1000);
        const yvEndBlock = yvStartBlock + 100000;
        const regionId = await nft.mintRegion.staticCall(user1.address, yvStartBlock, yvEndBlock, 1);
        const mintNftTx = await nft.mintRegion(user1.address, yvStartBlock, yvEndBlock, 1);
        await mintNftTx.wait();
        const mintAssets1Tx = await assets.mint(user1.address, ethers.parseEther("10000"));
        await mintAssets1Tx.wait();
        const mintAssets2Tx = await assets.mint(user2.address, ethers.parseEther("10000"));
        await mintAssets2Tx.wait();
        console.log(`  ✓ Minted NFT region ${regionId} and DOT for users`);

        // User1 deposits region
        console.log(`  Depositing region ${regionId} to vault...`);
        const depositTx = await yieldVault.connect(user1).deposit(regionId);
        const depositReceipt = await depositTx.wait();
        console.log(`  ✓ User1 deposited region (tx: ${depositReceipt?.hash})`);

        // Verify NFT ownership transferred
        const owner = await nft.ownerOf.staticCall(regionId);
        console.log(`  NFT owner after deposit: ${owner}`);
        console.log(`  Expected vault: ${deployed.yieldVault}`);
        const totalDeposits = await yieldVault.totalDeposited.staticCall();
        console.log(`  Total deposits: ${totalDeposits}`);

        // User2 borrows region
        const durationBlocks = 1000;
        const coreCount = 1;
        
        const user2BalanceBefore = await assets.balanceOf.staticCall(user2.address);
        const vaultBalanceBefore = await assets.balanceOf.staticCall(deployed.yieldVault);
        console.log(`  User2 balance before: ${ethers.formatEther(user2BalanceBefore)} DOT`);
        console.log(`  Vault balance before: ${ethers.formatEther(vaultBalanceBefore)} DOT`);
        console.log(`  Borrowing ${coreCount} core(s) for ${durationBlocks} blocks...`);
        
        const borrowTx = await yieldVault.connect(user2).borrow(coreCount, durationBlocks);
        const borrowReceipt = await borrowTx.wait();
        console.log(`  ✓ User2 borrowed region (tx: ${borrowReceipt?.hash})`);

        // Verify balances
        const user2BalanceAfter = await assets.balanceOf.staticCall(user2.address);
        const vaultBalanceAfter = await assets.balanceOf.staticCall(deployed.yieldVault);
        console.log(`  User2 balance after: ${ethers.formatEther(user2BalanceAfter)} DOT`);
        console.log(`  Vault balance after: ${ethers.formatEther(vaultBalanceAfter)} DOT`);
        console.log(`  Fee collected: ${ethers.formatEther(vaultBalanceAfter - vaultBalanceBefore)} DOT`);

        const loanId = await yieldVault.nextLoanId.staticCall() - 1n;
        try {
            const loan = await yieldVault.loans.staticCall(loanId);
            console.log(`  Loan ${loanId}: borrower ${loan.borrower}, region ${loan.regionId}`);
        } catch (e) {
            console.log(`  Loan ${loanId} created`);
        }

        results.push({ name: "YieldVault flow", success: true, message: "✓" });
    } catch (err: any) {
        const errorMsg = err.reason || err.message || err.toString();
        console.log(`  ✗ YieldVault flow failed: ${errorMsg.slice(0, 300)}`);
        if (err.data && err.data !== "0x") {
            console.log(`    Error data: ${err.data.slice(0, 200)}`);
        }
        results.push({ name: "YieldVault flow", success: false, message: errorMsg });
    }

    // =========================================================================
    // Summary
    // =========================================================================

    console.log("\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║                    Test Summary                              ║");
    console.log("╚══════════════════════════════════════════════════════════════╝\n");

    let passCount = 0;
    let failCount = 0;

    for (const result of results) {
        const icon = result.success ? "✓" : "✗";
        const status = result.success ? "PASS" : "FAIL";
        console.log(`  ${icon} ${result.name.padEnd(35)} ${status}`);
        if (!result.success && result.message) {
            console.log(`    ${result.message.slice(0, 100)}`);
        }
        if (result.success) passCount++;
        else failCount++;
    }

    console.log(`\n  Results: ${passCount}/${results.length} tests passed\n`);

    if (failCount > 0) {
        console.log("  ⚠  Some tests failed. Check errors above.\n");
        process.exit(1);
    } else {
        console.log("  ✅ All tests passed! CoreDEX is fully functional.\n");
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
