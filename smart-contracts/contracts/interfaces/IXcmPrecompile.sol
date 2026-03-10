// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IXcmPrecompile
/// @notice Interface for the Polkadot Asset Hub XCM Precompile.
///         Registered at address 0x0000000000000000000000000000000000000808.
///         Allows smart contracts to build and dispatch XCM v5 instruction sets
///         cross-chain without bridge infrastructure or off-chain relayers.
///
/// @dev    Used exclusively by SettlementExecutor for coretime NFT delivery
///         and DOT payment settlement across the Coretime Chain and Asset Hub.
interface IXcmPrecompile {

    /// @notice Weight struct matching Polkadot's Weight type.
    struct Weight {
        uint64 refTime;
        uint64 proofSize;
    }

    /// @notice Outcome of an XCM execution.
    struct Outcome {
        bool success;
        bytes error;
    }

    /// @notice Execute an XCM program with this contract as origin.
    ///         Used for operations where the contract's sovereign account
    ///         needs to be the XCM origin (e.g. withdrawing from escrow).
    /// @param xcmProgram SCALE-encoded XCM v5 VersionedXcm.
    /// @param maxWeight  Weight limit (ref_time + proof_size).
    /// @return outcome   Result of the XCM execution.
    function execute(
        bytes calldata xcmProgram,
        Weight calldata maxWeight
    ) external returns (Outcome memory outcome);

    /// @notice Send XCM to a destination chain.
    ///         Used for cross-chain asset transfers (DOT payment leg).
    /// @param dest       SCALE-encoded MultiLocation of the target chain.
    /// @param xcmProgram SCALE-encoded XCM v5 instruction set.
    /// @return messageHash Hash of the sent XCM message for tracking.
    function sendXcm(
        bytes calldata dest,
        bytes calldata xcmProgram
    ) external returns (bytes32 messageHash);

    /// @notice Teleports DOT from Asset Hub to a destination parachain.
    /// @param destinationParaId Parachain ID to teleport DOT to.
    /// @param beneficiary       Recipient address on the destination chain.
    /// @param amount            DOT to teleport (18-decimal fixed-point).
    /// @param weightLimit       Maximum XCM execution weight to purchase.
    function teleportDOT(
        uint32  destinationParaId,
        address beneficiary,
        uint256 amount,
        uint64  weightLimit
    ) external;

    /// @notice Sends a remote Transact to execute a call on another chain.
    /// @param destinationParaId Target parachain ID.
    /// @param call              SCALE-encoded extrinsic to execute remotely.
    /// @param weightLimit       Maximum weight for the remote call.
    function remoteTransact(
        uint32         destinationParaId,
        bytes calldata call,
        uint64         weightLimit
    ) external;
}
