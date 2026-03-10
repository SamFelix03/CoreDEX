// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ICoreDexRegistry
/// @notice Public interface for CoreDexRegistry.
///         All CoreDex contracts resolve their dependencies through this interface.
///         External integrators code against this rather than importing the
///         implementation directly.
interface ICoreDexRegistry {

    /// @notice Resolve a contract address by its key.
    /// @param key keccak256 hash of the contract name (e.g. keccak256("ForwardMarket")).
    /// @return addr The registered contract address.
    function resolve(bytes32 key) external view returns (address addr);

    /// @notice Register or update a contract address.
    ///         Governance-only. Emits ContractUpdated.
    /// @param key  keccak256 hash of the contract name.
    /// @param impl The new contract address.
    function register(bytes32 key, address impl) external;

    /// @notice Check if the protocol is globally paused.
    /// @return isPaused True if all operations are paused.
    function paused() external view returns (bool isPaused);

    /// @notice Pause the entire protocol. Governance-only.
    function pause() external;

    /// @notice Unpause the entire protocol. Governance-only.
    function unpause() external;

    /// @notice Returns the governance proxy address.
    function governance() external view returns (address);

    /// @notice Returns the current protocol version.
    function version() external view returns (uint32);
}
