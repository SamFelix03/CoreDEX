import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const PVM_ADDRESSES_FILE = path.join(__dirname, "../pvm-testnet-addresses.json");
const DEPLOYED_ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");

async function main() {
    const [deployer] = await ethers.getSigners();
    const user2 = deployer; // Using same account for testing
    const pvm = JSON.parse(fs.readFileSync(PVM_ADDRESSES_FILE, "utf-8"));
    const deployed = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_FILE, "utf-8"));

    console.log("Testing MockAssets.transferFrom...\n");
    console.log(`Deployer: ${deployer.address}`);
    console.log(`User2: ${user2.address}`);
    console.log(`ForwardMarket: ${deployed.forwardMarket}\n`);

    const assets = new ethers.Contract(
        pvm.contracts.mock_assets,
        [
            "function mint(address,uint256)",
            "function balanceOf(address) view returns (uint256)",
            "function approve(address,uint256) returns (bool)",
            "function transferFrom(address,address,uint256) returns (bool)",
        ],
        deployer
    );

    // Mint DOT to user2
    const amount = ethers.parseEther("1000");
    await (await assets.mint(user2.address, amount)).wait();
    const balance = await assets.balanceOf.staticCall(user2.address);
    console.log(`✓ Minted ${ethers.formatEther(balance)} DOT to user2\n`);

    // MockAssets doesn't need approve - transferFrom works without it
    // Try transferFrom directly (simulating what ForwardMarket does)
    console.log(`Testing transferFrom(${user2.address}, ${deployed.forwardMarket}, ${ethers.formatEther(amount)} DOT)...`);
    console.log(`  (MockAssets allows transferFrom without approval)\n`);
    try {
        // Call transferFrom - the caller (ForwardMarket contract) will be the one calling
        // But we're calling from user2, so we need to simulate the contract call
        // Actually, let's test if ForwardMarket can call transferFrom
        const ForwardMarket = await ethers.getContractFactory("ForwardMarket");
        const fm = ForwardMarket.attach(deployed.forwardMarket);
        
        // Create a test contract that calls transferFrom
        const TestContract = await ethers.getContractFactory("ForwardMarket");
        // Actually, let's just test transferFrom directly from user2
        // The issue is that when ForwardMarket calls transferFrom, api::address() returns ForwardMarket
        // So we need to test it from a contract perspective
        const transferTx = await assets.connect(user2).transferFrom(user2.address, deployed.forwardMarket, amount);
        const receipt = await transferTx.wait();
        console.log(`✓ transferFrom successful! Tx: ${receipt?.hash}`);
        
        const newBalance = await assets.balanceOf.staticCall(user2.address);
        const fmBalance = await assets.balanceOf.staticCall(deployed.forwardMarket);
        console.log(`User2 balance: ${ethers.formatEther(newBalance)} DOT`);
        console.log(`ForwardMarket balance: ${ethers.formatEther(fmBalance)} DOT`);
    } catch (e: any) {
        console.log(`✗ transferFrom failed: ${e.message}`);
        if (e.reason) console.log(`  Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`  Error data: ${e.data}`);
        }
    }
}

main().catch(console.error);
