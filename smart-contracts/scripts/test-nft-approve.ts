import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const PVM_ADDRESSES_FILE = path.join(__dirname, "../pvm-testnet-addresses.json");

async function main() {
    const [deployer] = await ethers.getSigners();
    const pvm = JSON.parse(fs.readFileSync(PVM_ADDRESSES_FILE, "utf-8"));

    console.log("Testing CoretimeNFT approve...\n");
    console.log(`Deployer: ${deployer.address}\n`);

    const nft = new ethers.Contract(
        pvm.contracts.coretime_nft,
        [
            "function mintRegion(address,uint32,uint32,uint16) returns (uint128)",
            "function ownerOf(uint256) view returns (address)",
            "function approve(address,uint256)",
        ],
        deployer
    );

    // Mint NFT
    const regionId = await nft.mintRegion.staticCall(deployer.address, 100000, 200000, 1);
    console.log(`Minting region ${regionId}...`);
    const mintTx = await nft.mintRegion(deployer.address, 100000, 200000, 1);
    await mintTx.wait();
    console.log(`✓ Minted region ${regionId}`);

    // Check owner
    const owner = await nft.ownerOf.staticCall(regionId);
    console.log(`Owner of ${regionId}: ${owner}`);
    console.log(`Deployer address: ${deployer.address}`);
    console.log(`Match: ${owner.toLowerCase() === deployer.address.toLowerCase()}\n`);

    // Try approve
    const forwardMarket = "0x5d3D7f3B02F0C88cfE2FcD1028EF9319097b38d9";
    console.log(`Attempting to approve ${forwardMarket} for region ${regionId}...`);
    try {
        const approveTx = await nft.approve(forwardMarket, regionId);
        const receipt = await approveTx.wait();
        console.log(`✓ Approve successful! Tx: ${receipt?.hash}`);
    } catch (e: any) {
        console.log(`✗ Approve failed: ${e.message}`);
        if (e.reason) console.log(`  Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`  Error data: ${e.data}`);
        }
    }
}

main().catch(console.error);
