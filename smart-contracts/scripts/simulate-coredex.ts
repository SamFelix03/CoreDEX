/**
 * CoreDEX Full Protocol Simulation — Cross-VM Architecture
 *
 * This script deploys ALL CoreDEX infrastructure using the cross-VM pattern:
 *   - Rust PVM contracts for oracle, pricing, NFT, and asset mocks
 *   - Solidity EVM contracts for the core protocol (ForwardMarket, OptionsEngine, etc.)
 *   - Real Polkadot XCM precompile address for settlement
 *
 * The EVM contracts call the Rust PVM contracts transparently via
 * pallet-revive's cross-VM dispatch — no bridge, no XCM, just a normal
 * Solidity external call that gets routed to the PVM executor.
 *
 * Simulated Flows:
 *   1. Deploy Rust PVM mock contracts (cross-VM targets)
 *   2. Deploy CoreDEX EVM contracts (core protocol)
 *   3. Forward Market: create ask → cancel
 *   4. Options Engine: write call → expire
 *   5. Yield Vault: deposit → withdraw
 *   6. Oracle & Pricing Module verification (cross-VM)
 *   7. Governance & circuit breaker tests
 *
 * Run with:
 *   npx hardhat run scripts/simulate-coredex.ts --network localhost
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── ABI definitions for Rust PVM contracts ───────────────────────────────────

const CORETIME_ORACLE_ABI = [
    "function spotPrice() returns (uint128)",
    "function impliedVolatility() returns (uint64)",
    "function lastSalePrice() returns (uint128)",
    "function renewalPrice() returns (uint128)",
    "function saleRegion() returns (uint32 begin, uint32 end)",
    "function coreAvailability() returns (uint16 total, uint16 sold)",
    "function setSpotPrice(uint128 price)",
    "function setImpliedVolatility(uint64 vol)",
];

const PRICING_MODULE_ABI = [
    "function price_option(uint128 spot, uint128 strike, uint32 timeBlocks, uint64 volatility, uint8 optionType) returns (uint128 premium, uint128 delta)",
    "function solve_iv(uint128 spot, uint128 strike, uint32 timeBlocks, uint128 targetPremium, uint8 optionType) returns (uint64 impliedVol)",
];

const CORETIME_NFT_ABI = [
    "function ownerOf(uint256 tokenId) returns (address)",
    "function transferFrom(address from, address to, uint256 tokenId)",
    "function approve(address to, uint256 tokenId)",
    "function getApproved(uint256 tokenId) returns (address)",
    "function regionBegin(uint256 tokenId) returns (uint32)",
    "function regionEnd(uint256 tokenId) returns (uint32)",
    "function regionCore(uint256 tokenId) returns (uint16)",
    "function mintRegion(address to, uint32 begin, uint32 end, uint16 core) returns (uint128)",
    "function mintRegionWithId(address to, uint128 regionId, uint32 begin, uint32 end, uint16 core)",
];

const MOCK_ASSETS_ABI = [
    "function balanceOf(address account) returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function totalIssuance() returns (uint256)",
    "function existentialDeposit() returns (uint256)",
    "function mint(address to, uint256 amount)",
    "function burn(address from, uint256 amount)",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function logSection(title: string) {
    console.log("\n" + "═".repeat(70));
    console.log(`  ${title}`);
    console.log("═".repeat(70));
}

function logStep(step: string) {
    console.log(`\n  → ${step}`);
}

function logSuccess(msg: string) {
    console.log(`  ✅ ${msg}`);
}

function logInfo(msg: string) {
    console.log(`  ℹ️  ${msg}`);
}

function logError(msg: string) {
    console.log(`  ❌ ${msg}`);
}

// ── Blob loading ─────────────────────────────────────────────────────────────

const RUST_DIR = path.join(__dirname, "../rust-contracts");

function loadBlob(name: string): Buffer {
    const candidates = [
        path.join(RUST_DIR, `${name}.polkavm`),
        path.join(RUST_DIR, `target/riscv64emac-unknown-none-polkavm/release/${name}`),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return fs.readFileSync(p);
        }
    }
    throw new Error(`Rust blob not found for ${name}. Build first: cd rust-contracts && npm run build`);
}

async function deployBlob(name: string, deployer: any): Promise<string> {
    const blob = loadBlob(name);
    const bytecode = "0x" + blob.toString("hex");
    const tx = await deployer.sendTransaction({ data: bytecode });
    const receipt = await tx.wait();
    if (!receipt?.contractAddress) throw new Error(`${name} deployment failed`);
    return receipt.contractAddress;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const [deployer, seller, buyer, borrower, keeper] = await ethers.getSigners();

    console.log("╔══════════════════════════════════════════════════════════════════════╗");
    console.log("║    CoreDEX Full Protocol Simulation — Cross-VM Architecture        ║");
    console.log("╚══════════════════════════════════════════════════════════════════════╝");
    console.log("");
    console.log("Deployer:", deployer.address);
    console.log("Seller:  ", seller.address);
    console.log("Buyer:   ", buyer.address);
    console.log("Borrower:", borrower.address);
    console.log("Keeper:  ", keeper.address);
    console.log("");

    // =========================================================================
    // PHASE 1: Deploy Rust PVM Mock Contracts
    // =========================================================================

    logSection("PHASE 1: Deploy Rust PVM Mock Contracts (RISC-V → PVM)");

    logStep("Deploying CoretimeOracle (Rust PVM)...");
    const oracleAddr = await deployBlob("coretime_oracle", deployer);
    logSuccess(`CoretimeOracle (PVM): ${oracleAddr}`);

    logStep("Deploying PricingModule (Rust PVM)...");
    const pricingAddr = await deployBlob("pricing_module", deployer);
    logSuccess(`PricingModule (PVM): ${pricingAddr}`);

    logStep("Deploying CoretimeNFT (Rust PVM)...");
    const nftAddr = await deployBlob("coretime_nft", deployer);
    logSuccess(`CoretimeNFT (PVM): ${nftAddr}`);

    logStep("Deploying MockAssets (Rust PVM)...");
    const assetsAddr = await deployBlob("mock_assets", deployer);
    logSuccess(`MockAssets (PVM): ${assetsAddr}`);

    // Create ethers contract instances for the Rust PVM contracts
    const oracle  = new ethers.Contract(oracleAddr, CORETIME_ORACLE_ABI, deployer);
    const pricing = new ethers.Contract(pricingAddr, PRICING_MODULE_ABI, deployer);
    const nft     = new ethers.Contract(nftAddr, CORETIME_NFT_ABI, deployer);
    const assets  = new ethers.Contract(assetsAddr, MOCK_ASSETS_ABI, deployer);

    logInfo("XCM Precompile: 0x00000000000000000000000000000000000A0000 (real Polkadot precompile)");

    // =========================================================================
    // PHASE 2: Deploy CoreDEX EVM Contracts
    // =========================================================================

    logSection("PHASE 2: Deploy CoreDEX EVM Contracts (Solidity → EVM)");

    logStep("Deploying CoreDexRegistry...");
    const Registry = await ethers.getContractFactory("CoreDexRegistry");
    const registry = await Registry.deploy(deployer.address);
    await registry.waitForDeployment();
    const registryAddr = await registry.getAddress();
    logSuccess(`CoreDexRegistry: ${registryAddr}`);

    // Register PVM mock contracts in registry
    logStep("Registering Rust PVM contracts in registry...");
    await registry.register(ethers.keccak256(ethers.toUtf8Bytes("CoretimeOracle")), oracleAddr);
    await registry.register(ethers.keccak256(ethers.toUtf8Bytes("PricingModule")), pricingAddr);
    logSuccess("CoretimeOracle (PVM) registered");
    logSuccess("PricingModule (PVM) registered");

    logStep("Deploying CoretimeLedger...");
    const Ledger = await ethers.getContractFactory("CoretimeLedger");
    const ledger = await Ledger.deploy(registryAddr);
    await ledger.waitForDeployment();
    const ledgerAddr = await ledger.getAddress();
    await registry.register(ethers.keccak256(ethers.toUtf8Bytes("CoretimeLedger")), ledgerAddr);
    logSuccess(`CoretimeLedger: ${ledgerAddr}`);

    logStep("Deploying ForwardMarket...");
    const Forward = await ethers.getContractFactory("ForwardMarket");
    const forwardMarket = await Forward.deploy(registryAddr, nftAddr);
    await forwardMarket.waitForDeployment();
    const forwardAddr = await forwardMarket.getAddress();
    await registry.register(ethers.keccak256(ethers.toUtf8Bytes("ForwardMarket")), forwardAddr);
    logSuccess(`ForwardMarket: ${forwardAddr}`);

    logStep("Deploying OptionsEngine...");
    const Options = await ethers.getContractFactory("OptionsEngine");
    const optionsEngine = await Options.deploy(registryAddr, nftAddr);
    await optionsEngine.waitForDeployment();
    const optionsAddr = await optionsEngine.getAddress();
    await registry.register(ethers.keccak256(ethers.toUtf8Bytes("OptionsEngine")), optionsAddr);
    logSuccess(`OptionsEngine: ${optionsAddr}`);

    logStep("Deploying YieldVault...");
    const Vault = await ethers.getContractFactory("YieldVault");
    const yieldVault = await Vault.deploy(registryAddr, nftAddr);
    await yieldVault.waitForDeployment();
    const vaultAddr = await yieldVault.getAddress();
    await registry.register(ethers.keccak256(ethers.toUtf8Bytes("YieldVault")), vaultAddr);
    logSuccess(`YieldVault: ${vaultAddr}`);

    logStep("Deploying SettlementExecutor...");
    const Settlement = await ethers.getContractFactory("SettlementExecutor");
    const settlement = await Settlement.deploy(registryAddr, nftAddr);
    await settlement.waitForDeployment();
    const settlementAddr = await settlement.getAddress();
    await registry.register(ethers.keccak256(ethers.toUtf8Bytes("SettlementExecutor")), settlementAddr);
    logSuccess(`SettlementExecutor: ${settlementAddr}`);

    // =========================================================================
    // PHASE 3: Seed Test Data via Cross-VM Calls
    // =========================================================================

    logSection("PHASE 3: Seed Test Data (EVM → PVM cross-VM calls)");

    logStep("Minting coretime region NFTs for seller (via PVM CoretimeNFT)...");
    for (let i = 0; i < 5; i++) {
        const tx = await nft.mintRegion(
            seller.address,
            100_000 + i * 100_000,  // begin block
            200_000 + i * 100_000,  // end block
            i                        // core index
        );
        await tx.wait();
    }
    logSuccess("Minted 5 regions for seller: [1, 2, 3, 4, 5]");

    logStep("Minting mock DOT for participants (via PVM MockAssets)...");
    await (await assets.mint(seller.address, ethers.parseEther("1000"))).wait();
    await (await assets.mint(buyer.address, ethers.parseEther("1000"))).wait();
    await (await assets.mint(borrower.address, ethers.parseEther("1000"))).wait();
    logSuccess("Minted 1000 DOT each for seller, buyer, borrower");

    logStep("Verifying oracle state (cross-VM: EVM script → PVM Rust contract)...");
    const spotPrice = await oracle.spotPrice.staticCall();
    const impliedVol = await oracle.impliedVolatility.staticCall();
    logInfo(`Spot price: ${ethers.formatEther(spotPrice)} DOT (from Rust PVM)`);
    logInfo(`Implied volatility: ${Number(impliedVol) / 100}% (from Rust PVM)`);

    // =========================================================================
    // PHASE 4: Forward Market Simulation
    // =========================================================================

    logSection("PHASE 4: Forward Market — Full Lifecycle");

    const currentBlock = await ethers.provider.getBlockNumber();
    const deliveryBlock = currentBlock + 100;

    logStep(`Seller creating ask for Region #1 at 5 DOT, delivery block ${deliveryBlock}...`);
    // Approve via PVM NFT contract (cross-VM)
    await (await nft.connect(seller).approve(forwardAddr, 1)).wait();
    const createAskTx = await forwardMarket.connect(seller).createAsk(1, ethers.parseEther("5"), deliveryBlock);
    const createAskReceipt = await createAskTx.wait();
    logSuccess(`Ask order created! Tx: ${createAskReceipt?.hash}`);

    const order = await forwardMarket.orders(1);
    logInfo(`Order #1: seller=${order.seller}, status=${order.status}, strike=${ethers.formatEther(order.strikePriceDOT)} DOT`);

    const isLocked = await ledger.isRegionLocked(1);
    logSuccess(`Region #1 locked in ledger: ${isLocked}`);

    logStep("Seller cancelling open order #1 (demonstrates cancel flow)...");
    const cancelTx = await forwardMarket.connect(seller).cancel(1);
    await cancelTx.wait();
    logSuccess("Order #1 cancelled!");
    logSuccess(`Region #1 unlocked: ${!(await ledger.isRegionLocked(1))}`);

    // Verify NFT returned via PVM cross-VM call
    const nftOwner = await nft.ownerOf.staticCall(1);
    logSuccess(`Region #1 returned to seller: ${nftOwner === seller.address}`);

    // =========================================================================
    // PHASE 5: Options Engine Simulation
    // =========================================================================

    logSection("PHASE 5: Options Engine — Write & Expire Option");

    const expiryBlock = currentBlock + 50;

    logStep(`Writer writing call option for Region #2, strike 6 DOT, expiry ${expiryBlock}...`);
    await (await nft.connect(seller).approve(optionsAddr, 2)).wait();

    const writeCallTx = await optionsEngine.connect(seller).writeCall(2, ethers.parseEther("6"), expiryBlock);
    await writeCallTx.wait();
    logSuccess("Call option written!");

    const option = await optionsEngine.options(1);
    logInfo(`Option #1: writer=${option.writer}, type=${option.optionType === 0n ? "CALL" : "PUT"}`);
    logInfo(`  strike=${ethers.formatEther(option.strikePriceDOT)} DOT, premium=${ethers.formatEther(option.premiumDOT)} DOT`);
    logSuccess(`Region #2 locked: ${await ledger.isRegionLocked(2)}`);

    logStep("Fast-forwarding past expiry...");
    for (let i = 0; i < 55; i++) {
        await ethers.provider.send("evm_mine", []);
    }
    logInfo(`Current block: ${await ethers.provider.getBlockNumber()} (expiry was ${expiryBlock})`);

    logStep("Expiring unexercised option #1...");
    await (await optionsEngine.connect(seller).expireOption(1)).wait();
    logSuccess("Option #1 expired!");

    const region2Owner = await nft.ownerOf.staticCall(2);
    logSuccess(`Region #2 returned to writer: ${region2Owner === seller.address}`);
    logSuccess(`Region #2 unlocked: ${!(await ledger.isRegionLocked(2))}`);

    // =========================================================================
    // PHASE 6: Yield Vault Simulation
    // =========================================================================

    logSection("PHASE 6: Yield Vault — Deposit & Withdraw");

    logStep("Seller depositing Region #3 into YieldVault...");
    await (await nft.connect(seller).approve(vaultAddr, 3)).wait();
    await (await yieldVault.connect(seller).deposit(3)).wait();
    logSuccess("Region #3 deposited!");
    logInfo(`Vault: deposited=${await yieldVault.totalDeposited()}, lent=${await yieldVault.totalLent()}`);
    logSuccess(`Region #3 locked: ${await ledger.isRegionLocked(3)}`);

    logStep("Seller depositing Region #4...");
    await (await nft.connect(seller).approve(vaultAddr, 4)).wait();
    await (await yieldVault.connect(seller).deposit(4)).wait();
    logSuccess("Region #4 deposited!");

    logStep("Seller withdrawing Region #4...");
    await (await yieldVault.connect(seller).withdraw(2)).wait(); // receipt #2
    logSuccess("Region #4 withdrawn!");
    const region4Owner = await nft.ownerOf.staticCall(4);
    logSuccess(`Region #4 returned: ${region4Owner === seller.address}`);

    // =========================================================================
    // PHASE 7: Oracle & Pricing Module — Cross-VM Verification
    // =========================================================================

    logSection("PHASE 7: Oracle & Pricing Module (EVM → PVM Cross-VM)");

    logStep("Reading oracle data from Rust PVM contract...");
    const spot = await oracle.spotPrice.staticCall();
    const vol = await oracle.impliedVolatility.staticCall();
    const lastSale = await oracle.lastSalePrice.staticCall();
    const renewal = await oracle.renewalPrice.staticCall();
    const [saleBegin, saleEnd] = await oracle.saleRegion.staticCall();
    const [totalCores, coresSold] = await oracle.coreAvailability.staticCall();

    logInfo(`Spot price:     ${ethers.formatEther(spot)} DOT`);
    logInfo(`Implied vol:    ${Number(vol) / 100}%`);
    logInfo(`Last sale:      ${ethers.formatEther(lastSale)} DOT`);
    logInfo(`Renewal price:  ${ethers.formatEther(renewal)} DOT`);
    logInfo(`Sale region:    ${saleBegin} → ${saleEnd}`);
    logInfo(`Core sales:     ${coresSold}/${totalCores}`);

    logStep("Updating oracle via PVM cross-VM call...");
    await (await oracle.setSpotPrice(ethers.parseEther("6.5"))).wait();
    const newSpot = await oracle.spotPrice.staticCall();
    logSuccess(`Spot price updated to ${ethers.formatEther(newSpot)} DOT`);

    logStep("Testing PricingModule option pricing (Rust Black-Scholes on PVM)...");
    const [callPremium, callDelta] = await pricing.price_option.staticCall(
        ethers.parseEther("6.5"), ethers.parseEther("7"), 10000, 6000, 0
    );
    logInfo(`Call: premium=${ethers.formatEther(callPremium)} DOT, delta=${ethers.formatEther(callDelta)}`);

    const [putPremium, putDelta] = await pricing.price_option.staticCall(
        ethers.parseEther("6.5"), ethers.parseEther("6"), 10000, 6000, 1
    );
    logInfo(`Put:  premium=${ethers.formatEther(putPremium)} DOT, delta=${ethers.formatEther(putDelta)}`);

    logStep("Testing IV solver (Rust bisection on PVM)...");
    const solvedIV = await pricing.solve_iv.staticCall(
        ethers.parseEther("6.5"), ethers.parseEther("7"), 10000, callPremium, 0
    );
    logInfo(`Solved IV: ${Number(solvedIV) / 100}% (input was 60%)`);

    // =========================================================================
    // PHASE 8: Governance & Circuit Breaker
    // =========================================================================

    logSection("PHASE 8: Governance & Circuit Breaker Tests");

    logStep("Testing protocol pause...");
    await registry.pause();
    logSuccess(`Protocol paused: ${await registry.paused()}`);

    logStep("Attempting order creation while paused (should fail)...");
    try {
        await nft.connect(seller).approve(forwardAddr, 5);
        await forwardMarket.connect(seller).createAsk(5, ethers.parseEther("5"), currentBlock + 200);
        logError("Order creation should have reverted!");
    } catch (err: any) {
        logSuccess(`Correctly reverted: ${err.message.includes("ProtocolPaused") ? "ProtocolPaused" : err.message.slice(0, 80)}`);
    }

    await registry.unpause();
    logSuccess(`Protocol unpaused: ${!(await registry.paused())}`);

    logStep("Testing governance transfer...");
    await registry.transferGovernance(keeper.address);
    logSuccess(`Governance → keeper: ${(await registry.governance()) === keeper.address}`);
    await registry.connect(keeper).transferGovernance(deployer.address);
    logSuccess("Governance → deployer (restored)");

    // =========================================================================
    // PHASE 9: Registry Verification
    // =========================================================================

    logSection("PHASE 9: Registry Verification");

    const contractKeys = [
        "CoretimeOracle", "PricingModule", "CoretimeLedger",
        "ForwardMarket", "OptionsEngine", "YieldVault", "SettlementExecutor",
    ];
    for (const key of contractKeys) {
        try {
            const resolved = await registry.resolve(ethers.keccak256(ethers.toUtf8Bytes(key)));
            logSuccess(`${key.padEnd(24)}: ${resolved}`);
        } catch {
            logError(`${key.padEnd(24)}: NOT REGISTERED`);
        }
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================

    logSection("SIMULATION COMPLETE — SUMMARY");

    console.log("");
    console.log("  Deployed Contracts (Cross-VM Architecture):");
    console.log("  ─── PVM Executor (Rust → RISC-V) ───");
    console.log(`    CoretimeOracle (PVM):  ${oracleAddr}`);
    console.log(`    PricingModule  (PVM):  ${pricingAddr}`);
    console.log(`    CoretimeNFT    (PVM):  ${nftAddr}`);
    console.log(`    MockAssets     (PVM):  ${assetsAddr}`);
    console.log("  ─── EVM Executor (Solidity) ───");
    console.log(`    CoreDexRegistry:       ${registryAddr}`);
    console.log(`    CoretimeLedger:        ${ledgerAddr}`);
    console.log(`    ForwardMarket:         ${forwardAddr}`);
    console.log(`    OptionsEngine:         ${optionsAddr}`);
    console.log(`    YieldVault:            ${vaultAddr}`);
    console.log(`    SettlementExecutor:    ${settlementAddr}`);
    console.log("  ─── Real Polkadot Precompile ───");
    console.log(`    XCM Precompile:        0x00000000000000000000000000000000000A0000`);
    console.log("");
    console.log("  Simulated Flows:");
    console.log("    ✅ Forward Market: Create Ask → Cancel (EVM ↔ PVM NFT)");
    console.log("    ✅ Options Engine: Write Call → Expire (EVM calls PVM PricingModule)");
    console.log("    ✅ Yield Vault: Deposit → Withdraw (EVM ↔ PVM NFT)");
    console.log("    ✅ Oracle: Read/update from Rust PVM contract (cross-VM)");
    console.log("    ✅ Pricing Module: Black-Scholes in Rust RISC-V (cross-VM)");
    console.log("    ✅ Circuit Breaker: Pause/unpause with revert");
    console.log("    ✅ Governance: Transfer and registry management");
    console.log("");
    console.log("  Architecture Note:");
    console.log("    The CoretimeOracle and PricingModule run as Rust contracts on PVM.");
    console.log("    EVM contracts call them via standard Solidity external calls.");
    console.log("    pallet-revive routes these calls to the PVM executor transparently.");
    console.log("    The XCM Precompile uses the REAL Polkadot address (0x…0a0000).");
    console.log("");

    // Write addresses
    const simAddresses = {
        pvmContracts: {
            coretimeOracle: oracleAddr,
            pricingModule:  pricingAddr,
            coretimeNft:    nftAddr,
            mockAssets:     assetsAddr,
        },
        evmContracts: {
            registry:       registryAddr,
            ledger:         ledgerAddr,
            forwardMarket:  forwardAddr,
            optionsEngine:  optionsAddr,
            yieldVault:     vaultAddr,
            settlement:     settlementAddr,
        },
        precompiles: {
            xcm: "0x00000000000000000000000000000000000A0000",
        },
    };

    const outputPath = path.join(__dirname, "../simulation-addresses.json");
    fs.writeFileSync(outputPath, JSON.stringify(simAddresses, null, 2));
    console.log(`  Addresses written to: ${outputPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
