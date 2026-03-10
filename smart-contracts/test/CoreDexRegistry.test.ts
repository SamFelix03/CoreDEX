import { expect } from "chai";
import { ethers } from "hardhat";
import { CoreDexRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CoreDexRegistry", function () {
    let registry: CoreDexRegistry;
    let governance: SignerWithAddress;
    let user: SignerWithAddress;
    let other: SignerWithAddress;

    const KEY_FORWARD = ethers.keccak256(ethers.toUtf8Bytes("ForwardMarket"));
    const KEY_OPTIONS = ethers.keccak256(ethers.toUtf8Bytes("OptionsEngine"));

    beforeEach(async function () {
        [governance, user, other] = await ethers.getSigners();

        const Factory = await ethers.getContractFactory("CoreDexRegistry");
        registry = await Factory.deploy(governance.address);
        await registry.waitForDeployment();
    });

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    describe("Deployment", function () {
        it("should set governance address", async function () {
            expect(await registry.governance()).to.equal(governance.address);
        });

        it("should start unpaused", async function () {
            expect(await registry.paused()).to.equal(false);
        });

        it("should start at version 1", async function () {
            expect(await registry.version()).to.equal(1);
        });

        it("should revert on zero governance address", async function () {
            const Factory = await ethers.getContractFactory("CoreDexRegistry");
            await expect(Factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
                registry,
                "ZeroAddress"
            );
        });
    });

    // -------------------------------------------------------------------------
    // register()
    // -------------------------------------------------------------------------

    describe("register()", function () {
        it("should register a contract address", async function () {
            await registry.register(KEY_FORWARD, user.address);
            expect(await registry.resolve(KEY_FORWARD)).to.equal(user.address);
        });

        it("should increment version on register", async function () {
            await registry.register(KEY_FORWARD, user.address);
            expect(await registry.version()).to.equal(2);
        });

        it("should emit ContractUpdated event", async function () {
            await expect(registry.register(KEY_FORWARD, user.address))
                .to.emit(registry, "ContractUpdated")
                .withArgs(KEY_FORWARD, ethers.ZeroAddress, user.address, 2);
        });

        it("should revert if caller is not governance", async function () {
            await expect(
                registry.connect(user).register(KEY_FORWARD, other.address)
            ).to.be.revertedWithCustomError(registry, "Unauthorised");
        });

        it("should revert on zero address", async function () {
            await expect(
                registry.register(KEY_FORWARD, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(registry, "ZeroAddress");
        });

        it("should overwrite an existing registration", async function () {
            await registry.register(KEY_FORWARD, user.address);
            await registry.register(KEY_FORWARD, other.address);
            expect(await registry.resolve(KEY_FORWARD)).to.equal(other.address);
            expect(await registry.version()).to.equal(3);
        });
    });

    // -------------------------------------------------------------------------
    // resolve()
    // -------------------------------------------------------------------------

    describe("resolve()", function () {
        it("should revert for unregistered key", async function () {
            await expect(
                registry.resolve(KEY_FORWARD)
            ).to.be.revertedWithCustomError(registry, "ContractNotFound");
        });

        it("should return registered address", async function () {
            await registry.register(KEY_FORWARD, user.address);
            expect(await registry.resolve(KEY_FORWARD)).to.equal(user.address);
        });
    });

    // -------------------------------------------------------------------------
    // proposeUpdate() + executeUpdate() (timelock)
    // -------------------------------------------------------------------------

    describe("Timelock Updates", function () {
        beforeEach(async function () {
            await registry.register(KEY_FORWARD, user.address);
        });

        it("should propose an update", async function () {
            await registry.proposeUpdate(KEY_FORWARD, other.address);
            const pending = await registry.pendingUpdates(KEY_FORWARD);
            expect(pending.newAddress).to.equal(other.address);
            expect(pending.exists).to.equal(true);
        });

        it("should revert executeUpdate before timelock expires", async function () {
            await registry.proposeUpdate(KEY_FORWARD, other.address);
            await expect(
                registry.executeUpdate(KEY_FORWARD)
            ).to.be.revertedWithCustomError(registry, "TimelockNotExpired");
        });

        it("should execute update after timelock expires", async function () {
            await registry.proposeUpdate(KEY_FORWARD, other.address);

            // Mine 28,800 blocks (TIMELOCK_DELAY)
            await ethers.provider.send("hardhat_mine", [ethers.toQuantity(28_800)]);

            await registry.executeUpdate(KEY_FORWARD);
            expect(await registry.resolve(KEY_FORWARD)).to.equal(other.address);
        });

        it("should emit ContractUpdated on execute", async function () {
            await registry.proposeUpdate(KEY_FORWARD, other.address);
            await ethers.provider.send("hardhat_mine", [ethers.toQuantity(28_800)]);

            await expect(registry.executeUpdate(KEY_FORWARD))
                .to.emit(registry, "ContractUpdated");
        });

        it("should revert proposeUpdate from non-governance", async function () {
            await expect(
                registry.connect(user).proposeUpdate(KEY_FORWARD, other.address)
            ).to.be.revertedWithCustomError(registry, "Unauthorised");
        });

        it("should revert executeUpdate for non-existent proposal", async function () {
            await expect(
                registry.executeUpdate(KEY_OPTIONS)
            ).to.be.revertedWithCustomError(registry, "ContractNotFound");
        });
    });

    // -------------------------------------------------------------------------
    // pause() / unpause()
    // -------------------------------------------------------------------------

    describe("Pause/Unpause", function () {
        it("should pause the protocol", async function () {
            await registry.pause();
            expect(await registry.paused()).to.equal(true);
        });

        it("should emit ProtocolPaused event", async function () {
            await expect(registry.pause())
                .to.emit(registry, "ProtocolPaused")
                .withArgs(governance.address);
        });

        it("should unpause the protocol", async function () {
            await registry.pause();
            await registry.unpause();
            expect(await registry.paused()).to.equal(false);
        });

        it("should emit ProtocolUnpaused event", async function () {
            await registry.pause();
            await expect(registry.unpause())
                .to.emit(registry, "ProtocolUnpaused")
                .withArgs(governance.address);
        });

        it("should revert pause from non-governance", async function () {
            await expect(
                registry.connect(user).pause()
            ).to.be.revertedWithCustomError(registry, "Unauthorised");
        });

        it("should revert unpause from non-governance", async function () {
            await registry.pause();
            await expect(
                registry.connect(user).unpause()
            ).to.be.revertedWithCustomError(registry, "Unauthorised");
        });
    });

    // -------------------------------------------------------------------------
    // transferGovernance()
    // -------------------------------------------------------------------------

    describe("transferGovernance()", function () {
        it("should transfer governance", async function () {
            await registry.transferGovernance(user.address);
            expect(await registry.governance()).to.equal(user.address);
        });

        it("should revert on zero address", async function () {
            await expect(
                registry.transferGovernance(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(registry, "ZeroAddress");
        });

        it("should revert from non-governance", async function () {
            await expect(
                registry.connect(user).transferGovernance(other.address)
            ).to.be.revertedWithCustomError(registry, "Unauthorised");
        });

        it("new governance should be able to register", async function () {
            await registry.transferGovernance(user.address);
            await registry.connect(user).register(KEY_FORWARD, other.address);
            expect(await registry.resolve(KEY_FORWARD)).to.equal(other.address);
        });
    });
});
