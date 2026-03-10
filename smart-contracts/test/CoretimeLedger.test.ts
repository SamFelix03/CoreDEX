import { expect } from "chai";
import { ethers } from "hardhat";
import { CoreDexRegistry, CoretimeLedger } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CoretimeLedger", function () {
    let registry: CoreDexRegistry;
    let ledger: CoretimeLedger;
    let governance: SignerWithAddress;
    let forwardMarket: SignerWithAddress;
    let optionsEngine: SignerWithAddress;
    let yieldVault: SignerWithAddress;
    let settlement: SignerWithAddress;
    let user: SignerWithAddress;

    const KEY_FORWARD    = ethers.keccak256(ethers.toUtf8Bytes("ForwardMarket"));
    const KEY_OPTIONS    = ethers.keccak256(ethers.toUtf8Bytes("OptionsEngine"));
    const KEY_VAULT      = ethers.keccak256(ethers.toUtf8Bytes("YieldVault"));
    const KEY_SETTLEMENT = ethers.keccak256(ethers.toUtf8Bytes("SettlementExecutor"));
    const KEY_LEDGER     = ethers.keccak256(ethers.toUtf8Bytes("CoretimeLedger"));

    const FORWARD_POSITION = ethers.keccak256(ethers.toUtf8Bytes("FORWARD"));
    const OPTION_POSITION  = ethers.keccak256(ethers.toUtf8Bytes("OPTION"));
    const VAULT_POSITION   = ethers.keccak256(ethers.toUtf8Bytes("VAULT"));

    beforeEach(async function () {
        [governance, forwardMarket, optionsEngine, yieldVault, settlement, user] =
            await ethers.getSigners();

        // Deploy registry
        const RegistryFactory = await ethers.getContractFactory("CoreDexRegistry");
        registry = await RegistryFactory.deploy(governance.address);
        await registry.waitForDeployment();

        // Deploy ledger
        const LedgerFactory = await ethers.getContractFactory("CoretimeLedger");
        ledger = await LedgerFactory.deploy(await registry.getAddress());
        await ledger.waitForDeployment();

        // Register all contracts in registry (use signers as stand-ins)
        await registry.register(KEY_LEDGER, await ledger.getAddress());
        await registry.register(KEY_FORWARD, forwardMarket.address);
        await registry.register(KEY_OPTIONS, optionsEngine.address);
        await registry.register(KEY_VAULT, yieldVault.address);
        await registry.register(KEY_SETTLEMENT, settlement.address);
    });

    // -------------------------------------------------------------------------
    // lockRegion()
    // -------------------------------------------------------------------------

    describe("lockRegion()", function () {
        it("should lock a region from a registered contract", async function () {
            await ledger.connect(forwardMarket).lockRegion(1, FORWARD_POSITION);
            expect(await ledger.isRegionLocked(1)).to.equal(true);
            expect(await ledger.getRegionLocker(1)).to.equal(forwardMarket.address);
        });

        it("should emit RegionLocked event", async function () {
            await expect(ledger.connect(forwardMarket).lockRegion(1, FORWARD_POSITION))
                .to.emit(ledger, "RegionLocked")
                .withArgs(1, forwardMarket.address, FORWARD_POSITION);
        });

        it("should revert if region already locked", async function () {
            await ledger.connect(forwardMarket).lockRegion(1, FORWARD_POSITION);
            await expect(
                ledger.connect(optionsEngine).lockRegion(1, OPTION_POSITION)
            ).to.be.revertedWithCustomError(ledger, "RegionAlreadyEncumbered");
        });

        it("should revert from unregistered caller", async function () {
            await expect(
                ledger.connect(user).lockRegion(1, FORWARD_POSITION)
            ).to.be.revertedWithCustomError(ledger, "Unauthorised");
        });

        it("should revert when paused", async function () {
            await registry.pause();
            await expect(
                ledger.connect(forwardMarket).lockRegion(1, FORWARD_POSITION)
            ).to.be.revertedWithCustomError(ledger, "ProtocolPaused");
        });

        it("should increment totalLockEvents", async function () {
            expect(await ledger.totalLockEvents()).to.equal(0);
            await ledger.connect(forwardMarket).lockRegion(1, FORWARD_POSITION);
            expect(await ledger.totalLockEvents()).to.equal(1);
        });
    });

    // -------------------------------------------------------------------------
    // unlockRegion()
    // -------------------------------------------------------------------------

    describe("unlockRegion()", function () {
        beforeEach(async function () {
            await ledger.connect(forwardMarket).lockRegion(1, FORWARD_POSITION);
        });

        it("should unlock a region from the locking contract", async function () {
            await ledger.connect(forwardMarket).unlockRegion(1);
            expect(await ledger.isRegionLocked(1)).to.equal(false);
            expect(await ledger.getRegionLocker(1)).to.equal(ethers.ZeroAddress);
        });

        it("should emit RegionUnlocked event", async function () {
            await expect(ledger.connect(forwardMarket).unlockRegion(1))
                .to.emit(ledger, "RegionUnlocked")
                .withArgs(1, forwardMarket.address);
        });

        it("should revert if caller is not the locking contract", async function () {
            await expect(
                ledger.connect(optionsEngine).unlockRegion(1)
            ).to.be.revertedWithCustomError(ledger, "Unauthorised");
        });

        it("should allow re-locking after unlock", async function () {
            await ledger.connect(forwardMarket).unlockRegion(1);
            await ledger.connect(optionsEngine).lockRegion(1, OPTION_POSITION);
            expect(await ledger.isRegionLocked(1)).to.equal(true);
            expect(await ledger.getRegionLocker(1)).to.equal(optionsEngine.address);
        });
    });

    // -------------------------------------------------------------------------
    // Margin Management
    // -------------------------------------------------------------------------

    describe("Margin Management", function () {
        it("should add margin", async function () {
            const amount = ethers.parseEther("100");
            await ledger.connect(forwardMarket).addMargin(user.address, amount);
            expect(await ledger.marginBalance(user.address)).to.equal(amount);
        });

        it("should emit MarginUpdated on add", async function () {
            const amount = ethers.parseEther("100");
            await expect(ledger.connect(forwardMarket).addMargin(user.address, amount))
                .to.emit(ledger, "MarginUpdated")
                .withArgs(user.address, amount);
        });

        it("should release margin", async function () {
            const amount = ethers.parseEther("100");
            await ledger.connect(forwardMarket).addMargin(user.address, amount);
            await ledger.connect(forwardMarket).releaseMargin(user.address, ethers.parseEther("40"));
            expect(await ledger.marginBalance(user.address)).to.equal(ethers.parseEther("60"));
        });

        it("should revert release if insufficient margin", async function () {
            const amount = ethers.parseEther("100");
            await ledger.connect(forwardMarket).addMargin(user.address, amount);
            await expect(
                ledger.connect(forwardMarket).releaseMargin(user.address, ethers.parseEther("200"))
            ).to.be.revertedWithCustomError(ledger, "ZeroAmount");
        });

        it("should revert margin ops from unregistered caller", async function () {
            await expect(
                ledger.connect(user).addMargin(user.address, 100)
            ).to.be.revertedWithCustomError(ledger, "Unauthorised");
        });
    });

    // -------------------------------------------------------------------------
    // Position Count
    // -------------------------------------------------------------------------

    describe("Position Count", function () {
        it("should increment position count", async function () {
            await ledger.connect(forwardMarket).incrementPositionCount(user.address);
            expect(await ledger.openPositionCount(user.address)).to.equal(1);
        });

        it("should decrement position count", async function () {
            await ledger.connect(forwardMarket).incrementPositionCount(user.address);
            await ledger.connect(forwardMarket).incrementPositionCount(user.address);
            await ledger.connect(forwardMarket).decrementPositionCount(user.address);
            expect(await ledger.openPositionCount(user.address)).to.equal(1);
        });

        it("should not underflow on decrement at zero", async function () {
            await ledger.connect(forwardMarket).decrementPositionCount(user.address);
            expect(await ledger.openPositionCount(user.address)).to.equal(0);
        });
    });

    // -------------------------------------------------------------------------
    // Multiple registered contracts
    // -------------------------------------------------------------------------

    describe("Multi-contract access", function () {
        it("all registered contracts can lock regions", async function () {
            await ledger.connect(forwardMarket).lockRegion(1, FORWARD_POSITION);
            await ledger.connect(optionsEngine).lockRegion(2, OPTION_POSITION);
            await ledger.connect(yieldVault).lockRegion(3, VAULT_POSITION);

            expect(await ledger.isRegionLocked(1)).to.equal(true);
            expect(await ledger.isRegionLocked(2)).to.equal(true);
            expect(await ledger.isRegionLocked(3)).to.equal(true);
        });

        it("settlement executor can lock/unlock", async function () {
            await ledger.connect(settlement).lockRegion(10, FORWARD_POSITION);
            expect(await ledger.isRegionLocked(10)).to.equal(true);
            await ledger.connect(settlement).unlockRegion(10);
            expect(await ledger.isRegionLocked(10)).to.equal(false);
        });
    });
});
