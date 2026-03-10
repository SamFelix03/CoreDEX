import { expect } from "chai";
import { ethers } from "hardhat";
import { CoreDexRegistry, CoretimeLedger, ForwardMarket } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * ForwardMarket tests.
 *
 * The ForwardMarket depends on ICoretimeNFT, IAssetsPrecompile, and the
 * CoretimeOracle PVM precompile. Since these are not available on a local
 * Hardhat network, these tests focus on access control, pause guards, and
 * parameter validation that can be tested without actual precompile calls.
 *
 * Full integration tests would require a mock precompile environment or
 * an Asset Hub fork.
 */
describe("ForwardMarket", function () {
    let registry: CoreDexRegistry;
    let ledger: CoretimeLedger;
    let forward: ForwardMarket;
    let governance: SignerWithAddress;
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;

    const KEY_LEDGER     = ethers.keccak256(ethers.toUtf8Bytes("CoretimeLedger"));
    const KEY_FORWARD    = ethers.keccak256(ethers.toUtf8Bytes("ForwardMarket"));
    const KEY_OPTIONS    = ethers.keccak256(ethers.toUtf8Bytes("OptionsEngine"));
    const KEY_VAULT      = ethers.keccak256(ethers.toUtf8Bytes("YieldVault"));
    const KEY_SETTLEMENT = ethers.keccak256(ethers.toUtf8Bytes("SettlementExecutor"));
    const KEY_ORACLE     = ethers.keccak256(ethers.toUtf8Bytes("CoretimeOracle"));

    beforeEach(async function () {
        [governance, seller, buyer] = await ethers.getSigners();

        // Deploy registry
        const RegistryFactory = await ethers.getContractFactory("CoreDexRegistry");
        registry = await RegistryFactory.deploy(governance.address);
        await registry.waitForDeployment();

        // Deploy ledger
        const LedgerFactory = await ethers.getContractFactory("CoretimeLedger");
        ledger = await LedgerFactory.deploy(await registry.getAddress());
        await ledger.waitForDeployment();

        await registry.register(KEY_LEDGER, await ledger.getAddress());

        // Deploy ForwardMarket with a dummy NFT address
        const ForwardFactory = await ethers.getContractFactory("ForwardMarket");
        forward = await ForwardFactory.deploy(
            await registry.getAddress(),
            seller.address // dummy NFT address for testing
        );
        await forward.waitForDeployment();

        await registry.register(KEY_FORWARD, await forward.getAddress());
    });

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    describe("Deployment", function () {
        it("should deploy with correct initial state", async function () {
            expect(await forward.nextOrderId()).to.equal(1);
        });

        it("should revert deployment with zero registry", async function () {
            const Factory = await ethers.getContractFactory("ForwardMarket");
            await expect(
                Factory.deploy(ethers.ZeroAddress, seller.address)
            ).to.be.revertedWithCustomError(forward, "ZeroAddress");
        });

        it("should revert deployment with zero NFT address", async function () {
            const Factory = await ethers.getContractFactory("ForwardMarket");
            await expect(
                Factory.deploy(await registry.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(forward, "ZeroAddress");
        });
    });

    // -------------------------------------------------------------------------
    // Pause guards
    // -------------------------------------------------------------------------

    describe("Pause Guards", function () {
        it("should revert createAsk when paused", async function () {
            await registry.pause();
            await expect(
                forward.connect(seller).createAsk(1, 100, 1000)
            ).to.be.revertedWithCustomError(forward, "ProtocolPaused");
        });

        it("should revert matchOrder when paused", async function () {
            await registry.pause();
            await expect(
                forward.connect(buyer).matchOrder(1)
            ).to.be.revertedWithCustomError(forward, "ProtocolPaused");
        });

        it("should revert settle when paused", async function () {
            await registry.pause();
            await expect(
                forward.connect(seller).settle(1)
            ).to.be.revertedWithCustomError(forward, "ProtocolPaused");
        });

        it("should revert cancel when paused", async function () {
            await registry.pause();
            await expect(
                forward.connect(seller).cancel(1)
            ).to.be.revertedWithCustomError(forward, "ProtocolPaused");
        });

        it("should revert expireOrder when paused", async function () {
            await registry.pause();
            await expect(
                forward.connect(seller).expireOrder(1)
            ).to.be.revertedWithCustomError(forward, "ProtocolPaused");
        });
    });

    // -------------------------------------------------------------------------
    // createAsk() validation
    // -------------------------------------------------------------------------

    describe("createAsk() validation", function () {
        it("should revert with zero strike price", async function () {
            const futureBlock = (await ethers.provider.getBlockNumber()) + 1000;
            await expect(
                forward.connect(seller).createAsk(1, 0, futureBlock)
            ).to.be.revertedWithCustomError(forward, "ZeroAmount");
        });

        it("should revert with delivery block in the past", async function () {
            await expect(
                forward.connect(seller).createAsk(1, 100, 1) // block 1 is in the past
            ).to.be.revertedWithCustomError(forward, "DeliveryBlockInPast");
        });
    });

    // -------------------------------------------------------------------------
    // matchOrder() validation
    // -------------------------------------------------------------------------

    describe("matchOrder() validation", function () {
        it("should revert for non-existent order", async function () {
            await expect(
                forward.connect(buyer).matchOrder(999)
            ).to.be.revertedWithCustomError(forward, "OrderNotFound");
        });
    });

    // -------------------------------------------------------------------------
    // settle() validation
    // -------------------------------------------------------------------------

    describe("settle() validation", function () {
        it("should revert for non-existent order", async function () {
            await expect(
                forward.connect(seller).settle(999)
            ).to.be.revertedWithCustomError(forward, "OrderNotFound");
        });
    });

    // -------------------------------------------------------------------------
    // cancel() validation
    // -------------------------------------------------------------------------

    describe("cancel() validation", function () {
        it("should revert for non-existent order", async function () {
            await expect(
                forward.connect(seller).cancel(999)
            ).to.be.revertedWithCustomError(forward, "OrderNotFound");
        });
    });

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    describe("View functions", function () {
        it("should return empty arrays for new addresses", async function () {
            expect(await forward.getSellerOrders(seller.address)).to.deep.equal([]);
            expect(await forward.getBuyerOrders(buyer.address)).to.deep.equal([]);
        });

        it("should return zero for unregistered region order", async function () {
            expect(await forward.getRegionOrder(999)).to.equal(0);
        });
    });

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    describe("Constants", function () {
        it("should have correct GRACE_PERIOD", async function () {
            expect(await forward.GRACE_PERIOD()).to.equal(14_400);
        });

        it("should have correct PRICE_BAND_PCT", async function () {
            expect(await forward.PRICE_BAND_PCT()).to.equal(50);
        });

        it("should have correct ASSETS_PRECOMPILE", async function () {
            expect(await forward.ASSETS_PRECOMPILE()).to.equal(
                "0x0000000000000000000000000000000000000806"
            );
        });
    });
});
