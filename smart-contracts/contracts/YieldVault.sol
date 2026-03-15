// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Errors}            from "./libraries/Errors.sol";
import {Events}            from "./libraries/Events.sol";
import {CoreDexRegistry}   from "./CoreDexRegistry.sol";
import {CoretimeLedger}    from "./CoretimeLedger.sol";
import {ICoretimeNFT}      from "./interfaces/ICoretimeNFT.sol";
import {IAssetsPrecompile} from "./interfaces/IAssetsPrecompile.sol";

/// @title YieldVault
/// @notice Allows coretime NFT holders who have purchased bulk coretime but are
///         not using all of it to deposit their excess into the vault, which
///         lends it out on a short-term basis to demand spikes. Depositors earn
///         yield from lending fees distributed pro-rata per epoch.
///
/// @dev    DEPOSIT MODEL:
///         - Depositor calls deposit(regionId) → NFT transferred to vault.
///         - Depositor receives a vault receipt (tracked internally; ERC-1155
///           compatible receipt tokens can be layered on top later).
///         - Depositor can withdraw IF their specific region is not currently lent.
///
///         LENDING MODEL:
///         - Borrower calls borrow(coreCount, durationBlocks).
///         - Fee = coreCount × durationBlocks × currentLendingRate.
///         - Rate = baseRate × (utilisation² + 1) — squared curve spikes sharply
///           as the vault approaches full utilisation.
///         - Loans auto-expire at startBlock + durationBlocks.
///
///         YIELD DISTRIBUTION:
///         - Fees collected in DOT, distributed pro-rata per epoch.
///         - Epoch = 1 relay chain week (100,800 blocks at 6s).
///
///         INVARIANTS:
///         - A region deposited in the vault is locked in CoretimeLedger with
///           positionType = VAULT_POSITION. No other contract may encumber it.
///         - A region that is currently lent cannot be withdrawn.
///         - Only the original depositor can withdraw or claim yield for a receipt.
contract YieldVault {

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Assets Precompile address on Asset Hub.
    address public constant ASSETS_PRECOMPILE =
        0xc82e04234549D48b961d8Cb3F3c60609dDF3F006; // MockAssets PVM contract

    /// @notice Base lending rate in DOT planck per core-block (18 decimals).
    ///         0.000001 DOT per core-block at zero utilisation.
    uint128 public constant BASE_RATE = 1e12;

    /// @notice Epoch length in blocks (~1 week at 6s blocks).
    uint32 public constant EPOCH_BLOCKS = 100_800;

    /// @notice Rate precision denominator (18 decimals).
    uint128 public constant RATE_PRECISION = 1e18;

    // -------------------------------------------------------------------------
    // Registry keys
    // -------------------------------------------------------------------------

    bytes32 public constant KEY_LEDGER = keccak256("CoretimeLedger");

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    /// @notice Represents a deposited coretime region in the vault.
    struct VaultDeposit {
        uint256 receiptTokenId;   // unique receipt ID
        address depositor;        // original depositor
        uint128 regionId;         // coretime NFT token ID
        uint32  depositBlock;     // block at which deposit occurred
        bool    isLent;           // true if currently lent out
        bool    withdrawn;        // true if depositor has withdrawn
    }

    /// @notice Represents an active or completed lending loan.
    struct Loan {
        uint256 loanId;           // unique loan ID
        address borrower;         // address that borrowed the region
        uint128 regionId;         // coretime NFT token ID that was lent
        uint32  startBlock;       // block at which loan started
        uint32  durationBlocks;   // loan duration in blocks
        uint128 feePaid;          // DOT fee paid by borrower
        bool    returned;         // true if loan has been returned
    }

    /// @notice Tracks fee accumulation and distribution for a single epoch.
    struct EpochData {
        uint256 totalFeesCollected;   // total DOT fees collected in this epoch
        uint256 activeDepositCount;   // number of active deposits during epoch snapshot
        bool    finalized;            // true if epoch has been finalized
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Reference to the CoreDexRegistry.
    CoreDexRegistry public immutable registry;

    /// @notice Reference to the Coretime NFT contract.
    ICoretimeNFT public immutable coretimeNFT;

    /// @notice All deposits by receipt token ID.
    mapping(uint256 => VaultDeposit) public deposits;

    /// @notice All loans by loan ID.
    mapping(uint256 => Loan) public loans;

    /// @notice Region ID → receipt token ID mapping (zero if not deposited).
    mapping(uint128 => uint256) public regionToReceipt;

    /// @notice Depositor → list of receipt token IDs.
    mapping(address => uint256[]) public depositorReceipts;

    /// @notice Epoch data for yield distribution.
    mapping(uint256 => EpochData) public epochs;

    /// @notice Tracks whether yield has been claimed for a receipt in an epoch.
    mapping(uint256 => mapping(uint256 => bool)) public yieldClaimed;

    /// @notice Next receipt token ID (auto-incrementing).
    uint256 public nextReceiptId;

    /// @notice Next loan ID (auto-incrementing).
    uint256 public nextLoanId;

    /// @notice Current epoch number (starts at 1).
    uint256 public currentEpoch;

    /// @notice Block at which the current epoch started.
    uint256 public epochStartBlock;

    /// @notice Total deposited regions (available + lent, excluding withdrawn).
    uint256 public totalDeposited;

    /// @notice Total currently lent regions.
    uint256 public totalLent;

    /// @notice Accumulated fees in the current epoch.
    uint256 public currentEpochFees;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _registry    Address of the deployed CoreDexRegistry.
    /// @param _coretimeNFT Address of the Coretime NFT precompile.
    constructor(address _registry, address _coretimeNFT) {
        if (_registry == address(0)) revert Errors.ZeroAddress();
        if (_coretimeNFT == address(0)) revert Errors.ZeroAddress();
        registry    = CoreDexRegistry(_registry);
        coretimeNFT = ICoretimeNFT(_coretimeNFT);
        nextReceiptId  = 1;
        nextLoanId     = 1;
        currentEpoch   = 1;
        epochStartBlock = block.number;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    /// @notice Ensures the protocol is not paused.
    modifier whenNotPaused() {
        if (registry.paused()) revert Errors.ProtocolPaused();
        _;
    }

    // -------------------------------------------------------------------------
    // Deposit
    // -------------------------------------------------------------------------

    /// @notice Deposit a coretime region NFT into the vault.
    ///         The NFT is transferred to this contract and locked in CoretimeLedger.
    ///         The depositor receives a receipt token ID for tracking.
    /// @param regionId The coretime region NFT token ID.
    /// @return receiptTokenId The vault receipt token ID for this deposit.
    function deposit(uint128 regionId)
        external
        whenNotPaused
        returns (uint256 receiptTokenId)
    {
        // --- CHECKS ---
        if (coretimeNFT.ownerOf(uint256(regionId)) != msg.sender) {
            revert Errors.Unauthorised(msg.sender);
        }

        // Lock region in the ledger (prevents double-encumbrance)
        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.lockRegion(regionId, ledger.VAULT_POSITION());

        // --- EFFECTS ---
        receiptTokenId = nextReceiptId++;

        deposits[receiptTokenId] = VaultDeposit({
            receiptTokenId: receiptTokenId,
            depositor:      msg.sender,
            regionId:       regionId,
            depositBlock:   uint32(block.number),
            isLent:         false,
            withdrawn:      false
        });

        regionToReceipt[regionId] = receiptTokenId;
        depositorReceipts[msg.sender].push(receiptTokenId);
        totalDeposited++;

        // --- INTERACT ---
        coretimeNFT.transferFrom(msg.sender, address(this), uint256(regionId));
        ledger.incrementPositionCount(msg.sender);

        emit Events.RegionDeposited(msg.sender, regionId, receiptTokenId);
    }

    // -------------------------------------------------------------------------
    // Withdraw
    // -------------------------------------------------------------------------

    /// @notice Withdraw a deposited coretime region from the vault.
    ///         Only callable by the original depositor. The region must not
    ///         be currently lent out.
    /// @param receiptTokenId The vault receipt token ID.
    function withdraw(uint256 receiptTokenId) external whenNotPaused {
        VaultDeposit storage dep = deposits[receiptTokenId];

        // --- CHECKS ---
        if (dep.receiptTokenId == 0) revert Errors.InvalidReceiptToken(receiptTokenId);
        if (dep.depositor != msg.sender) revert Errors.Unauthorised(msg.sender);
        if (dep.withdrawn) revert Errors.InvalidReceiptToken(receiptTokenId);
        if (dep.isLent) revert Errors.RegionCurrentlyLent(dep.regionId);

        // --- EFFECTS ---
        dep.withdrawn = true;
        totalDeposited--;
        delete regionToReceipt[dep.regionId];

        // --- INTERACT ---
        coretimeNFT.transferFrom(address(this), msg.sender, uint256(dep.regionId));

        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.unlockRegion(dep.regionId);
        ledger.decrementPositionCount(msg.sender);

        emit Events.RegionWithdrawn(msg.sender, dep.regionId);
    }

    // -------------------------------------------------------------------------
    // Borrow
    // -------------------------------------------------------------------------

    /// @notice Borrow coretime from the vault for a fixed duration.
    ///         The borrower pays a fee based on the current lending rate,
    ///         core count, and duration. One region is assigned per borrow.
    /// @param coreCount      Number of cores to borrow (currently 1 per call).
    /// @param durationBlocks Duration of the loan in blocks.
    /// @return loanId        The newly created loan ID.
    function borrow(uint32 coreCount, uint32 durationBlocks)
        external
        whenNotPaused
        returns (uint256 loanId)
    {
        // --- CHECKS ---
        if (coreCount == 0) revert Errors.ZeroAmount();
        if (durationBlocks == 0) revert Errors.ZeroAmount();

        uint256 available = totalDeposited - totalLent;
        if (available < coreCount) {
            revert Errors.InsufficientLiquidity(coreCount);
        }

        // Calculate fee: coreCount × durationBlocks × currentRate / RATE_PRECISION
        uint128 rate = currentLendingRate();
        uint128 fee = uint128(
            uint256(coreCount) * uint256(durationBlocks) * uint256(rate) / uint256(RATE_PRECISION)
        );

        // --- EFFECTS ---
        // Find an available (unlent, unwithdrawn) region and mark it as lent
        uint128 assignedRegion = _findAndLendRegion();

        loanId = nextLoanId++;

        loans[loanId] = Loan({
            loanId:         loanId,
            borrower:       msg.sender,
            regionId:       assignedRegion,
            startBlock:     uint32(block.number),
            durationBlocks: durationBlocks,
            feePaid:        fee,
            returned:       false
        });

        totalLent++;
        currentEpochFees += fee;

        // --- INTERACT ---
        // Collect fee from borrower (using transferFrom since contract is calling)
        bool feePaid_ = IAssetsPrecompile(ASSETS_PRECOMPILE)
            .transferFrom(msg.sender, address(this), uint256(fee));
        if (!feePaid_) revert Errors.DOTTransferFailed(uint256(fee));

        emit Events.RegionLent(assignedRegion, msg.sender, durationBlocks, fee);
    }

    /// @notice Return a borrowed region after the loan duration expires.
    ///         Callable by anyone (keeper or borrower). Marks the region
    ///         as available for new loans or withdrawal.
    /// @param loanId The loan ID to return.
    function returnLoan(uint256 loanId) external whenNotPaused {
        Loan storage loan = loans[loanId];

        // --- CHECKS ---
        if (loan.loanId == 0) revert Errors.LoanNotExpired(loanId);
        if (loan.returned) revert Errors.LoanAlreadyReturned(loanId);
        if (uint32(block.number) < loan.startBlock + loan.durationBlocks) {
            revert Errors.LoanNotExpired(loanId);
        }

        // --- EFFECTS ---
        loan.returned = true;
        totalLent--;

        // Mark the deposit as no longer lent
        uint256 receiptId = regionToReceipt[loan.regionId];
        if (receiptId != 0) {
            deposits[receiptId].isLent = false;
        }

        emit Events.RegionReturned(loan.regionId);
    }

    // -------------------------------------------------------------------------
    // Yield Distribution
    // -------------------------------------------------------------------------

    /// @notice Claim yield for a specific receipt token for a completed epoch.
    ///         Yield is distributed pro-rata based on the number of active
    ///         deposits at epoch finalization.
    /// @param receiptTokenId The vault receipt token ID.
    /// @param epoch          The epoch number to claim yield for.
    function claimYield(uint256 receiptTokenId, uint256 epoch) external whenNotPaused {
        VaultDeposit storage dep = deposits[receiptTokenId];

        // --- CHECKS ---
        if (dep.receiptTokenId == 0) revert Errors.InvalidReceiptToken(receiptTokenId);
        if (dep.depositor != msg.sender) revert Errors.Unauthorised(msg.sender);
        if (yieldClaimed[receiptTokenId][epoch]) revert Errors.ZeroAmount();

        // Ensure epoch is finalized
        _tryFinalizeEpoch();
        EpochData storage epochData = epochs[epoch];
        if (!epochData.finalized) revert Errors.ZeroAmount();
        if (epochData.totalFeesCollected == 0) revert Errors.ZeroAmount();
        if (epochData.activeDepositCount == 0) revert Errors.ZeroAmount();

        // --- EFFECTS ---
        yieldClaimed[receiptTokenId][epoch] = true;

        // Pro-rata yield: equal share across all active depositors in the epoch
        uint128 yieldAmount = uint128(epochData.totalFeesCollected / epochData.activeDepositCount);

        // --- INTERACT ---
        if (yieldAmount > 0) {
            bool sent = IAssetsPrecompile(ASSETS_PRECOMPILE)
                .transfer(msg.sender, uint256(yieldAmount));
            if (!sent) revert Errors.DOTTransferFailed(uint256(yieldAmount));
        }

        emit Events.YieldClaimed(msg.sender, receiptTokenId, yieldAmount);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /// @notice Find an available (unlent, unwithdrawn) region and mark it as lent.
    /// @return regionId The region ID that was assigned.
    /// @dev    Linear scan — acceptable for v1 with bounded deposit count.
    ///         Production optimization: maintain a linked list or index of
    ///         available regions for O(1) lookup.
    function _findAndLendRegion() internal returns (uint128 regionId) {
        for (uint256 i = 1; i < nextReceiptId; i++) {
            VaultDeposit storage dep = deposits[i];
            if (dep.receiptTokenId != 0 && !dep.isLent && !dep.withdrawn) {
                dep.isLent = true;
                return dep.regionId;
            }
        }
        revert Errors.InsufficientLiquidity(1);
    }

    /// @notice Try to finalize the current epoch if enough blocks have passed.
    ///         Snapshots accumulated fees and active deposit count, then
    ///         resets counters for the new epoch.
    function _tryFinalizeEpoch() internal {
        if (block.number >= epochStartBlock + EPOCH_BLOCKS) {
            // Finalize current epoch
            epochs[currentEpoch] = EpochData({
                totalFeesCollected: currentEpochFees,
                activeDepositCount: totalDeposited,
                finalized:          true
            });

            // Start new epoch
            currentEpoch++;
            epochStartBlock = block.number;
            currentEpochFees = 0;
        }
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /// @notice Calculate the current lending rate based on utilisation.
    ///         rate = baseRate × (utilisation² + 1)
    ///         The squared utilisation curve ensures rates spike sharply
    ///         as the vault approaches full utilisation, discouraging over-borrowing.
    /// @return rate Current lending rate in DOT planck per core-block.
    function currentLendingRate() public view returns (uint128 rate) {
        if (totalDeposited == 0) return BASE_RATE;

        // utilisation = totalLent / totalDeposited (scaled to 18 decimals)
        uint256 utilisation = (totalLent * RATE_PRECISION) / totalDeposited;
        uint256 utilisationSquared = (utilisation * utilisation) / RATE_PRECISION;

        // rate = baseRate × (utilisation² + 1)
        rate = uint128(
            (uint256(BASE_RATE) * (utilisationSquared + RATE_PRECISION)) / RATE_PRECISION
        );
    }

    /// @notice Get the vault utilisation percentage (scaled to 18 decimals).
    ///         e.g. 50% utilisation = 50 × 10^18.
    /// @return Utilisation percentage (18-decimal fixed-point).
    function utilisationRate() external view returns (uint256) {
        if (totalDeposited == 0) return 0;
        return (totalLent * 100 * RATE_PRECISION) / totalDeposited;
    }

    /// @notice Get all receipt token IDs for a depositor.
    /// @param depositor The depositor's address.
    /// @return Array of receipt token IDs.
    function getDepositorReceipts(address depositor) external view returns (uint256[] memory) {
        return depositorReceipts[depositor];
    }

    /// @notice Get the number of available (unlent, unwithdrawn) regions.
    /// @return available Number of regions available for borrowing.
    function availableRegions() external view returns (uint256 available) {
        return totalDeposited - totalLent;
    }
}
