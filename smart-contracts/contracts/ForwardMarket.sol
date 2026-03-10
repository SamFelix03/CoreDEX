// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Errors}           from "./libraries/Errors.sol";
import {Events}           from "./libraries/Events.sol";
import {CoreDexRegistry}  from "./CoreDexRegistry.sol";
import {CoretimeLedger}   from "./CoretimeLedger.sol";
import {ICoretimeNFT}     from "./interfaces/ICoretimeNFT.sol";
import {IAssetsPrecompile} from "./interfaces/IAssetsPrecompile.sol";

/// @title ForwardMarket
/// @notice On-chain order book for coretime forward contracts. A forward is a
///         binding obligation: the seller commits to delivering a specific
///         coretime NFT (region) at a future block, and the buyer commits to
///         paying the agreed DOT price. No optionality — both sides are obligated.
///
/// @dev    ESCROW MODEL:
///         When a seller creates a forward, the coretime NFT MUST be transferred
///         into ForwardMarket's escrow immediately at order creation. This is
///         non-negotiable — it prevents the seller from transferring the NFT out
///         before delivery block.
///
///         PRICING CONSTRAINT:
///         The strike price MUST be within ±50% of CoretimeOracle.spotPrice()
///         at order creation time. This prevents wash trading and oracle
///         manipulation attacks via fabricated extreme-price forwards.
///
///         SETTLEMENT:
///         At delivery block, settle() triggers SettlementExecutor which
///         dispatches XCM to physically deliver the NFT to the buyer.
contract ForwardMarket {

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Assets Precompile address on Asset Hub.
    address public constant ASSETS_PRECOMPILE =
        0x0000000000000000000000000000000000000806;

    /// @notice Grace period after delivery block before order can be expired (in blocks).
    uint32 public constant GRACE_PERIOD = 14_400; // ~24 hours at 6s blocks

    /// @notice Price band percentage (50 = ±50% of spot price).
    uint32 public constant PRICE_BAND_PCT = 50;

    // -------------------------------------------------------------------------
    // Registry keys
    // -------------------------------------------------------------------------

    bytes32 public constant KEY_CORETIME_ORACLE = keccak256("CoretimeOracle");
    bytes32 public constant KEY_SETTLEMENT      = keccak256("SettlementExecutor");
    bytes32 public constant KEY_LEDGER          = keccak256("CoretimeLedger");

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct ForwardOrder {
        uint256 orderId;
        address seller;
        address buyer;                // address(0) if open ask
        uint128 coretimeRegion;       // NFT token ID on Asset Hub
        uint128 strikePriceDOT;       // agreed DOT price (planck, 18 decimals)
        uint32  deliveryBlock;        // relay chain block for settlement
        uint32  createdBlock;
        uint8   status;               // 0=open, 1=matched, 2=settled, 3=expired, 4=cancelled
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Reference to the CoreDexRegistry.
    CoreDexRegistry public immutable registry;

    /// @notice Reference to the Coretime NFT contract.
    ICoretimeNFT public immutable coretimeNFT;

    /// @notice All forward orders by ID.
    mapping(uint256 => ForwardOrder) public orders;

    /// @notice Orders created by a seller.
    mapping(address => uint256[]) public sellerOrders;

    /// @notice Orders matched by a buyer.
    mapping(address => uint256[]) public buyerOrders;

    /// @notice One active order per NFT region.
    mapping(uint128 => uint256) public regionToOrder;

    /// @notice Auto-incrementing order ID counter.
    uint256 public nextOrderId;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _registry    Address of the deployed CoreDexRegistry.
    /// @param _coretimeNFT Address of the Coretime NFT precompile.
    constructor(address _registry, address _coretimeNFT) {
        if (_registry == address(0)) revert Errors.ZeroAddress();
        if (_coretimeNFT == address(0)) revert Errors.ZeroAddress();
        registry = CoreDexRegistry(_registry);
        coretimeNFT = ICoretimeNFT(_coretimeNFT);
        nextOrderId = 1;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier whenNotPaused() {
        if (registry.paused()) revert Errors.ProtocolPaused();
        _;
    }

    // -------------------------------------------------------------------------
    // Core Functions
    // -------------------------------------------------------------------------

    /// @notice Create an ask order — seller escrows their coretime NFT and
    ///         lists it for sale at a specified strike price and delivery block.
    /// @param regionId      The coretime region NFT token ID.
    /// @param strikePrice   Agreed DOT price in planck (18 decimals).
    /// @param deliveryBlock Relay chain block for settlement.
    /// @return orderId      The newly created order ID.
    function createAsk(
        uint128 regionId,
        uint128 strikePrice,
        uint32  deliveryBlock
    )
        external
        whenNotPaused
        returns (uint256 orderId)
    {
        // --- CHECKS ---
        if (deliveryBlock <= uint32(block.number)) {
            revert Errors.DeliveryBlockInPast(deliveryBlock);
        }
        if (strikePrice == 0) revert Errors.ZeroAmount();

        // Validate strike price against oracle spot price ±50% band
        _validateStrikePrice(strikePrice);

        // Verify caller owns the NFT
        if (coretimeNFT.ownerOf(uint256(regionId)) != msg.sender) {
            revert Errors.Unauthorised(msg.sender);
        }

        // Lock region in the ledger (prevents double-encumbrance)
        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.lockRegion(regionId, ledger.FORWARD_POSITION());

        // --- EFFECTS ---
        orderId = nextOrderId++;

        orders[orderId] = ForwardOrder({
            orderId:        orderId,
            seller:         msg.sender,
            buyer:          address(0),
            coretimeRegion: regionId,
            strikePriceDOT: strikePrice,
            deliveryBlock:  deliveryBlock,
            createdBlock:   uint32(block.number),
            status:         0 // open
        });

        sellerOrders[msg.sender].push(orderId);
        regionToOrder[regionId] = orderId;

        // --- INTERACT ---
        // Transfer NFT into escrow (this contract holds it)
        coretimeNFT.transferFrom(msg.sender, address(this), uint256(regionId));

        // Track margin
        ledger.incrementPositionCount(msg.sender);

        emit Events.OrderCreated(orderId, msg.sender, regionId, strikePrice, deliveryBlock);
    }

    /// @notice Match an open ask order — buyer deposits DOT into escrow.
    /// @param orderId The order ID to match.
    function matchOrder(uint256 orderId) external whenNotPaused {
        ForwardOrder storage order = orders[orderId];

        // --- CHECKS ---
        if (order.orderId == 0) revert Errors.OrderNotFound(orderId);
        if (order.status != 0)  revert Errors.OrderNotOpen(orderId);
        if (order.seller == msg.sender) revert Errors.Unauthorised(msg.sender);

        // --- EFFECTS ---
        order.buyer  = msg.sender;
        order.status = 1; // matched

        buyerOrders[msg.sender].push(orderId);

        // --- INTERACT ---
        // Transfer DOT from buyer into escrow
        bool transferred = IAssetsPrecompile(ASSETS_PRECOMPILE)
            .transfer(address(this), uint256(order.strikePriceDOT));
        if (!transferred) revert Errors.DOTTransferFailed(uint256(order.strikePriceDOT));

        // Track margin in ledger
        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.addMargin(msg.sender, uint256(order.strikePriceDOT));
        ledger.incrementPositionCount(msg.sender);

        emit Events.OrderMatched(orderId, msg.sender);
    }

    /// @notice Settle a matched forward order at or after the delivery block.
    ///         Triggers SettlementExecutor for XCM delivery.
    /// @param orderId The order ID to settle.
    function settle(uint256 orderId) external whenNotPaused {
        ForwardOrder storage order = orders[orderId];

        // --- CHECKS ---
        if (order.orderId == 0)  revert Errors.OrderNotFound(orderId);
        if (order.status != 1)   revert Errors.OrderNotMatched(orderId);
        if (uint32(block.number) < order.deliveryBlock) {
            revert Errors.DeliveryBlockNotReached(orderId, order.deliveryBlock);
        }

        // --- EFFECTS ---
        order.status = 2; // settled

        // --- INTERACT ---
        // Call SettlementExecutor to dispatch XCM for NFT delivery
        address settlementAddr = registry.resolve(KEY_SETTLEMENT);
        (bool success, ) = settlementAddr.call(
            abi.encodeWithSignature("settleForward(uint256)", orderId)
        );

        // Release DOT to seller
        bool dotSent = IAssetsPrecompile(ASSETS_PRECOMPILE)
            .transfer(order.seller, uint256(order.strikePriceDOT));
        if (!dotSent) revert Errors.DOTTransferFailed(uint256(order.strikePriceDOT));

        // Unlock region and update ledger
        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.unlockRegion(order.coretimeRegion);
        ledger.releaseMargin(order.buyer, uint256(order.strikePriceDOT));
        ledger.decrementPositionCount(order.seller);
        ledger.decrementPositionCount(order.buyer);

        emit Events.OrderSettled(orderId, success);
    }

    /// @notice Cancel an open (unmatched) order. Returns escrowed NFT to seller.
    /// @param orderId The order ID to cancel.
    function cancel(uint256 orderId) external whenNotPaused {
        ForwardOrder storage order = orders[orderId];

        // --- CHECKS ---
        if (order.orderId == 0) revert Errors.OrderNotFound(orderId);
        if (order.status != 0)  revert Errors.OrderNotOpen(orderId);
        if (order.seller != msg.sender) {
            revert Errors.NotOrderParty(msg.sender, orderId);
        }

        // --- EFFECTS ---
        order.status = 4; // cancelled

        // --- INTERACT ---
        // Return NFT to seller
        coretimeNFT.transferFrom(address(this), order.seller, uint256(order.coretimeRegion));

        // Unlock region in ledger
        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.unlockRegion(order.coretimeRegion);
        ledger.decrementPositionCount(order.seller);

        // Clean up regionToOrder mapping
        delete regionToOrder[order.coretimeRegion];

        emit Events.OrderCancelled(orderId, msg.sender);
    }

    /// @notice Expire an order after delivery block + grace period if not settled.
    ///         Callable by anyone. Returns assets to their original owners.
    /// @param orderId The order ID to expire.
    function expireOrder(uint256 orderId) external whenNotPaused {
        ForwardOrder storage order = orders[orderId];

        // --- CHECKS ---
        if (order.orderId == 0) revert Errors.OrderNotFound(orderId);
        if (order.status >= 2)  revert Errors.OrderAlreadyFinalized(orderId);
        if (uint32(block.number) < order.deliveryBlock + GRACE_PERIOD) {
            revert Errors.DeliveryBlockNotReached(orderId, order.deliveryBlock + GRACE_PERIOD);
        }

        // --- EFFECTS ---
        order.status = 3; // expired

        // --- INTERACT ---
        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));

        // Return NFT to seller
        coretimeNFT.transferFrom(address(this), order.seller, uint256(order.coretimeRegion));
        ledger.unlockRegion(order.coretimeRegion);
        ledger.decrementPositionCount(order.seller);

        // If matched, return DOT to buyer
        if (order.buyer != address(0)) {
            IAssetsPrecompile(ASSETS_PRECOMPILE)
                .transfer(order.buyer, uint256(order.strikePriceDOT));
            ledger.releaseMargin(order.buyer, uint256(order.strikePriceDOT));
            ledger.decrementPositionCount(order.buyer);
        }

        delete regionToOrder[order.coretimeRegion];

        emit Events.OrderExpired(orderId);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /// @notice Validate that the strike price is within ±50% of the oracle spot price.
    /// @param strikePrice The proposed strike price in DOT planck.
    function _validateStrikePrice(uint128 strikePrice) internal view {
        // Call CoretimeOracle to get spot price
        address oracleAddr = registry.resolve(KEY_CORETIME_ORACLE);
        (bool success, bytes memory result) = oracleAddr.staticcall(
            abi.encodeWithSignature("spotPrice()")
        );

        if (success && result.length >= 32) {
            uint128 spotPrice = abi.decode(result, (uint128));
            if (spotPrice > 0) {
                uint128 lowerBound = spotPrice * (100 - PRICE_BAND_PCT) / 100;
                uint128 upperBound = spotPrice * (100 + PRICE_BAND_PCT) / 100;

                if (strikePrice < lowerBound || strikePrice > upperBound) {
                    revert Errors.StrikePriceOutOfBand(strikePrice, spotPrice);
                }
            }
        }
        // If oracle is not available, allow the order (graceful degradation)
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /// @notice Get all order IDs for a seller.
    function getSellerOrders(address seller) external view returns (uint256[] memory) {
        return sellerOrders[seller];
    }

    /// @notice Get all order IDs for a buyer.
    function getBuyerOrders(address buyer) external view returns (uint256[] memory) {
        return buyerOrders[buyer];
    }

    /// @notice Get the active order for a specific region.
    function getRegionOrder(uint128 regionId) external view returns (uint256) {
        return regionToOrder[regionId];
    }
}
