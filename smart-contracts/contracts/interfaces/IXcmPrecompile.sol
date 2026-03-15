// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IXcmPrecompile
/// @notice Interface for the REAL Polkadot Hub XCM Precompile.
///         Registered at the canonical address:
///             0x00000000000000000000000000000000000a0000
///
/// @dev    This is the ACTUAL XCM precompile interface provided by Polkadot,
///         not a custom one. It exposes three functions:
///
///         - execute: Execute an XCM message locally.
///         - send: Send an XCM message to a destination chain.
///         - weighMessage: Estimate the weight of an XCM message.
///
///         Reference: https://docs.polkadot.com/develop/smart-contracts/precompiles/xcm-precompile/
///
///         The precompile works with SCALE-encoded XCM VersionedXcm and
///         VersionedLocation bytes. Use PAPI or other XCM builders to
///         construct these messages off-chain.
interface IXcmPrecompile {

    /// @notice Execute a SCALE-encoded XCM message locally.
    ///         The contract's sovereign account is the XCM origin.
    /// @param message   SCALE-encoded VersionedXcm bytes.
    /// @param maxWeight Maximum weight (ref_time, proof_size) encoded as u64 pair.
    /// @return success  Whether the XCM execution succeeded.
    function execute(
        bytes calldata message,
        uint64 maxWeight
    ) external returns (bool success);

    /// @notice Send a SCALE-encoded XCM message to a destination chain.
    /// @param dest    SCALE-encoded VersionedLocation of the target chain.
    /// @param message SCALE-encoded VersionedXcm instruction set.
    /// @return messageId The XCM message ID for tracking.
    function send(
        bytes calldata dest,
        bytes calldata message
    ) external returns (bytes32 messageId);

    /// @notice Estimate the weight required to execute an XCM message.
    /// @param message SCALE-encoded VersionedXcm bytes.
    /// @return weight Estimated weight (ref_time).
    function weighMessage(
        bytes calldata message
    ) external view returns (uint64 weight);
}
