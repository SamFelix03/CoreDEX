import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const PVM_ADDRESSES_FILE = path.join(__dirname, "../pvm-testnet-addresses.json");
const DEPLOYED_ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");

async function main() {
    const [deployer] = await ethers.getSigners();
    const pvm = JSON.parse(fs.readFileSync(PVM_ADDRESSES_FILE, "utf-8"));
    const deployed = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_FILE, "utf-8"));

    console.log("Testing ForwardMarket.createAsk...\n");

    // Setup
    const nft = new ethers.Contract(
        pvm.contracts.coretime_nft,
        ["function mintRegion(address,uint32,uint32,uint16) returns (uint128)"],
        deployer
    );
    const assets = new ethers.Contract(
        pvm.contracts.mock_assets,
        ["function mint(address,uint256)"],
        deployer
    );

    // Mint NFT and DOT
    const regionId = await nft.mintRegion.staticCall(deployer.address, 100000, 200000, 1);
    await (await nft.mintRegion(deployer.address, 100000, 200000, 1)).wait();
    await (await assets.mint(deployer.address, ethers.parseEther("10000"))).wait();
    console.log(`✓ Minted region ${regionId} and DOT\n`);

    // Check registry paused
    const Registry = await ethers.getContractFactory("CoreDexRegistry");
    const registry = Registry.attach(deployed.registry);
    const paused = await registry.paused();
    console.log(`Registry paused: ${paused}\n`);

    // Get ForwardMarket
    const ForwardMarket = await ethers.getContractFactory("ForwardMarket");
    const fm = ForwardMarket.attach(deployed.forwardMarket);

    // Check if NFT is approved (it's not, but transferFrom should work anyway)
    const nftContract = new ethers.Contract(
        pvm.contracts.coretime_nft,
        ["function ownerOf(uint256) view returns (address)"],
        deployer
    );
    const owner = await nftContract.ownerOf.staticCall(regionId);
    console.log(`NFT owner: ${owner}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Match: ${owner.toLowerCase() === deployer.address.toLowerCase()}\n`);

    // Get spot price from oracle to calculate valid strike price
    const oracle = new ethers.Contract(
        pvm.contracts.coretime_oracle,
        ["function spotPrice() view returns (uint128)"],
        deployer
    );
    const spotPrice = await oracle.spotPrice.staticCall();
    console.log(`Spot price: ${ethers.formatEther(spotPrice)} DOT`);
    
    // Strike must be within ±50% of spot (2.5 to 7.5 DOT for 5 DOT spot)
    const strikePrice = spotPrice * 120n / 100n; // 20% above spot (6 DOT for 5 DOT spot)
    const currentBlock = await ethers.provider.getBlockNumber();
    const deliveryBlock = currentBlock + 10000; // Future block
    console.log(`Strike price: ${ethers.formatEther(strikePrice)} DOT (within ±50% band)`);
    console.log(`Current block: ${currentBlock}`);
    console.log(`Calling createAsk(${regionId}, ${ethers.formatEther(strikePrice)} DOT, block ${deliveryBlock})...`);
    
    try {
        // First check if it would revert with a static call
        await fm.createAsk.staticCall(regionId, strikePrice, deliveryBlock);
        console.log("✓ Static call succeeded\n");
        
        const tx = await fm.createAsk(regionId, strikePrice, deliveryBlock);
        const receipt = await tx.wait();
        console.log(`✓ createAsk successful! Tx: ${receipt?.hash}`);
        
        // Check order was created
        const orderId = await fm.nextOrderId.staticCall() - 1n;
        const order = await fm.orders.staticCall(orderId);
        console.log(`Order ${orderId} created:`);
        console.log(`  Seller: ${order.seller}`);
        console.log(`  Region: ${order.coretimeRegion}`);
        console.log(`  Strike: ${ethers.formatEther(order.strikePriceDOT)} DOT`);
    } catch (e: any) {
        console.log(`✗ createAsk failed: ${e.message}`);
        if (e.reason) console.log(`  Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`  Error data: ${e.data}`);
            // Try to decode
            try {
                const iface = new ethers.Interface([
                    "error ProtocolPaused()",
                    "error Unauthorised(address)",
                    "error ContractNotFound(bytes32)",
                ]);
                const decoded = iface.parseError(e.data);
                console.log(`  Decoded error: ${decoded.name}`);
            } catch {}
        }
    }
}

main().catch(console.error);
