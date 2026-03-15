import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const DEPLOYED_ADDRESSES_FILE = path.join(__dirname, "../deployed-addresses.json");
const PVM_ADDRESSES_FILE = path.join(__dirname, "../pvm-testnet-addresses.json");

async function main() {
    const [deployer] = await ethers.getSigners();
    
    const user2PrivateKey = process.env.USER2_PRIVATE_KEY;
    if (!user2PrivateKey) {
        throw new Error("USER2_PRIVATE_KEY environment variable is required");
    }
    const user2Wallet = new ethers.Wallet(user2PrivateKey, ethers.provider);
    const user1 = deployer;
    const user2 = user2Wallet;

    const deployed = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESSES_FILE, "utf-8"));
    const pvmAddresses = JSON.parse(fs.readFileSync(PVM_ADDRESSES_FILE, "utf-8"));

    const assets = new ethers.Contract(
        pvmAddresses.contracts.mock_assets,
        ["function balanceOf(address) view returns (uint256)"],
        deployer
    );

    const OptionsEngine = await ethers.getContractFactory("OptionsEngine");
    const optionsEngine = OptionsEngine.attach(deployed.optionsEngine);

    const optionId = 1n;
    const option = await optionsEngine.options.staticCall(optionId);
    const premium = option.premiumDOT;

    console.log(`Option ${optionId}:`);
    console.log(`  Premium: ${ethers.formatEther(premium)} DOT`);
    console.log(`  Writer: ${option.writer}`);
    console.log(`  Holder: ${option.holder}`);
    console.log(`  Status: ${option.status}\n`);

    console.log(`User2 balance: ${ethers.formatEther(await assets.balanceOf.staticCall(user2.address))} DOT`);
    console.log(`OptionsEngine balance: ${ethers.formatEther(await assets.balanceOf.staticCall(deployed.optionsEngine))} DOT`);
    console.log(`Writer balance: ${ethers.formatEther(await assets.balanceOf.staticCall(option.writer))} DOT\n`);

    console.log(`Attempting buyOption(${optionId})...`);
    try {
        const buyTx = await optionsEngine.connect(user2).buyOption(optionId);
        const receipt = await buyTx.wait();
        console.log(`✓ buyOption successful! Tx: ${receipt?.hash}`);
    } catch (e: any) {
        console.log(`✗ buyOption failed: ${e.message}`);
        if (e.reason) console.log(`  Reason: ${e.reason}`);
        if (e.data && e.data !== "0x") {
            console.log(`  Error data: ${e.data}`);
            // Try to decode
            try {
                const iface = new ethers.Interface([
                    "error DOTTransferFailed(uint256)",
                    "error OptionNotActive(uint256)",
                    "error Unauthorised(address)",
                ]);
                const decoded = iface.parseError(e.data);
                console.log(`  Decoded error: ${decoded.name}(${decoded.args})`);
            } catch {}
        }
    }
}

main().catch(console.error);
