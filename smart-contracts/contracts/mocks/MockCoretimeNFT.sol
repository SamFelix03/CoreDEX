// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockCoretimeNFT
/// @notice Simulates the Coretime Region NFT precompile for Chopsticks fork testing.
///         Implements a minimal ERC-721-like interface with coretime region metadata.
///
/// @dev    In production, coretime regions are exposed via a precompile at
///         0x0000000000000000000000000000000000000805. This mock allows minting
///         test regions and provides the same interface that ForwardMarket,
///         OptionsEngine, and YieldVault consume.
contract MockCoretimeNFT {

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Token ownership: tokenId → owner address.
    mapping(uint256 => address) private _owners;

    /// @notice Token approvals: tokenId → approved address.
    mapping(uint256 => address) private _approvals;

    /// @notice Region metadata: tokenId → begin block.
    mapping(uint256 => uint32) private _regionBegin;

    /// @notice Region metadata: tokenId → end block.
    mapping(uint256 => uint32) private _regionEnd;

    /// @notice Region metadata: tokenId → core index.
    mapping(uint256 => uint16) private _regionCore;

    /// @notice Owner / governance for minting test regions.
    address public owner;

    /// @notice Next region ID for auto-minting.
    uint128 public nextRegionId = 1;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() {
        owner = msg.sender;
    }

    // -------------------------------------------------------------------------
    // ERC-721 Interface (matches ICoretimeNFT)
    // -------------------------------------------------------------------------

    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "MockCoretimeNFT: nonexistent token");
        return tokenOwner;
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        require(_owners[tokenId] == from, "MockCoretimeNFT: not owner");
        require(
            msg.sender == from ||
            msg.sender == _approvals[tokenId],
            "MockCoretimeNFT: not authorised"
        );

        _owners[tokenId] = to;
        _approvals[tokenId] = address(0);

        emit Transfer(from, to, tokenId);
    }

    function approve(address to, uint256 tokenId) external {
        require(_owners[tokenId] == msg.sender, "MockCoretimeNFT: not owner");
        _approvals[tokenId] = to;
        emit Approval(msg.sender, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        return _approvals[tokenId];
    }

    // -------------------------------------------------------------------------
    // Region Metadata (matches ICoretimeNFT)
    // -------------------------------------------------------------------------

    function regionBegin(uint256 tokenId) external view returns (uint32) {
        return _regionBegin[tokenId];
    }

    function regionEnd(uint256 tokenId) external view returns (uint32) {
        return _regionEnd[tokenId];
    }

    function regionCore(uint256 tokenId) external view returns (uint16) {
        return _regionCore[tokenId];
    }

    // -------------------------------------------------------------------------
    // Mock-specific: Minting for simulation
    // -------------------------------------------------------------------------

    /// @notice Mint a new coretime region NFT for testing.
    /// @param to         Recipient address.
    /// @param beginBlock Region begin block on relay chain.
    /// @param endBlock   Region end block on relay chain.
    /// @param coreIndex  Core index assigned to this region.
    /// @return regionId  The minted region ID.
    function mintRegion(
        address to,
        uint32  beginBlock,
        uint32  endBlock,
        uint16  coreIndex
    ) external returns (uint128 regionId) {
        regionId = nextRegionId++;

        _owners[uint256(regionId)] = to;
        _regionBegin[uint256(regionId)] = beginBlock;
        _regionEnd[uint256(regionId)] = endBlock;
        _regionCore[uint256(regionId)] = coreIndex;

        emit Transfer(address(0), to, uint256(regionId));
    }

    /// @notice Mint a region with a specific ID (for deterministic testing).
    function mintRegionWithId(
        address to,
        uint128 regionId,
        uint32  beginBlock,
        uint32  endBlock,
        uint16  coreIndex
    ) external {
        require(_owners[uint256(regionId)] == address(0), "MockCoretimeNFT: already minted");

        _owners[uint256(regionId)] = to;
        _regionBegin[uint256(regionId)] = beginBlock;
        _regionEnd[uint256(regionId)] = endBlock;
        _regionCore[uint256(regionId)] = coreIndex;

        emit Transfer(address(0), to, uint256(regionId));
    }
}
