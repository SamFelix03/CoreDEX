// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Errors} from "./libraries/Errors.sol";
import {Events} from "./libraries/Events.sol";

/// @title CoreDexRegistry
/// @notice The top-level administrative contract for CoreDex.
///         Single source of truth for all contract addresses. Stores a
///         mapping(bytes32 => address). Every other contract resolves its
///         dependencies through here. Holds the global pause bool.
///         Only the Polkadot OpenGov proxy can call register() or pause().
///
/// @dev    UPGRADEABILITY:
///         All contract addresses are resolved via this registry. No contract
///         may hard-code the address of another CoreDex contract.
///         Governance upgrades emit ContractUpdated event with old and new
///         addresses and a mandatory 48-hour timelock before the new address
///         becomes active.
///
///         ACCESS CONTROL:
///         Only the governance address (OpenGov proxy) can register, pause,
///         or unpause. This is the most privileged address in the protocol.
contract CoreDexRegistry {

    // -------------------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------------------

    /// @notice Mapping of contract name hash to registered address.
    ///         Keys: keccak256("ForwardMarket"), keccak256("OptionsEngine"), etc.
    mapping(bytes32 => address) public contracts;

    /// @notice Pending contract updates with timelock.
    mapping(bytes32 => PendingUpdate) public pendingUpdates;

    /// @notice OpenGov proxy — only address that can call register() or pause().
    address public governance;

    /// @notice Global circuit breaker. All state-changing functions on all
    ///         other contracts MUST check registry.paused().
    bool public paused;

    /// @notice Protocol version, incremented on each upgrade.
    uint32 public version;

    /// @notice Timelock delay in blocks (~48 hours at 6s blocks = 28,800 blocks).
    uint32 public constant TIMELOCK_DELAY = 28_800;

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct PendingUpdate {
        address newAddress;
        uint256 activationBlock;
        bool    exists;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _governance The OpenGov proxy address that controls the registry.
    constructor(address _governance) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        governance = _governance;
        paused = false;
        version = 1;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyGovernance() {
        if (msg.sender != governance) revert Errors.Unauthorised(msg.sender);
        _;
    }

    // -------------------------------------------------------------------------
    // Core Functions
    // -------------------------------------------------------------------------

    /// @notice Resolve a contract address by its key.
    /// @param key keccak256 hash of the contract name.
    /// @return addr The registered contract address.
    function resolve(bytes32 key) external view returns (address addr) {
        addr = contracts[key];
        if (addr == address(0)) revert Errors.ContractNotFound(key);
        return addr;
    }

    /// @notice Propose a contract address update with timelock.
    ///         The update becomes active after TIMELOCK_DELAY blocks.
    /// @param key  keccak256 hash of the contract name.
    /// @param impl The new contract address.
    function proposeUpdate(bytes32 key, address impl) external onlyGovernance {
        if (impl == address(0)) revert Errors.ZeroAddress();

        pendingUpdates[key] = PendingUpdate({
            newAddress: impl,
            activationBlock: block.number + TIMELOCK_DELAY,
            exists: true
        });
    }

    /// @notice Execute a pending contract address update after timelock expires.
    /// @param key keccak256 hash of the contract name.
    function executeUpdate(bytes32 key) external onlyGovernance {
        PendingUpdate storage pending = pendingUpdates[key];
        if (!pending.exists) revert Errors.ContractNotFound(key);
        if (block.number < pending.activationBlock) {
            revert Errors.TimelockNotExpired(key, pending.activationBlock);
        }

        address oldAddress = contracts[key];
        contracts[key] = pending.newAddress;
        version++;

        delete pendingUpdates[key];

        emit Events.ContractUpdated(key, oldAddress, pending.newAddress, version);
    }

    /// @notice Register a contract address immediately (used during initial deployment only).
    ///         After initial deployment, use proposeUpdate + executeUpdate for timelocked updates.
    /// @param key  keccak256 hash of the contract name.
    /// @param impl The contract address.
    function register(bytes32 key, address impl) external onlyGovernance {
        if (impl == address(0)) revert Errors.ZeroAddress();

        address oldAddress = contracts[key];
        contracts[key] = impl;
        version++;

        emit Events.ContractUpdated(key, oldAddress, impl, version);
    }

    /// @notice Pause the entire protocol. Governance-only global circuit breaker.
    function pause() external onlyGovernance {
        paused = true;
        emit Events.ProtocolPaused(msg.sender);
    }

    /// @notice Unpause the entire protocol. Governance-only.
    function unpause() external onlyGovernance {
        paused = false;
        emit Events.ProtocolUnpaused(msg.sender);
    }

    /// @notice Transfer governance to a new address.
    /// @param newGovernance The new governance proxy address.
    function transferGovernance(address newGovernance) external onlyGovernance {
        if (newGovernance == address(0)) revert Errors.ZeroAddress();
        governance = newGovernance;
    }
}
