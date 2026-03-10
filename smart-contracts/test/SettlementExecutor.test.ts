import { expect } from "chai";
import { ethers } from "hardhat";
import { CoreDexRegistry, CoretimeLedger, SettlementExecutor } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * SettlementExecutor tests.
 *
 * The SettlementExecutor dispatches XCM via the XCM Precompile. Since the
 * precompile is not available on a local Hardhat network, these tests focus
 * on access control, pause guards, state validation, and recovery logic.
 */
describe("SettlementExecutor", function () {
    let registry: CoreDexRegistry;
    let ledger: CoretimeLedger;
    let settlement: SettlementExecutor;
    let governance: SignerWithAddress;
    let forwardMarket: SignerWithAddress;
    let optionsEngine: SignerWithAddress;
    let user: SignerWithAddress;

    const KEY_LEDGER     = ethers.keccak256(ethers.toUtf8Bytes("CoretimeLedger"));
    const KEY_FORWARD    = ethers.keccak256(ethers.toUtf8Bytes("ForwardMarket"));
    const KEY_OPTIONS    = ethers.keccak256(ethers.toUtf8Bytes("OptionsEngine"));
    const KEY_VAULT      = ethers.keccak256(ethers.toUtf8Bytes("YieldVault"));
    const KEY_SETTLEMENT = ethers.keccak256(ethers.toUtf8Bytes("SettlementExecutor"));

    beforeEach(async function () {
        [governance, forwardMarket, optionsEngine, user] = await ethers.getSigners();

        const RegistryFactory = await ethers.getContractFactory("CoreDexRegistry");
        registry = await RegistryFactory.deploy(governance.address);
        await registry.waitForDeployment();

        const LedgerFactory = await ethers.getContractFactory("CoretimeLedger");
        ledger = await LedgerFactory.deploy(await registry.getAddress());
        await ledger.waitForDeployment();

        await registry.register(KEY_LEDGER, await ledger.getAddress());

        // Deploy SettlementExecutor with a dummy NFT address
        const SettlementFactory = await ethers.getContractFactory("SettlementExecutor");
        settlement = await SettlementFactory.deploy(
            await registry.getAddress(),
            user.address // dummy NFT address
        );
        await settlement.waitForDeployment();

        // Register contracts
        await registry.register(KEY_SETTLEMENT, await settlement.getAddress());
        await registry.register(KEY_FORWARD, forwardMarket.address);
        await registry.register(KEY_OPTIONS, optionsEngine.address);
        await registry.register(KEY_VAULT, user.address); // dummy
    });

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    describe("Deployment", function () {
        it("should deploy with correct initial state", async function () {
            expect(await settlement.totalSettlements()).to.equal(0);
        });

        it("should have correct constants", async function () {
            expect(await settlement.RECOVERY_TIMEOUT()).to.equal(14_400);
            expect(await settlement.CORETIME_PARA_ID()).to.equal(1005);
            expect(await settlement.ASSET_HUB_PARA_ID()).to.equal(1000);
            expect(await settlement.XCM_PRECOMPILE()).to.equal(
                "0x0000000000000000000000000000000000000808"
            );
        });

        it("should revert deployment with zero registry", async function () {
            const Factory = await ethers.getContractFactory("SettlementExecutor");
            await expect(
                Factory.deploy(ethers.ZeroAddress, user.address)
            ).to.be.revertedWithCustomError(settlement, "ZeroAddress");
        });

        it("should revert deployment with zero NFT address", async function () {
            const Factory = await ethers.getContractFactory("SettlementExecutor");
            await expect(
                Factory.deploy(await registry.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(settlement, "ZeroAddress");
        });
    });

    // -------------------------------------------------------------------------
    // Access control
    // -------------------------------------------------------------------------

    describe("Access Control", function () {
        it("should revert settleForward from non-market contract", async function () {
            await expect(
                settlement.connect(user).settleForward(
                    1,
                    user.address,
                    forwardMarket.address,
                    1,
                    ethers.parseEther("100")
                )
            ).to.be.revertedWithCustomError(settlement, "Unauthorised");
        });

        it("should revert settleOption from non-market contract", async function () {
            await expect(
                settlement.connect(user).settleOption(
                    1,
                    user.address,
                    optionsEngine.address,
                    1,
                    ethers.parseEther("100")
                )
            ).to.be.revertedWithCustomError(settlement, "Unauthorised");
        });
    });

    // -------------------------------------------------------------------------
    // Pause guards
    // -------------------------------------------------------------------------

    describe("Pause Guards", function () {
        it("should revert settleForward when paused", async function () {
            await registry.pause();
            await expect(
                settlement.connect(forwardMarket).settleForward(
                    1,
                    user.address,
                    forwardMarket.address,
                    1,
                    ethers.parseEther("100")
                )
            ).to.be.revertedWithCustomError(settlement, "ProtocolPaused");
        });

        it("should revert settleOption when paused", async function () {
            await registry.pause();
            await expect(
                settlement.connect(optionsEngine).settleOption(
                    1,
                    user.address,
                    optionsEngine.address,
                    1,
                    ethers.parseEther("100")
                )
            ).to.be.revertedWithCustomError(settlement, "ProtocolPaused");
        });

        it("should revert recoverFailed when paused", async function () {
            await registry.pause();
            await expect(
                settlement.connect(user).recoverFailed(1)
            ).to.be.revertedWithCustomError(settlement, "ProtocolPaused");
        });
    });

    // -------------------------------------------------------------------------
    // Recovery validation
    // -------------------------------------------------------------------------

    describe("recoverFailed() validation", function () {
        it("should revert for non-existent settlement", async function () {
            await expect(
                settlement.connect(user).recoverFailed(999)
            ).to.be.revertedWithCustomError(settlement, "AlreadySettled");
        });
    });

    // -------------------------------------------------------------------------
    // View functions
    // -------------------------------------------------------------------------

    describe("View functions", function () {
        it("should return default settlement for unknown position", async function () {
            const s = await settlement.getSettlement(999);
            expect(s.positionId).to.equal(0);
        });

        it("should return false for isRecoverable on unknown position", async function () {
            expect(await settlement.isRecoverable(999)).to.equal(false);
        });
    });
});
