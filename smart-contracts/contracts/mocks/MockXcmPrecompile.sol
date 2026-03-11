// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IXcmPrecompile} from "../interfaces/IXcmPrecompile.sol";

/// @title MockXcmPrecompile
/// @notice Simulates the XCM Precompile for Chopsticks fork testing.
///         Records XCM dispatches and always returns success for simulation.
///
/// @dev    In production, the XCM Precompile at
///         0x0000000000000000000000000000000000000808 dispatches real XCM
///         programs across parachains. This mock records dispatches and
///         simulates successful execution for end-to-end testing.
contract MockXcmPrecompile is IXcmPrecompile {

    // -------------------------------------------------------------------------
    // State — records for verification
    // -------------------------------------------------------------------------

    struct XcmDispatch {
        bytes   xcmProgram;
        uint64  refTime;
        uint64  proofSize;
        uint256 blockNumber;
        bool    executed;
    }

    struct TeleportRecord {
        uint32  destinationParaId;
        address beneficiary;
        uint256 amount;
        uint64  weightLimit;
        uint256 blockNumber;
    }

    struct TransactRecord {
        uint32  destinationParaId;
        bytes   call;
        uint64  weightLimit;
        uint256 blockNumber;
    }

    /// @notice All XCM execute() calls recorded.
    XcmDispatch[] public dispatches;

    /// @notice All teleportDOT() calls recorded.
    TeleportRecord[] public teleports;

    /// @notice All remoteTransact() calls recorded.
    TransactRecord[] public transacts;

    /// @notice All sendXcm() calls recorded.
    bytes32[] public sentMessages;

    /// @notice Whether to simulate failures (default: false = always succeed).
    bool public simulateFailure;

    /// @notice Owner for configuration.
    address public owner;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event XcmExecuted(bytes32 indexed messageHash, bool success);
    event XcmSent(bytes32 indexed messageHash, bytes dest);
    event DotTeleported(uint32 indexed paraId, address indexed beneficiary, uint256 amount);
    event RemoteTransacted(uint32 indexed paraId, bytes call);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() {
        owner = msg.sender;
    }

    // -------------------------------------------------------------------------
    // IXcmPrecompile Interface
    // -------------------------------------------------------------------------

    function execute(
        bytes calldata xcmProgram,
        Weight calldata maxWeight
    ) external override returns (Outcome memory outcome) {
        dispatches.push(XcmDispatch({
            xcmProgram:  xcmProgram,
            refTime:     maxWeight.refTime,
            proofSize:   maxWeight.proofSize,
            blockNumber: block.number,
            executed:    !simulateFailure
        }));

        bytes32 messageHash = keccak256(abi.encodePacked(xcmProgram, block.number));

        if (simulateFailure) {
            outcome = Outcome({ success: false, error: "SIMULATED_FAILURE" });
        } else {
            outcome = Outcome({ success: true, error: "" });
        }

        emit XcmExecuted(messageHash, outcome.success);
    }

    function sendXcm(
        bytes calldata dest,
        bytes calldata xcmProgram
    ) external override returns (bytes32 messageHash) {
        messageHash = keccak256(abi.encodePacked(dest, xcmProgram, block.number));
        sentMessages.push(messageHash);
        emit XcmSent(messageHash, dest);
    }

    function teleportDOT(
        uint32  destinationParaId,
        address beneficiary,
        uint256 amount,
        uint64  weightLimit
    ) external override {
        teleports.push(TeleportRecord({
            destinationParaId: destinationParaId,
            beneficiary:       beneficiary,
            amount:            amount,
            weightLimit:       weightLimit,
            blockNumber:       block.number
        }));

        emit DotTeleported(destinationParaId, beneficiary, amount);
    }

    function remoteTransact(
        uint32         destinationParaId,
        bytes calldata call,
        uint64         weightLimit
    ) external override {
        transacts.push(TransactRecord({
            destinationParaId: destinationParaId,
            call:              call,
            weightLimit:       weightLimit,
            blockNumber:       block.number
        }));

        emit RemoteTransacted(destinationParaId, call);
    }

    // -------------------------------------------------------------------------
    // Mock-specific: Configuration
    // -------------------------------------------------------------------------

    function setSimulateFailure(bool fail) external {
        require(msg.sender == owner, "MockXcm: not owner");
        simulateFailure = fail;
    }

    function getDispatchCount() external view returns (uint256) {
        return dispatches.length;
    }

    function getTeleportCount() external view returns (uint256) {
        return teleports.length;
    }

    function getTransactCount() external view returns (uint256) {
        return transacts.length;
    }
}
