// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ICoretimeNFT
/// @notice Interface for Coretime Region NFTs on Asset Hub.
///         Coretime regions are exposed as ERC-721-compatible tokens via a
///         precompile. All CoreDex contracts that hold coretime NFTs in escrow
///         MUST interact via this interface — never by directly manipulating
///         pallet storage.
interface ICoretimeNFT {
    // -------------------------------------------------------------------------
    // Standard ERC-721 transfers
    // -------------------------------------------------------------------------

    /// @notice Transfer a coretime region NFT between addresses.
    /// @param from    Current owner of the NFT.
    /// @param to      Recipient address.
    /// @param tokenId The coretime region token ID (uint256 representation of uint128 regionId).
    function transferFrom(address from, address to, uint256 tokenId) external;

    /// @notice Returns the current owner of a coretime region NFT.
    /// @param tokenId The coretime region token ID.
    /// @return owner  Address of the current owner.
    function ownerOf(uint256 tokenId) external view returns (address owner);

    /// @notice Approve an address to transfer a specific coretime region NFT.
    /// @param to      Address to approve.
    /// @param tokenId The coretime region token ID.
    function approve(address to, uint256 tokenId) external;

    /// @notice Returns the approved address for a specific token.
    /// @param tokenId The coretime region token ID.
    /// @return operator The approved address, or zero if none.
    function getApproved(uint256 tokenId) external view returns (address operator);

    // -------------------------------------------------------------------------
    // CoreDex-specific: read region metadata from broker pallet
    // -------------------------------------------------------------------------

    /// @notice Returns the relay chain block at which this region begins.
    /// @param tokenId The coretime region token ID.
    /// @return begin  Relay chain block number.
    function regionBegin(uint256 tokenId) external view returns (uint32 begin);

    /// @notice Returns the relay chain block at which this region ends.
    /// @param tokenId The coretime region token ID.
    /// @return end    Relay chain block number.
    function regionEnd(uint256 tokenId) external view returns (uint32 end);

    /// @notice Returns the core index assigned to this region.
    /// @param tokenId The coretime region token ID.
    /// @return core   Core index (0-based).
    function regionCore(uint256 tokenId) external view returns (uint16 core);
}
