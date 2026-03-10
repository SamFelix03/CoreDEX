// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Errors} from "./libraries/Errors.sol";
import {Events} from "./libraries/Events.sol";
import {CoreDexRegistry} from "./CoreDexRegistry.sol";

/// @title CoretimeLedger
/// @notice Global state book for the CoreDex protocol. Maintains the canonical
///         record of which coretime regions are locked in which positions,
///         per-address DOT margin balances, and open position counts.
///
/// @dev    KEY INVARIANT:
///         No region can appear in more than one active position at any time.
///         This is enforced via a global regionLocked(regionId) → bool mapping
///         that ALL other contracts must check before accepting a region into escrow.
///
///         WRITE ACCESS:
///         Only registered CoreDex contracts (ForwardMarket, OptionsEngine, YieldVault)
///         can call lockRegion/unlockRegion. Access is verified by resolving the
///         caller's address against the CoreDexRegistry.
///
///         NO DELETION:
///         Position state transitions are tracked without deletion. Archive nodes
///         must be able to reconstruct full state (NFR-10).
contract CoretimeLedger {

    // -------------------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------------------

    /// @notice Reference to the CoreDexRegistry for access control and pause checks.
    CoreDexRegistry public immutable registry;

    /// @notice Global lock map: regionId → whether it's currently locked in a position.
    mapping(uint128 => bool) public regionLocked;

    /// @notice Which contract locked a region: regionId → locking contract address.
    mapping(uint128 => address) public regionLockedBy;

    /// @notice Which position type a region is locked in: regionId → position type hash.
    mapping(uint128 => bytes32) public regionPositionType;

    /// @notice Per-address DOT margin balances held in escrow across all positions.
    mapping(address => uint256) public marginBalance;

    /// @notice Per-address count of open positions.
    mapping(address => uint256) public openPositionCount;

    /// @notice History of all region lock/unlock events for auditability.
    uint256 public totalLockEvents;

    // -------------------------------------------------------------------------
    // Position type constants
    // -------------------------------------------------------------------------

    bytes32 public constant FORWARD_POSITION = keccak256("FORWARD");
    bytes32 public constant OPTION_POSITION  = keccak256("OPTION");
    bytes32 public constant VAULT_POSITION   = keccak256("VAULT");

    // -------------------------------------------------------------------------
    // Registry key constants
    // -------------------------------------------------------------------------

    bytes32 public constant KEY_FORWARD_MARKET = keccak256("ForwardMarket");
    bytes32 public constant KEY_OPTIONS_ENGINE = keccak256("OptionsEngine");
    bytes32 public constant KEY_YIELD_VAULT    = keccak256("YieldVault");
    bytes32 public constant KEY_SETTLEMENT     = keccak256("SettlementExecutor");

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _registry Address of the deployed CoreDexRegistry.
    constructor(address _registry) {
        if (_registry == address(0)) revert Errors.ZeroAddress();
        registry = CoreDexRegistry(_registry);
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    /// @notice Ensures the protocol is not paused.
    modifier whenNotPaused() {
        if (registry.paused()) revert Errors.ProtocolPaused();
        _;
    }

    /// @notice Ensures the caller is a registered CoreDex contract.
    modifier onlyRegisteredContract() {
        bool authorised = false;

        // Check if caller is any of the registered contracts
        try registry.resolve(KEY_FORWARD_MARKET) returns (address addr) {
            if (msg.sender == addr) authorised = true;
        } catch {}

        if (!authorised) {
            try registry.resolve(KEY_OPTIONS_ENGINE) returns (address addr) {
                if (msg.sender == addr) authorised = true;
            } catch {}
        }

        if (!authorised) {
            try registry.resolve(KEY_YIELD_VAULT) returns (address addr) {
                if (msg.sender == addr) authorised = true;
            } catch {}
        }

        if (!authorised) {
            try registry.resolve(KEY_SETTLEMENT) returns (address addr) {
                if (msg.sender == addr) authorised = true;
            } catch {}
        }

        if (!authorised) revert Errors.Unauthorised(msg.sender);
        _;
    }

    // -------------------------------------------------------------------------
    // Region Lock/Unlock
    // -------------------------------------------------------------------------

    /// @notice Lock a coretime region into a position. Called by ForwardMarket,
    ///         OptionsEngine, or YieldVault when a region enters escrow.
    /// @param regionId     The coretime region NFT token ID.
    /// @param positionType The type of position (FORWARD, OPTION, VAULT).
    function lockRegion(uint128 regionId, bytes32 positionType)
        external
        whenNotPaused
        onlyRegisteredContract
    {
        if (regionLocked[regionId]) {
            revert Errors.RegionAlreadyEncumbered(regionId);
        }

        regionLocked[regionId] = true;
        regionLockedBy[regionId] = msg.sender;
        regionPositionType[regionId] = positionType;
        totalLockEvents++;

        emit Events.RegionLocked(regionId, msg.sender, positionType);
    }

    /// @notice Unlock a coretime region from a position. Called when a position
    ///         is settled, cancelled, or expired.
    /// @param regionId The coretime region NFT token ID.
    function unlockRegion(uint128 regionId)
        external
        whenNotPaused
        onlyRegisteredContract
    {
        // Only the contract that locked the region can unlock it
        if (regionLockedBy[regionId] != msg.sender) {
            revert Errors.Unauthorised(msg.sender);
        }

        regionLocked[regionId] = false;
        regionLockedBy[regionId] = address(0);
        regionPositionType[regionId] = bytes32(0);
        totalLockEvents++;

        emit Events.RegionUnlocked(regionId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Margin Balance Management
    // -------------------------------------------------------------------------

    /// @notice Increase a user's margin balance (DOT held in escrow).
    /// @param account The user's address.
    /// @param amount  DOT amount to add (18-decimal fixed-point).
    function addMargin(address account, uint256 amount)
        external
        whenNotPaused
        onlyRegisteredContract
    {
        marginBalance[account] += amount;
        emit Events.MarginUpdated(account, marginBalance[account]);
    }

    /// @notice Decrease a user's margin balance (DOT released from escrow).
    /// @param account The user's address.
    /// @param amount  DOT amount to release (18-decimal fixed-point).
    function releaseMargin(address account, uint256 amount)
        external
        whenNotPaused
        onlyRegisteredContract
    {
        if (marginBalance[account] < amount) {
            revert Errors.ZeroAmount();
        }
        marginBalance[account] -= amount;
        emit Events.MarginUpdated(account, marginBalance[account]);
    }

    // -------------------------------------------------------------------------
    // Position Count Management
    // -------------------------------------------------------------------------

    /// @notice Increment a user's open position count.
    /// @param account The user's address.
    function incrementPositionCount(address account)
        external
        whenNotPaused
        onlyRegisteredContract
    {
        openPositionCount[account]++;
    }

    /// @notice Decrement a user's open position count.
    /// @param account The user's address.
    function decrementPositionCount(address account)
        external
        whenNotPaused
        onlyRegisteredContract
    {
        if (openPositionCount[account] > 0) {
            openPositionCount[account]--;
        }
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /// @notice Check if a region is currently locked in any position.
    /// @param regionId The coretime region NFT token ID.
    /// @return locked  True if the region is locked.
    function isRegionLocked(uint128 regionId) external view returns (bool locked) {
        return regionLocked[regionId];
    }

    /// @notice Get the contract that locked a specific region.
    /// @param regionId The coretime region NFT token ID.
    /// @return locker   Address of the locking contract (zero if unlocked).
    function getRegionLocker(uint128 regionId) external view returns (address locker) {
        return regionLockedBy[regionId];
    }
}
