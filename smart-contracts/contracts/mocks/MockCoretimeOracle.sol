// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockCoretimeOracle
/// @notice Simulates the CoretimeOracle PVM precompile for Chopsticks fork testing.
///         Provides configurable spot price and implied volatility data that the
///         OptionsEngine and ForwardMarket contracts consume.
///
/// @dev    In production, this logic lives in the Rust PVM precompile at
///         0x0000000000000000000000000000000000002001. For simulation purposes,
///         this mock contract implements the same ABI so that Solidity contracts
///         can call it identically via staticcall.
contract MockCoretimeOracle {

    // -------------------------------------------------------------------------
    // State — configurable by governance for simulation
    // -------------------------------------------------------------------------

    /// @notice Current spot price of coretime in DOT planck (18 decimals).
    ///         Default: 5 DOT (5e18) — reasonable price for a coretime region.
    uint128 public _spotPrice = 5 ether;

    /// @notice Implied volatility (scaled to 1e4 = 100%).
    ///         Default: 5000 = 50% annualised volatility.
    uint64 public _impliedVolatility = 5000;

    /// @notice Last sale price from the Coretime Broker pallet (DOT planck).
    uint128 public _lastSalePrice = 4.8 ether;

    /// @notice Current renewal price from the Broker pallet (DOT planck).
    uint128 public _renewalPrice = 4.5 ether;

    /// @notice Current sale region begin block.
    uint32 public _saleRegionBegin = 100_000;

    /// @notice Current sale region end block.
    uint32 public _saleRegionEnd = 200_000;

    /// @notice Total cores available in the current sale.
    uint16 public _totalCoresAvailable = 50;

    /// @notice Cores already sold in the current sale.
    uint16 public _coresSold = 12;

    /// @notice Owner / governance address for configuring mock values.
    address public owner;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "MockCoretimeOracle: not owner");
        _;
    }

    // -------------------------------------------------------------------------
    // Oracle Interface (matches PVM precompile ABI)
    // -------------------------------------------------------------------------

    /// @notice Returns the current spot price of coretime.
    function spotPrice() external view returns (uint128) {
        return _spotPrice;
    }

    /// @notice Returns the implied volatility for option pricing.
    function impliedVolatility() external view returns (uint64) {
        return _impliedVolatility;
    }

    /// @notice Returns the last sale price from the Coretime Broker.
    function lastSalePrice() external view returns (uint128) {
        return _lastSalePrice;
    }

    /// @notice Returns the current renewal price.
    function renewalPrice() external view returns (uint128) {
        return _renewalPrice;
    }

    /// @notice Returns the current sale region begin/end blocks.
    function saleRegion() external view returns (uint32 begin, uint32 end) {
        return (_saleRegionBegin, _saleRegionEnd);
    }

    /// @notice Returns core availability stats.
    function coreAvailability() external view returns (uint16 total, uint16 sold) {
        return (_totalCoresAvailable, _coresSold);
    }

    // -------------------------------------------------------------------------
    // Configuration (simulation only)
    // -------------------------------------------------------------------------

    function setSpotPrice(uint128 price) external onlyOwner {
        _spotPrice = price;
    }

    function setImpliedVolatility(uint64 vol) external onlyOwner {
        _impliedVolatility = vol;
    }

    function setLastSalePrice(uint128 price) external onlyOwner {
        _lastSalePrice = price;
    }

    function setRenewalPrice(uint128 price) external onlyOwner {
        _renewalPrice = price;
    }

    function setSaleRegion(uint32 begin, uint32 end) external onlyOwner {
        _saleRegionBegin = begin;
        _saleRegionEnd = end;
    }

    function setCoreAvailability(uint16 total, uint16 sold) external onlyOwner {
        _totalCoresAvailable = total;
        _coresSold = sold;
    }
}
