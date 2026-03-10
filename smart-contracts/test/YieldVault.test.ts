import { expect } from "chai";
import { ethers } from "hardhat";
import { CoreDexRegistry, CoretimeLedger, YieldVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * YieldVault tests.
 *
 * The vault depends on ICoretimeNFT and IAssetsPrecompile which are precompiles
 * on Asset Hub. For unit testing on a local Hardhat network we deploy mock
 * contracts that implement these interfaces.
 */
describe("YieldVault", function () {
    let registry: CoreDexRegistry;
    let ledger: CoretimeLedger;
    let vault: YieldVault;
    let governance: SignerWithAddress;
    let depositor: SignerWithAddress;
    let borrower: SignerWithAddress;

    const KEY_LEDGER     = ethers.keccak256(ethers.toUtf8Bytes("CoretimeLedger"));
    const KEY_VAULT      = ethers.keccak256(ethers.toUtf8Bytes("YieldVault"));
    const KEY_FORWARD    = ethers.keccak256(ethers.toUtf8Bytes("ForwardMarket"));
    const KEY_OPTIONS    = ethers.keccak256(ethers.toUtf8Bytes("OptionsEngine"));
    const KEY_SETTLEMENT = ethers.keccak256(ethers.toUtf8Bytes("SettlementExecutor"));

    // We can't deploy the real ICoretimeNFT precompile on Hardhat, so these
    // tests focus on the vault's state management and access control logic
    // that does NOT require actual NFT transfers. Integration tests with
    // mocked precompiles would be a next step.

    describe("Deployment & View Functions", function () {
        beforeEach(async function () {
            [governance, depositor, borrower] = await ethers.getSigners();

            const RegistryFactory = await ethers.getContractFactory("CoreDexRegistry");
            registry = await RegistryFactory.deploy(governance.address);
            await registry.waitForDeployment();

            const LedgerFactory = await ethers.getContractFactory("CoretimeLedger");
            ledger = await LedgerFactory.deploy(await registry.getAddress());
            await ledger.waitForDeployment();

            await registry.register(KEY_LEDGER, await ledger.getAddress());
        });

        it("should deploy with correct initial state", async function () {
            // Use a dummy NFT address for deployment test
            const VaultFactory = await ethers.getContractFactory("YieldVault");
            vault = await VaultFactory.deploy(
                await registry.getAddress(),
                depositor.address // dummy NFT address
            );
            await vault.waitForDeployment();

            expect(await vault.totalDeposited()).to.equal(0);
            expect(await vault.totalLent()).to.equal(0);
            expect(await vault.currentEpoch()).to.equal(1);
            expect(await vault.nextReceiptId()).to.equal(1);
            expect(await vault.nextLoanId()).to.equal(1);
        });

        it("should revert deployment with zero registry", async function () {
            const VaultFactory = await ethers.getContractFactory("YieldVault");
            await expect(
                VaultFactory.deploy(ethers.ZeroAddress, depositor.address)
            ).to.be.revertedWithCustomError(ledger, "ZeroAddress");
        });

        it("should revert deployment with zero NFT address", async function () {
            const VaultFactory = await ethers.getContractFactory("YieldVault");
            await expect(
                VaultFactory.deploy(await registry.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(ledger, "ZeroAddress");
        });

        it("should return correct lending rate at zero utilisation", async function () {
            const VaultFactory = await ethers.getContractFactory("YieldVault");
            vault = await VaultFactory.deploy(
                await registry.getAddress(),
                depositor.address
            );
            await vault.waitForDeployment();

            const rate = await vault.currentLendingRate();
            expect(rate).to.equal(BigInt(1e12)); // BASE_RATE
        });

        it("should return zero utilisation at zero deposits", async function () {
            const VaultFactory = await ethers.getContractFactory("YieldVault");
            vault = await VaultFactory.deploy(
                await registry.getAddress(),
                depositor.address
            );
            await vault.waitForDeployment();

            expect(await vault.utilisationRate()).to.equal(0);
        });

        it("should return zero available regions at zero deposits", async function () {
            const VaultFactory = await ethers.getContractFactory("YieldVault");
            vault = await VaultFactory.deploy(
                await registry.getAddress(),
                depositor.address
            );
            await vault.waitForDeployment();

            expect(await vault.availableRegions()).to.equal(0);
        });

        it("should revert borrow with no deposits", async function () {
            const VaultFactory = await ethers.getContractFactory("YieldVault");
            vault = await VaultFactory.deploy(
                await registry.getAddress(),
                depositor.address
            );
            await vault.waitForDeployment();

            // Register vault so it can call ledger
            await registry.register(KEY_VAULT, await vault.getAddress());

            await expect(
                vault.connect(borrower).borrow(1, 100)
            ).to.be.revertedWithCustomError(vault, "InsufficientLiquidity");
        });

        it("should revert borrow with zero coreCount", async function () {
            const VaultFactory = await ethers.getContractFactory("YieldVault");
            vault = await VaultFactory.deploy(
                await registry.getAddress(),
                depositor.address
            );
            await vault.waitForDeployment();

            await expect(
                vault.connect(borrower).borrow(0, 100)
            ).to.be.revertedWithCustomError(vault, "ZeroAmount");
        });

        it("should revert borrow with zero duration", async function () {
            const VaultFactory = await ethers.getContractFactory("YieldVault");
            vault = await VaultFactory.deploy(
                await registry.getAddress(),
                depositor.address
            );
            await vault.waitForDeployment();

            await expect(
                vault.connect(borrower).borrow(1, 0)
            ).to.be.revertedWithCustomError(vault, "ZeroAmount");
        });
    });

    describe("Pause guard", function () {
        beforeEach(async function () {
            [governance, depositor, borrower] = await ethers.getSigners();

            const RegistryFactory = await ethers.getContractFactory("CoreDexRegistry");
            registry = await RegistryFactory.deploy(governance.address);
            await registry.waitForDeployment();

            const LedgerFactory = await ethers.getContractFactory("CoretimeLedger");
            ledger = await LedgerFactory.deploy(await registry.getAddress());
            await ledger.waitForDeployment();

            await registry.register(KEY_LEDGER, await ledger.getAddress());

            const VaultFactory = await ethers.getContractFactory("YieldVault");
            vault = await VaultFactory.deploy(
                await registry.getAddress(),
                depositor.address
            );
            await vault.waitForDeployment();

            await registry.register(KEY_VAULT, await vault.getAddress());
        });

        it("should revert deposit when paused", async function () {
            await registry.pause();
            await expect(
                vault.connect(depositor).deposit(1)
            ).to.be.revertedWithCustomError(vault, "ProtocolPaused");
        });

        it("should revert withdraw when paused", async function () {
            await registry.pause();
            await expect(
                vault.connect(depositor).withdraw(1)
            ).to.be.revertedWithCustomError(vault, "ProtocolPaused");
        });

        it("should revert borrow when paused", async function () {
            await registry.pause();
            await expect(
                vault.connect(borrower).borrow(1, 100)
            ).to.be.revertedWithCustomError(vault, "ProtocolPaused");
        });
    });
});
