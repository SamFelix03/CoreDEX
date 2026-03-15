/**
 * Deploy Rust PVM Mock Contracts for CoreDEX
 *
 * This script deploys the Rust PVM mock contracts (compiled to .polkavm blobs)
 * to a target network. These contracts implement the same ABI as the Solidity
 * interfaces used by the CoreDEX protocol, but run on the PVM executor instead
 * of the EVM — demonstrating Polkadot Hub's cross-VM architecture.
 *
 * Architecture:
 *   CoreDEX EVM Contracts (Solidity)
 *     ↕ cross-VM calls via pallet-revive
 *   PVM Mock Contracts (Rust → RISC-V)
 *     ↕ (production: read Substrate pallet storage)
 *   Coretime Broker / Assets / XCM pallets
 *
 * Prerequisites:
 *   1. Build Rust contracts:
 *      cd rust-contracts && npm run build
 *   2. Run a local node:
 *      npx hardhat node
 *
 * Usage:
 *   npx hardhat run scripts/deploy-pvm-mocks.ts --network localhost
 *   npx hardhat run scripts/deploy-pvm-mocks.ts --network polkadotTestNet
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── ABI definitions matching the Rust PVM contracts ──────────────────────────

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

// ── Blob paths ───────────────────────────────────────────────────────────────

const RUST_DIR = path.join(__dirname, "../rust-contracts");

const BLOBS = {
    coretimeOracle: [
        path.join(RUST_DIR, "coretime_oracle.polkavm"),
        path.join(RUST_DIR, "target/riscv64emac-unknown-none-polkavm/release/coretime_oracle"),
    ],
    pricingModule: [
        path.join(RUST_DIR, "pricing_module.polkavm"),
        path.join(RUST_DIR, "target/riscv64emac-unknown-none-polkavm/release/pricing_module"),
    ],
    coretimeNft: [
        path.join(RUST_DIR, "coretime_nft.polkavm"),
        path.join(RUST_DIR, "target/riscv64emac-unknown-none-polkavm/release/coretime_nft"),
    ],
    mockAssets: [
        path.join(RUST_DIR, "mock_assets.polkavm"),
        path.join(RUST_DIR, "target/riscv64emac-unknown-none-polkavm/release/mock_assets"),
    ],
};

function loadBlob(name: string, candidates: string[]): Buffer {
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            const blob = fs.readFileSync(p);
            console.log(`      Loaded ${name}: ${blob.length} bytes from ${path.relative(process.cwd(), p)}`);
            return blob;
        }
    }
    throw new Error(
        `\n  ✗ ${name} binary not found.\n` +
        `    Build the Rust contracts first:\n` +
        `      cd rust-contracts && npm run build\n`
    );
}

async function deployBlob(name: string, blob: Buffer, deployer: any): Promise<string> {
    const bytecode = "0x" + blob.toString("hex");
    const tx = await deployer.sendTransaction({ data: bytecode });
    const receipt = await tx.wait();
    if (!receipt?.contractAddress) {
        throw new Error(`  ✗ ${name} deployment failed — no contract address`);
    }
    return receipt.contractAddress;
}

function sep(label: string) {
    console.log(`\n${"═".repeat(70)}\n  ${label}\n${"═".repeat(70)}`);
}

async function main() {
    sep("CoreDEX — Deploy Rust PVM Mock Contracts");

    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`\n  Deployer : ${deployer.address}`);
    console.log(`  Balance  : ${ethers.formatEther(balance)}`);

    if (balance === 0n) {
        console.error("\n  ⚠  No balance. Fund deployer first.");
        process.exit(1);
    }

    // ── 1. Deploy Rust PVM contracts ──────────────────────────────────────────

    sep("Phase 1: Deploy Rust PVM Mock Contracts (RISC-V → PVM)");

    console.log("\n  [1/4] CoretimeOracle (Rust PVM)...");
    const oracleBlob = loadBlob("coretime_oracle", BLOBS.coretimeOracle);
    const oracleAddr = await deployBlob("CoretimeOracle", oracleBlob, deployer);
    console.log(`  ✓ CoretimeOracle (PVM Rust) @ ${oracleAddr}`);

    console.log("\n  [2/4] PricingModule (Rust PVM)...");
    const pricingBlob = loadBlob("pricing_module", BLOBS.pricingModule);
    const pricingAddr = await deployBlob("PricingModule", pricingBlob, deployer);
    console.log(`  ✓ PricingModule (PVM Rust) @ ${pricingAddr}`);

    console.log("\n  [3/4] CoretimeNFT (Rust PVM)...");
    const nftBlob = loadBlob("coretime_nft", BLOBS.coretimeNft);
    const nftAddr = await deployBlob("CoretimeNFT", nftBlob, deployer);
    console.log(`  ✓ CoretimeNFT (PVM Rust) @ ${nftAddr}`);

    console.log("\n  [4/4] MockAssets (Rust PVM)...");
    const assetsBlob = loadBlob("mock_assets", BLOBS.mockAssets);
    const assetsAddr = await deployBlob("MockAssets", assetsBlob, deployer);
    console.log(`  ✓ MockAssets (PVM Rust) @ ${assetsAddr}`);

    // ── Architecture diagram ──────────────────────────────────────────────────

    console.log(`
  ┌──────────────────────────────────────────────────────────────┐
  │  Cross-VM Architecture                                       │
  │                                                              │
  │  EVM Executor (Solidity — compiled with solc)                │
  │  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐     │
  │  │ ForwardMarket  │  │ OptionsEngine│  │  YieldVault  │     │
  │  └───────┬────────┘  └──────┬───────┘  └──────┬───────┘     │
  │          │                  │                  │              │
  │          │  cross-VM calls via pallet-revive   │              │
  │          ▼                  ▼                  ▼              │
  │  PVM Executor (Rust — compiled to RISC-V)                    │
  │  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐     │
  │  │CoretimeOracle  │  │PricingModule │  │ CoretimeNFT  │     │
  │  │  @ ${oracleAddr.slice(0, 10)}…│  │ @ ${pricingAddr.slice(0, 10)}…│  │ @ ${nftAddr.slice(0, 10)}…│     │
  │  └────────────────┘  └──────────────┘  └──────────────┘     │
  │                                                              │
  │  Real Polkadot Precompile                                    │
  │  ┌────────────────────────────────────────────────────┐      │
  │  │  XCM Precompile @ 0x…0a0000 (runtime built-in)    │      │
  │  └────────────────────────────────────────────────────┘      │
  └──────────────────────────────────────────────────────────────┘
    `);

    // ── 2. Verify cross-VM calls ─────────────────────────────────────────────

    sep("Phase 2: Verify Cross-VM Calls (EVM → PVM)");

    const oracle = new ethers.Contract(oracleAddr, CORETIME_ORACLE_ABI, deployer);
    const pricing = new ethers.Contract(pricingAddr, PRICING_MODULE_ABI, deployer);
    const nft = new ethers.Contract(nftAddr, CORETIME_NFT_ABI, deployer);
    const assets = new ethers.Contract(assetsAddr, MOCK_ASSETS_ABI, deployer);

    console.log("\n  [1] Testing CoretimeOracle...");
    const spotPrice = await oracle.spotPrice.staticCall();
    console.log(`      spotPrice() = ${ethers.formatEther(spotPrice)} DOT  ✓`);

    const impliedVol = await oracle.impliedVolatility.staticCall();
    console.log(`      impliedVolatility() = ${Number(impliedVol) / 100}%  ✓`);

    console.log("\n  [2] Testing PricingModule...");
    const [premium, delta] = await pricing.price_option.staticCall(
        ethers.parseEther("5"),   // spot
        ethers.parseEther("6"),   // strike
        10000,                    // timeBlocks
        5000,                     // volatility (50%)
        0                         // CALL
    );
    console.log(`      price_option(5 DOT, 6 DOT, 10000 blocks, 50%, CALL)`);
    console.log(`        premium = ${ethers.formatEther(premium)} DOT  ✓`);
    console.log(`        delta   = ${ethers.formatEther(delta)}  ✓`);

    console.log("\n  [3] Testing CoretimeNFT...");
    const mintTx = await nft.mintRegion(deployer.address, 100000, 200000, 1);
    await mintTx.wait();
    const regionOwner = await nft.ownerOf.staticCall(1);
    console.log(`      mintRegion() → owner = ${regionOwner}  ✓`);

    console.log("\n  [4] Testing MockAssets...");
    const mintAssetsTx = await assets.mint(deployer.address, ethers.parseEther("100"));
    await mintAssetsTx.wait();
    const bal = await assets.balanceOf.staticCall(deployer.address);
    console.log(`      mint(100 DOT) → balance = ${ethers.formatEther(bal)} DOT  ✓`);

    // ── 3. Write addresses ───────────────────────────────────────────────────

    sep("Done — PVM Contract Addresses");

    const addresses = {
        coretimeOracle: oracleAddr,
        pricingModule:  pricingAddr,
        coretimeNft:    nftAddr,
        mockAssets:     assetsAddr,
        xcmPrecompile:  "0x00000000000000000000000000000000000A0000",
        network:        (await ethers.provider.getNetwork()).name,
        chainId:        Number((await ethers.provider.getNetwork()).chainId),
    };

    console.log(JSON.stringify(addresses, null, 2));

    const outPath = path.join(__dirname, "../pvm-addresses.json");
    fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
    console.log(`\n  Written to: ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
