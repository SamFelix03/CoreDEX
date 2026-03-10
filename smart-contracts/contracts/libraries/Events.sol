// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Events
/// @notice Single source of truth for every CoreDex protocol event.
///         All contracts emit events defined here so subgraph indexers
///         only need to watch one ABI. Every indexed field is marked
///         explicitly to keep query costs predictable.
library Events {

    // -------------------------------------------------------------------------
    // CoreDexRegistry
    // -------------------------------------------------------------------------

    /// @notice Emitted when a contract address is registered or updated.
    event ContractUpdated(
        bytes32 indexed key,
        address indexed oldAddress,
        address indexed newAddress,
        uint32 version
    );

    /// @notice Emitted when the protocol is paused.
    event ProtocolPaused(address indexed pauser);

    /// @notice Emitted when the protocol is unpaused.
    event ProtocolUnpaused(address indexed unpauser);

    // -------------------------------------------------------------------------
    // ForwardMarket
    // -------------------------------------------------------------------------

    /// @notice Emitted when a new forward order is created (ask or bid).
    event OrderCreated(
        uint256 indexed orderId,
        address indexed seller,
        uint128 regionId,
        uint128 strikePriceDOT,
        uint32  deliveryBlock
    );

    /// @notice Emitted when a forward order is matched with a counterparty.
    event OrderMatched(
        uint256 indexed orderId,
        address indexed buyer
    );

    /// @notice Emitted when a forward order is settled via XCM.
    event OrderSettled(
        uint256 indexed orderId,
        bool success
    );

    /// @notice Emitted when a forward order is cancelled before matching.
    event OrderCancelled(
        uint256 indexed orderId,
        address indexed cancelledBy
    );

    /// @notice Emitted when a forward order expires after the grace period.
    event OrderExpired(
        uint256 indexed orderId
    );

    // -------------------------------------------------------------------------
    // OptionsEngine
    // -------------------------------------------------------------------------

    /// @notice Emitted when a new option is written (call or put).
    event OptionWritten(
        uint256 indexed optionId,
        address indexed writer,
        uint8   optionType,
        uint128 premium
    );

    /// @notice Emitted when an option is purchased by a holder.
    event OptionPurchased(
        uint256 indexed optionId,
        address indexed holder
    );

    /// @notice Emitted when an option is exercised at expiry.
    event OptionExercised(
        uint256 indexed optionId,
        address indexed holder
    );

    /// @notice Emitted when an option expires unexercised.
    event OptionExpired(
        uint256 indexed optionId
    );

    // -------------------------------------------------------------------------
    // YieldVault
    // -------------------------------------------------------------------------

    /// @notice Emitted when a coretime region is deposited into the vault.
    event RegionDeposited(
        address indexed depositor,
        uint128 indexed regionId,
        uint256 receiptTokenId
    );

    /// @notice Emitted when a region is lent out to a borrower.
    event RegionLent(
        uint128 indexed regionId,
        address indexed borrower,
        uint32  durationBlocks,
        uint128 fee
    );

    /// @notice Emitted when a lent region is returned to the vault.
    event RegionReturned(
        uint128 indexed regionId
    );

    /// @notice Emitted when a depositor claims accumulated yield.
    event YieldClaimed(
        address indexed depositor,
        uint256 indexed receiptTokenId,
        uint128 amountDOT
    );

    /// @notice Emitted when a depositor withdraws their region from the vault.
    event RegionWithdrawn(
        address indexed depositor,
        uint128 indexed regionId
    );

    // -------------------------------------------------------------------------
    // SettlementExecutor
    // -------------------------------------------------------------------------

    /// @notice Emitted when a settlement XCM program is dispatched.
    event SettlementDispatched(
        uint256 indexed positionId,
        bytes32 xcmHash
    );

    /// @notice Emitted when a settlement is confirmed via XCM callback.
    event SettlementConfirmed(
        uint256 indexed positionId,
        bytes32 xcmHash
    );

    /// @notice Emitted when a settlement fails.
    event SettlementFailed(
        uint256 indexed positionId,
        bytes32 xcmHash,
        bytes   reason
    );

    /// @notice Emitted when a recovery is initiated for a failed settlement.
    event RecoveryInitiated(
        uint256 indexed positionId,
        address indexed initiator
    );

    // -------------------------------------------------------------------------
    // CoretimeLedger
    // -------------------------------------------------------------------------

    /// @notice Emitted when a region is locked in a position.
    event RegionLocked(
        uint128 indexed regionId,
        address indexed lockedBy,
        bytes32 positionType
    );

    /// @notice Emitted when a region is unlocked from a position.
    event RegionUnlocked(
        uint128 indexed regionId,
        address indexed unlockedBy
    );

    /// @notice Emitted when a margin balance is updated.
    event MarginUpdated(
        address indexed account,
        uint256 newBalance
    );
}
