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

    // Mint NFT
    const nft = new ethers.Contract(
        pvm.contracts.coretime_nft,
        ["function mintRegion(address,uint32,uint32,uint16) returns (uint128)"],
        deployer
    );
    const regionId = await nft.mintRegion.staticCall(deployer.address, 100000, 200000, 1);
    const mintTx = await nft.mintRegion(deployer.address, 100000, 200000, 1);
    await mintTx.wait();
    console.log(`✓ Minted region ${regionId}`);

    // Approve
    const nftContract = new ethers.Contract(
        pvm.contracts.coretime_nft,
        ["function approve(address,uint256)"],
        deployer
    );
    const approveTx = await nftContract.approve(deployed.forwardMarket, regionId);
    await approveTx.wait();
    console.log(`✓ Approved region ${regionId} for ForwardMarket`);

    // Check registry paused
    const Registry = await ethers.getContractFactory("CoreDexRegistry");
    const registry = Registry.attach(deployed.registry);
    const paused = await registry.paused();
    console.log(`Registry paused: ${paused}`);

    // Try createAsk
    const ForwardMarket = await ethers.getContractFactory("ForwardMarket");
    const fm = ForwardMarket.attach(deployed.forwardMarket);
    
    try {
        console.log("\nCalling createAsk...");
        const tx = await fm.createAsk(regionId, ethers.parseEther("100"), 150000);
        const receipt = await tx.wait();
        console.log(`✓ Success! Tx: ${receipt?.hash}`);
    } catch (e: any) {
        console.log(`\n✗ Error: ${e.message}`);
        if (e.reason) console.log(`  Reason: ${e.reason}`);
        if (e.data) console.log(`  Data: ${e.data}`);
        
        // Try to decode error
        try {
            const errorInterface = new ethers.Interface([
                "error ProtocolPaused()",
                "error Unauthorised(address)",
                "error ContractNotFound(bytes32)",
            ]);
            if (e.data && e.data !== "0x") {
                const decoded = errorInterface.parseError(e.data);
                console.log(`  Decoded: ${decoded.name}(${decoded.args.join(", ")})`);
            }
        } catch {}
    }
}

main().catch(console.error);
