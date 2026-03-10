// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Errors
/// @notice Single source of truth for all CoreDex custom errors.
///         All contracts MUST use these custom errors (not string revert messages)
///         to keep revert data gas-efficient and parseable by tooling.
///
/// @dev Custom errors cost less gas than string reverts and are easier to decode
///      in off-chain tooling. Each error carries the invalid value so callers
///      can surface it meaningfully in UI and logs.
library Errors {

    // -------------------------------------------------------------------------
    // CoreDexRegistry
    // -------------------------------------------------------------------------

    /// @notice The protocol is globally paused.
    error ProtocolPaused();

    /// @notice The caller is not authorised for this operation.
    error Unauthorised(address caller);

    /// @notice The requested contract key is not registered in the registry.
    error ContractNotFound(bytes32 key);

    /// @notice A contract address update is still within the timelock period.
    error TimelockNotExpired(bytes32 key, uint256 activationBlock);

    // -------------------------------------------------------------------------
    // ForwardMarket & OptionsEngine
    // -------------------------------------------------------------------------

    /// @notice The coretime region is already locked in another position.
    error RegionAlreadyEncumbered(uint128 regionId);

    /// @notice The specified order does not exist.
    error OrderNotFound(uint256 orderId);

    /// @notice The order is not in the matched state required for settlement.
    error OrderNotMatched(uint256 orderId);

    /// @notice The strike price is outside the ±50% band of the oracle spot price.
    error StrikePriceOutOfBand(uint128 strike, uint128 spot);

    /// @notice The delivery block is in the past.
    error DeliveryBlockInPast(uint32 deliveryBlock);

    /// @notice The caller is not a party to the specified order.
    error NotOrderParty(address caller, uint256 orderId);

    /// @notice The delivery block has not been reached yet.
    error DeliveryBlockNotReached(uint256 orderId, uint32 deliveryBlock);

    /// @notice The order is not in the open state required for this operation.
    error OrderNotOpen(uint256 orderId);

    /// @notice The order has already been cancelled or settled.
    error OrderAlreadyFinalized(uint256 orderId);

    // -------------------------------------------------------------------------
    // OptionsEngine
    // -------------------------------------------------------------------------

    /// @notice The option is not in the active state.
    error OptionNotActive(uint256 optionId);

    /// @notice The option has not reached its expiry block.
    error OptionNotExpired(uint256 optionId);

    /// @notice The option has already expired and cannot be exercised.
    error OptionAlreadyExpired(uint256 optionId);

    /// @notice The option can only be exercised at the expiry block (European-style).
    error NotAtExpiryBlock(uint256 optionId, uint32 expiryBlock);

    /// @notice The caller is not the option holder.
    error NotOptionHolder(address caller, uint256 optionId);

    /// @notice The PricingModule call failed.
    error PricingModuleCallFailed();

    // -------------------------------------------------------------------------
    // YieldVault
    // -------------------------------------------------------------------------

    /// @notice The region is currently lent out and cannot be withdrawn.
    error RegionCurrentlyLent(uint128 regionId);

    /// @notice The vault does not have enough available regions to fill the borrow.
    error InsufficientLiquidity(uint32 coreCount);

    /// @notice The loan has not expired yet.
    error LoanNotExpired(uint256 loanId);

    /// @notice The loan has already been returned.
    error LoanAlreadyReturned(uint256 loanId);

    /// @notice The receipt token ID is invalid.
    error InvalidReceiptToken(uint256 receiptTokenId);

    // -------------------------------------------------------------------------
    // SettlementExecutor
    // -------------------------------------------------------------------------

    /// @notice The XCM dispatch failed.
    error XcmDispatchFailed(bytes32 xcmHash);

    /// @notice The recovery timeout has not been reached yet.
    error RecoveryTimeoutNotReached(uint256 positionId);

    /// @notice The position has already been settled.
    error AlreadySettled(uint256 positionId);

    /// @notice The settlement callback reported a failure.
    error SettlementCallbackFailed(uint256 positionId, bytes32 xcmHash);

    // -------------------------------------------------------------------------
    // General
    // -------------------------------------------------------------------------

    /// @notice A zero address was provided where a non-zero address is required.
    error ZeroAddress();

    /// @notice A zero amount was provided where a non-zero amount is required.
    error ZeroAmount();

    /// @notice The caller is not the expected contract.
    error UnauthorisedCaller(address caller, address expected);

    /// @notice The NFT transfer failed.
    error NFTTransferFailed(uint128 regionId);

    /// @notice The DOT transfer failed.
    error DOTTransferFailed(uint256 amount);
}
