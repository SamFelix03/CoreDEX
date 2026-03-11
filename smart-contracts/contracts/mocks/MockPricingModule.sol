// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockPricingModule
/// @notice Simulates the PricingModule PVM precompile for Chopsticks fork testing.
///         Implements a simplified Black-Scholes option pricing model in Solidity.
///
/// @dev    In production, this logic lives in the Rust PVM precompile at
///         0x0000000000000000000000000000000000002002 where fixed-point math
///         is more efficient. This mock provides a reasonable approximation
///         for end-to-end testing.
contract MockPricingModule {

    /// @notice Precision for fixed-point math (18 decimals).
    uint256 constant PRECISION = 1e18;

    /// @notice Price an option using simplified Black-Scholes.
    ///         Returns premium and delta.
    /// @param spot       Current spot price (18 decimals).
    /// @param strike     Strike price (18 decimals).
    /// @param timeBlocks Time to expiry in blocks.
    /// @param volatility Implied volatility (scaled: 10000 = 100%).
    /// @param optionType 0 = call, 1 = put.
    /// @return premium   Option premium in DOT planck (18 decimals).
    /// @return delta     Option delta (18 decimals, 1e18 = 1.0).
    // solhint-disable-next-line func-name-mixedcase
    function price_option(
        uint128 spot,
        uint128 strike,
        uint32  timeBlocks,
        uint64  volatility,
        uint8   optionType
    ) external pure returns (uint128 premium, uint128 delta) {
        // Convert time to approximate years (assuming 6s blocks, ~5,256,000 blocks/year)
        // timeYears = timeBlocks / 5_256_000 (scaled to 18 decimals)
        uint256 timeYears = (uint256(timeBlocks) * PRECISION) / 5_256_000;
        if (timeYears == 0) timeYears = 1; // minimum 1 unit

        // Simplified premium calculation:
        // premium ≈ spot × volatility × sqrt(timeYears) × factor
        //
        // We use a linear approximation of sqrt for simplicity:
        // sqrt(t) ≈ t^0.5 → we use (t * PRECISION)^0.5 via Babylonian method
        uint256 sqrtTime = _sqrt(timeYears * PRECISION) ;

        // vol as decimal: volatility / 10000
        uint256 volDecimal = (uint256(volatility) * PRECISION) / 10000;

        // Base premium = spot × vol × sqrt(time) / PRECISION²
        uint256 basePremium = (uint256(spot) * volDecimal * sqrtTime) / (PRECISION * PRECISION);

        // Adjust for moneyness
        if (optionType == 0) {
            // Call option
            if (spot > strike) {
                // In the money: intrinsic + time value
                uint256 intrinsic = uint256(spot) - uint256(strike);
                premium = uint128(intrinsic + basePremium);
                delta = uint128((PRECISION * 7) / 10); // ~0.7 delta for ITM call
            } else {
                // Out of the money: pure time value (discounted)
                uint256 moneyness = (uint256(strike) - uint256(spot)) * PRECISION / uint256(spot);
                uint256 discount = moneyness > PRECISION ? 10 : (PRECISION - moneyness) * 100 / PRECISION;
                premium = uint128((basePremium * discount) / 100);
                delta = uint128((PRECISION * 3) / 10); // ~0.3 delta for OTM call
            }
        } else {
            // Put option
            if (strike > spot) {
                // In the money
                uint256 intrinsic = uint256(strike) - uint256(spot);
                premium = uint128(intrinsic + basePremium);
                delta = uint128((PRECISION * 7) / 10); // ~0.7 delta for ITM put
            } else {
                // Out of the money
                uint256 moneyness = (uint256(spot) - uint256(strike)) * PRECISION / uint256(strike);
                uint256 discount = moneyness > PRECISION ? 10 : (PRECISION - moneyness) * 100 / PRECISION;
                premium = uint128((basePremium * discount) / 100);
                delta = uint128((PRECISION * 3) / 10); // ~0.3 delta for OTM put
            }
        }

        // Ensure minimum premium of 0.01 DOT
        if (premium < 0.01 ether) {
            premium = 0.01 ether;
        }
    }

    /// @notice Solve for implied volatility given a target premium.
    ///         Uses bisection method (simplified for mock).
    // solhint-disable-next-line func-name-mixedcase
    function solve_iv(
        uint128 spot,
        uint128 strike,
        uint32  timeBlocks,
        uint128 targetPremium,
        uint8   optionType
    ) external view returns (uint64 impliedVol) {
        // Simple bisection: try volatilities from 1000 (10%) to 20000 (200%)
        uint64 low = 1000;
        uint64 high = 20000;

        for (uint256 i = 0; i < 20; i++) {
            uint64 mid = (low + high) / 2;
            (uint128 midPremium, ) = this.price_option(spot, strike, timeBlocks, mid, optionType);

            if (midPremium < targetPremium) {
                low = mid;
            } else {
                high = mid;
            }
        }

        impliedVol = (low + high) / 2;
    }

    // -------------------------------------------------------------------------
    // Internal — Babylonian square root
    // -------------------------------------------------------------------------

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
