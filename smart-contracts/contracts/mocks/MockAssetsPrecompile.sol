// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockAssetsPrecompile
/// @notice Simulates the Assets Precompile for Chopsticks fork testing.
///         Provides ERC-20-style DOT transfers using a simple internal ledger.
///
/// @dev    In production, the Assets Precompile at
///         0x0000000000000000000000000000000000000806 provides direct access
///         to native DOT balances. This mock uses an internal balance mapping
///         and allows minting test DOT for simulation.
contract MockAssetsPrecompile {

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Internal DOT balance ledger.
    mapping(address => uint256) private _balances;

    /// @notice Total supply of mock DOT.
    uint256 private _totalSupply;

    /// @notice Owner / governance for minting.
    address public owner;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Transfer(address indexed from, address indexed to, uint256 amount);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() {
        owner = msg.sender;
    }

    // -------------------------------------------------------------------------
    // IAssetsPrecompile Interface
    // -------------------------------------------------------------------------

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(_balances[msg.sender] >= amount, "MockAssets: insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function totalIssuance() external view returns (uint256) {
        return _totalSupply;
    }

    function existentialDeposit() external pure returns (uint256) {
        return 0.01 ether; // 0.01 DOT
    }

    // -------------------------------------------------------------------------
    // Mock-specific: Minting for simulation
    // -------------------------------------------------------------------------

    /// @notice Mint mock DOT to an address for testing.
    /// @param to     Recipient address.
    /// @param amount Amount of DOT to mint (18 decimals).
    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        _totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    /// @notice Burn mock DOT from an address.
    /// @param from   Address to burn from.
    /// @param amount Amount to burn.
    function burn(address from, uint256 amount) external {
        require(_balances[from] >= amount, "MockAssets: insufficient balance");
        _balances[from] -= amount;
        _totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }
}
