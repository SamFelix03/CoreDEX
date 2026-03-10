import { expect } from "chai";
import { ethers } from "hardhat";
import { CoreDexRegistry, CoretimeLedger, OptionsEngine } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * OptionsEngine tests.
 *
 * Like ForwardMarket, the OptionsEngine depends on precompiles (ICoretimeNFT,
 * IAssetsPrecompile, PricingModule PVM, CoretimeOracle PVM). These tests cover
 * deployment, access control, pause guards, and parameter validation.
 */
describe("OptionsEngine", function () {
    let registry: CoreDexRegistry;
    let ledger: CoretimeLedger;
    let options: OptionsEngine;
    let governance: SignerWithAddress;
    let writer: SignerWithAddress;
    let holder: SignerWithAddress;

    const KEY_LEDGER     = ethers.keccak256(ethers.toUtf8Bytes("CoretimeLedger"));
    const KEY_OPTIONS    = ethers.keccak256(ethers.toUtf8Bytes("OptionsEngine"));
    const KEY_FORWARD    = ethers.keccak256(ethers.toUtf8Bytes("ForwardMarket"));
    const KEY_VAULT      = ethers.keccak256(ethers.toUtf8Bytes("YieldVault"));
    const KEY_SETTLEMENT = ethers.keccak256(ethers.toUtf8Bytes("SettlementExecutor"));
    const KEY_ORACLE     = ethers.keccak256(ethers.toUtf8Bytes("CoretimeOracle"));
    const KEY_PRICING    = ethers.keccak256(ethers.toUtf8Bytes("PricingModule"));

    beforeEach(async function () {
        [governance, writer, holder] = await ethers.getSigners();

        const RegistryFactory = await ethers.getContractFactory("CoreDexRegistry");
        registry = await RegistryFactory.deploy(governance.address);
        await registry.waitForDeployment();

        const LedgerFactory = await ethers.getContractFactory("CoretimeLedger");
        ledger = await LedgerFactory.deploy(await registry.getAddress());
        await ledger.waitForDeployment();

        await registry.register(KEY_LEDGER, await ledger.getAddress());

        // Deploy OptionsEngine with a dummy NFT address
        const OptionsFactory = await ethers.getContractFactory("OptionsEngine");
        options = await OptionsFactory.deploy(
            await registry.getAddress(),
            writer.address // dummy NFT address
        );
        await options.waitForDeployment();

        await registry.register(KEY_OPTIONS, await options.getAddress());
    });

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    describe("Deployment", function () {
        it("should deploy with correct initial state", async function () {
            expect(await options.nextOptionId()).to.equal(1);
        });

        it("should have correct constants", async function () {
            expect(await options.OPTION_CALL()).to.equal(0);
            expect(await options.OPTION_PUT()).to.equal(1);
            expect(await options.ASSETS_PRECOMPILE()).to.equal(
                "0x0000000000000000000000000000000000000806"
            );
        });

        it("should revert deployment with zero registry", async function () {
            const Factory = await ethers.getContractFactory("OptionsEngine");
            await expect(
                Factory.deploy(ethers.ZeroAddress, writer.address)
            ).to.be.revertedWithCustomError(options, "ZeroAddress");
        });

        it("should revert deployment with zero NFT address", async function () {
            const Factory = await ethers.getContractFactory("OptionsEngine");
            await expect(
                Factory.deploy(await registry.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(options, "ZeroAddress");
        });
    });

    // -------------------------------------------------------------------------
    // Pause guards
    // -------------------------------------------------------------------------

    describe("Pause Guards", function () {
        it("should revert writeCall when paused", async function () {
            await registry.pause();
            const futureBlock = (await ethers.provider.getBlockNumber()) + 1000;
            await expect(
                options.connect(writer).writeCall(1, 100, futureBlock)
            ).to.be.revertedWithCustomError(options, "ProtocolPaused");
        });

        it("should revert writePut when paused", async function () {
            await registry.pause();
            const futureBlock = (await ethers.provider.getBlockNumber()) + 1000;
            await expect(
                options.connect(writer).writePut(1, 100, futureBlock)
            ).to.be.revertedWithCustomError(options, "ProtocolPaused");
        });

        it("should revert buyOption when paused", async function () {
            await registry.pause();
            await expect(
                options.connect(holder).buyOption(1)
            ).to.be.revertedWithCustomError(options, "ProtocolPaused");
        });

        it("should revert exercise when paused", async function () {
            await registry.pause();
            await expect(
                options.connect(holder).exercise(1)
            ).to.be.revertedWithCustomError(options, "ProtocolPaused");
        });

        it("should revert expireOption when paused", async function () {
            await registry.pause();
            await expect(
                options.connect(writer).expireOption(1)
            ).to.be.revertedWithCustomError(options, "ProtocolPaused");
        });
    });

    // -------------------------------------------------------------------------
    // writeCall() validation
    // -------------------------------------------------------------------------

    describe("writeCall() validation", function () {
        it("should revert with zero strike price", async function () {
            const futureBlock = (await ethers.provider.getBlockNumber()) + 1000;
            await expect(
                options.connect(writer).writeCall(1, 0, futureBlock)
            ).to.be.revertedWithCustomError(options, "ZeroAmount");
        });

        it("should revert with expiry block in the past", async function () {
            await expect(
                options.connect(writer).writeCall(1, 100, 1)
            ).to.be.revertedWithCustomError(options, "DeliveryBlockInPast");
        });
    });

    // -------------------------------------------------------------------------
    // writePut() validation
    // -------------------------------------------------------------------------

    describe("writePut() validation", function () {
        it("should revert with zero strike price", async function () {
            const futureBlock = (await ethers.provider.getBlockNumber()) + 1000;
            await expect(
                options.connect(writer).writePut(1, 0, futureBlock)
            ).to.be.revertedWithCustomError(options, "ZeroAmount");
        });

        it("should revert with expiry block in the past", async function () {
            await expect(
                options.connect(writer).writePut(1, 100, 1)
            ).to.be.revertedWithCustomError(options, "DeliveryBlockInPast");
        });
    });

    // -------------------------------------------------------------------------
    // buyOption() validation
    // -------------------------------------------------------------------------

    describe("buyOption() validation", function () {
        it("should revert for non-existent option", async function () {
            await expect(
                options.connect(holder).buyOption(999)
            ).to.be.revertedWithCustomError(options, "OptionNotActive");
        });
    });

    // -------------------------------------------------------------------------
    // exercise() validation
    // -------------------------------------------------------------------------

    describe("exercise() validation", function () {
        it("should revert for non-existent option", async function () {
            await expect(
                options.connect(holder).exercise(999)
            ).to.be.revertedWithCustomError(options, "OptionNotActive");
        });
    });

    // -------------------------------------------------------------------------
    // expireOption() validation
    // -------------------------------------------------------------------------

    describe("expireOption() validation", function () {
        it("should revert for non-existent option", async function () {
            await expect(
                options.connect(writer).expireOption(999)
            ).to.be.revertedWithCustomError(options, "OptionNotActive");
        });
    });

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    describe("View functions", function () {
        it("should return empty arrays for new addresses", async function () {
            expect(await options.getWriterOptions(writer.address)).to.deep.equal([]);
            expect(await options.getHolderOptions(holder.address)).to.deep.equal([]);
        });
    });
});
