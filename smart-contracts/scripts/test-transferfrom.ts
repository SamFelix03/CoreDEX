import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const PVM_ADDRESSES_FILE = path.join(__dirname, "../pvm-testnet-addresses.json");
const DEPLOYED_ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");

async function main() {
    const [deployer] = await ethers.getSigners();
    const pvm = JSON.parse(fs.readFileSync(PVM_ADDRESSES_FILE, "utf-8"));
    const deployed = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_FILE, "utf-8"));

    console.log("Testing CoretimeNFT.transferFrom from EVM contract...\n");
    console.log(`Deployer: ${deployer.address}`);
    console.log(`ForwardMarket: ${deployed.forwardMarket}\n`);

    const nft = new ethers.Contract(
        pvm.contracts.coretime_nft,
        [
            "function mintRegion(address,uint32,uint32,uint16) returns (uint128)",
            "function ownerOf(uint256) view returns (address)",
            "function transferFrom(address,address,uint256)",
        ],
        deployer
    );

    // Mint NFT to deployer
    const regionId = await nft.mintRegion.staticCall(deployer.address, 100000, 200000, 1);
    console.log(`Minting region ${regionId} to deployer...`);
    const mintTx = await nft.mintRegion(deployer.address, 100000, 200000, 1);
    await mintTx.wait();
    console.log(`✓ Minted region ${regionId}`);

    // Check owner
    const owner = await nft.ownerOf.staticCall(regionId);
    console.log(`Owner of ${regionId}: ${owner}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Match: ${owner.toLowerCase() === deployer.address.toLowerCase()}\n`);

    // Try transferFrom directly (simulating what ForwardMarket does)
    console.log(`Attempting transferFrom(${deployer.address}, ${deployed.forwardMarket}, ${regionId})...`);
    try {
        const transferTx = await nft.transferFrom(deployer.address, deployed.forwardMarket, regionId);
        const receipt = await transferTx.wait();
        console.log(`✓ TransferFrom successful! Tx: ${receipt?.hash}`);
        
        // Check new owner
        const newOwner = await nft.ownerOf.staticCall(regionId);
        console.log(`New owner: ${newOwner}`);
        console.log(`ForwardMarket: ${deployed.forwardMarket}`);
        console.log(`Match: ${newOwner.toLowerCase() === deployed.forwardMarket.toLowerCase()}`);
    } catch (e: any) {
        console.log(`✗ TransferFrom failed: ${e.message}`);
        if (e.reason) console.log(`  Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`  Error data: ${e.data}`);
        }
    }
}

main().catch(console.error);
