import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const PVM_ADDRESSES_FILE = path.join(__dirname, "../pvm-testnet-addresses.json");
const DEPLOYED_ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");

async function main() {
    const [deployer] = await ethers.getSigners();
    const pvm = JSON.parse(fs.readFileSync(PVM_ADDRESSES_FILE, "utf-8"));
    const deployed = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_FILE, "utf-8"));

    console.log("Testing ForwardMarket.matchOrder...\n");

    // Setup
    const nft = new ethers.Contract(
        pvm.contracts.coretime_nft,
        ["function mintRegion(address,uint32,uint32,uint16) returns (uint128)"],
        deployer
    );
    const assets = new ethers.Contract(
        pvm.contracts.mock_assets,
        ["function mint(address,uint256)", "function balanceOf(address) view returns (uint256)"],
        deployer
    );
    const oracle = new ethers.Contract(
        pvm.contracts.coretime_oracle,
        ["function spotPrice() view returns (uint128)"],
        deployer
    );

    // Mint NFT and DOT
    const regionId = await nft.mintRegion.staticCall(deployer.address, 100000, 200000, 1);
    await (await nft.mintRegion(deployer.address, 100000, 200000, 1)).wait();
    await (await assets.mint(deployer.address, ethers.parseEther("10000"))).wait();
    console.log(`✓ Minted region ${regionId} and DOT\n`);

    // Get ForwardMarket
    const ForwardMarket = await ethers.getContractFactory("ForwardMarket");
    const fm = ForwardMarket.attach(deployed.forwardMarket);

    // Create ask order
    const spotPrice = await oracle.spotPrice.staticCall();
    const strikePrice = spotPrice * 120n / 100n;
    const currentBlock = await ethers.provider.getBlockNumber();
    const deliveryBlock = currentBlock + 10000;
    console.log(`Creating ask order...`);
    const createTx = await fm.createAsk(regionId, strikePrice, deliveryBlock);
    await createTx.wait();
    console.log(`✓ Created ask order\n`);

    // Check order
    const orderId = await fm.nextOrderId.staticCall() - 1n;
    const order = await fm.orders.staticCall(orderId);
    console.log(`Order ${orderId}:`);
    console.log(`  Seller: ${order.seller}`);
    console.log(`  Region: ${order.coretimeRegion}`);
    console.log(`  Strike: ${ethers.formatEther(order.strikePriceDOT)} DOT`);
    console.log(`  Status: ${order.status}\n`);

    // Check balance
    const balance = await assets.balanceOf.staticCall(deployer.address);
    console.log(`Deployer balance: ${ethers.formatEther(balance)} DOT\n`);

    // Try matchOrder
    console.log(`Matching order ${orderId}...`);
    try {
        const matchTx = await fm.matchOrder(orderId);
        const receipt = await matchTx.wait();
        console.log(`✓ matchOrder successful! Tx: ${receipt?.hash}`);
        
        const updatedOrder = await fm.orders.staticCall(orderId);
        console.log(`Order status after match: ${updatedOrder.status}`);
        console.log(`Buyer: ${updatedOrder.buyer}`);
    } catch (e: any) {
        console.log(`✗ matchOrder failed: ${e.message}`);
        if (e.reason) console.log(`  Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`  Error data: ${e.data}`);
            // Try to decode
            try {
                const iface = new ethers.Interface([
                    "error DOTTransferFailed(uint256)",
                    "error OrderNotFound(uint256)",
                    "error OrderNotOpen(uint256)",
                ]);
                const decoded = iface.parseError(e.data);
                console.log(`  Decoded error: ${decoded.name}(${decoded.args})`);
            } catch {}
        }
    }
}

main().catch(console.error);
