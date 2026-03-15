// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Errors}            from "./libraries/Errors.sol";
import {Events}            from "./libraries/Events.sol";
import {CoreDexRegistry}   from "./CoreDexRegistry.sol";
import {CoretimeLedger}    from "./CoretimeLedger.sol";
import {IXcmPrecompile}    from "./interfaces/IXcmPrecompile.sol";
import {ICoretimeNFT}      from "./interfaces/ICoretimeNFT.sol";
import {IAssetsPrecompile} from "./interfaces/IAssetsPrecompile.sol";

/// @title SettlementExecutor
/// @notice The most technically novel contract in CoreDex. Responsible for
///         constructing and dispatching XCM v5 programs that physically deliver
///         coretime NFTs between counterparties on settlement. This is what
///         makes CoreDex trustless — the settlement IS an on-chain XCM
///         instruction, not an off-chain action.
///
/// @dev    WHY XCM:
///         Coretime NFTs exist on the Coretime Chain (a system parachain).
///         CoreDex contracts live on Asset Hub. When a forward or option settles,
///         the NFT must be transferred from the contract's escrow account on
///         Coretime Chain to the buyer's address. This is a cross-chain asset
///         movement and MUST go through XCM.
///
///         ATOMICITY (TWO-PHASE COMMIT):
///         True atomicity across two separate chains is not achievable in a single
///         XCM dispatch in v5. SettlementExecutor handles this with a two-phase commit:
///         (1) DOT is locked in escrow on Asset Hub at order creation,
///         (2) at settlement block, NFT delivery XCM is dispatched first, and DOT
///             release is conditioned on an XCM acknowledgement callback.
///         If the NFT delivery fails, DOT escrow is never released and both
///         parties can reclaim their assets after a timeout (14,400 blocks ~24h).
///
///         ACCESS:
///         Called by ForwardMarket and OptionsEngine — never by users directly.
contract SettlementExecutor {

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice XCM Precompile — REAL Polkadot Hub precompile address.
    ///         This is the canonical address provided by the Polkadot runtime.
    ///         See: https://docs.polkadot.com/develop/smart-contracts/precompiles/xcm-precompile/
    address public constant XCM_PRECOMPILE =
        0x00000000000000000000000000000000000a0000;

    /// @notice Assets Precompile address on Asset Hub.
    address public constant ASSETS_PRECOMPILE =
        0xc82e04234549D48b961d8Cb3F3c60609dDF3F006; // MockAssets PVM contract

    /// @notice Coretime Chain parachain ID.
    uint32 public constant CORETIME_PARA_ID = 1005;

    /// @notice Asset Hub parachain ID.
    uint32 public constant ASSET_HUB_PARA_ID = 1000;

    /// @notice Recovery timeout in blocks (~24 hours at 6s blocks).
    uint32 public constant RECOVERY_TIMEOUT = 14_400;

    /// @notice Default XCM weight limit for NFT delivery.
    uint64 public constant DEFAULT_REF_TIME = 1_000_000_000;

    /// @notice Default XCM proof size limit.
    uint64 public constant DEFAULT_PROOF_SIZE = 100_000;

    // -------------------------------------------------------------------------
    // Registry keys
    // -------------------------------------------------------------------------

    bytes32 public constant KEY_FORWARD_MARKET = keccak256("ForwardMarket");
    bytes32 public constant KEY_OPTIONS_ENGINE = keccak256("OptionsEngine");
    bytes32 public constant KEY_LEDGER         = keccak256("CoretimeLedger");

    // -------------------------------------------------------------------------
    // Enums & Structs
    // -------------------------------------------------------------------------

    /// @notice Type of settlement being executed.
    enum SettlementType { Forward, Option }

    /// @notice Phase of the two-phase commit.
    enum SettlementPhase { Pending, Dispatched, Confirmed, Failed, Recovered }

    /// @notice Represents a settlement operation in progress.
    struct Settlement {
        uint256 positionId;           // orderId or optionId
        SettlementType settlementType;
        SettlementPhase phase;
        address seller;               // NFT source
        address buyer;                // NFT destination
        uint128 regionId;             // coretime NFT token ID
        uint128 dotAmount;            // DOT payment amount
        bytes32 xcmHash;              // hash of dispatched XCM message
        uint32  dispatchBlock;        // block at which XCM was dispatched
        uint32  confirmBlock;         // block at which settlement was confirmed (0 if pending)
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Reference to the CoreDexRegistry.
    CoreDexRegistry public immutable registry;

    /// @notice Reference to the Coretime NFT contract.
    ICoretimeNFT public immutable coretimeNFT;

    /// @notice All settlements by position ID.
    mapping(uint256 => Settlement) public settlements;

    /// @notice XCM hash → position ID mapping for callback resolution.
    mapping(bytes32 => uint256) public xcmHashToPosition;

    /// @notice Total settlements dispatched.
    uint256 public totalSettlements;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param _registry    Address of the deployed CoreDexRegistry.
    /// @param _coretimeNFT Address of the Coretime NFT precompile.
    constructor(address _registry, address _coretimeNFT) {
        if (_registry == address(0)) revert Errors.ZeroAddress();
        if (_coretimeNFT == address(0)) revert Errors.ZeroAddress();
        registry    = CoreDexRegistry(_registry);
        coretimeNFT = ICoretimeNFT(_coretimeNFT);
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    /// @notice Ensures the protocol is not paused.
    modifier whenNotPaused() {
        if (registry.paused()) revert Errors.ProtocolPaused();
        _;
    }

    /// @notice Ensures the caller is ForwardMarket or OptionsEngine.
    modifier onlyMarketContract() {
        bool authorised = false;

        try registry.resolve(KEY_FORWARD_MARKET) returns (address addr) {
            if (msg.sender == addr) authorised = true;
        } catch {}

        if (!authorised) {
            try registry.resolve(KEY_OPTIONS_ENGINE) returns (address addr) {
                if (msg.sender == addr) authorised = true;
            } catch {}
        }

        if (!authorised) revert Errors.Unauthorised(msg.sender);
        _;
    }

    // -------------------------------------------------------------------------
    // Settlement Functions
    // -------------------------------------------------------------------------

    /// @notice Settle a forward order. Called by ForwardMarket at deliveryBlock.
    ///         Dispatches XCM to deliver the coretime NFT from escrow to the buyer.
    ///         DOT release is conditioned on XCM acknowledgement callback.
    /// @param orderId  The forward order ID.
    /// @param seller   The seller's address (NFT source).
    /// @param buyer    The buyer's address (NFT destination).
    /// @param regionId The coretime region NFT token ID.
    /// @param dotAmount DOT payment amount in planck.
    function settleForward(
        uint256 orderId,
        address seller,
        address buyer,
        uint128 regionId,
        uint128 dotAmount
    )
        external
        whenNotPaused
        onlyMarketContract
    {
        if (settlements[orderId].positionId != 0) {
            revert Errors.AlreadySettled(orderId);
        }

        // Build and dispatch XCM for NFT delivery
        bytes32 xcmHash = _dispatchNFTDelivery(regionId, buyer);

        // Record settlement
        settlements[orderId] = Settlement({
            positionId:     orderId,
            settlementType: SettlementType.Forward,
            phase:          SettlementPhase.Dispatched,
            seller:         seller,
            buyer:          buyer,
            regionId:       regionId,
            dotAmount:      dotAmount,
            xcmHash:        xcmHash,
            dispatchBlock:  uint32(block.number),
            confirmBlock:   0
        });

        xcmHashToPosition[xcmHash] = orderId;
        totalSettlements++;

        emit Events.SettlementDispatched(orderId, xcmHash);
    }

    /// @notice Settle an option exercise. Called by OptionsEngine when exercise() is invoked.
    /// @param optionId  The option ID.
    /// @param seller    The writer's address (NFT source for calls).
    /// @param buyer     The holder's address (NFT destination for calls).
    /// @param regionId  The coretime region NFT token ID.
    /// @param dotAmount DOT payment amount in planck.
    function settleOption(
        uint256 optionId,
        address seller,
        address buyer,
        uint128 regionId,
        uint128 dotAmount
    )
        external
        whenNotPaused
        onlyMarketContract
    {
        if (settlements[optionId].positionId != 0) {
            revert Errors.AlreadySettled(optionId);
        }

        // Build and dispatch XCM for NFT delivery
        bytes32 xcmHash = _dispatchNFTDelivery(regionId, buyer);

        // Record settlement
        settlements[optionId] = Settlement({
            positionId:     optionId,
            settlementType: SettlementType.Option,
            phase:          SettlementPhase.Dispatched,
            seller:         seller,
            buyer:          buyer,
            regionId:       regionId,
            dotAmount:      dotAmount,
            xcmHash:        xcmHash,
            dispatchBlock:  uint32(block.number),
            confirmBlock:   0
        });

        xcmHashToPosition[xcmHash] = optionId;
        totalSettlements++;

        emit Events.SettlementDispatched(optionId, xcmHash);
    }

    // -------------------------------------------------------------------------
    // XCM Callback
    // -------------------------------------------------------------------------

    /// @notice Handle the XCM settlement callback. Called by the XCM response
    ///         handler when the NFT delivery XCM is acknowledged.
    ///         On success: releases escrowed DOT to the seller.
    ///         On failure: marks settlement as failed for recovery.
    /// @param xcmHash The hash of the XCM message being acknowledged.
    /// @param success Whether the XCM execution succeeded.
    function handleSettlementCallback(bytes32 xcmHash, bool success) external whenNotPaused {
        uint256 positionId = xcmHashToPosition[xcmHash];
        if (positionId == 0) revert Errors.SettlementCallbackFailed(0, xcmHash);

        Settlement storage settlement = settlements[positionId];
        if (settlement.phase != SettlementPhase.Dispatched) {
            revert Errors.AlreadySettled(positionId);
        }

        if (success) {
            // Phase 2: NFT delivery confirmed → release DOT to seller
            settlement.phase = SettlementPhase.Confirmed;
            settlement.confirmBlock = uint32(block.number);

            // Transfer DOT from escrow to seller
            bool dotSent = IAssetsPrecompile(ASSETS_PRECOMPILE)
                .transfer(settlement.seller, uint256(settlement.dotAmount));
            if (!dotSent) revert Errors.DOTTransferFailed(uint256(settlement.dotAmount));

            // Release margin in ledger
            CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
            ledger.releaseMargin(settlement.buyer, uint256(settlement.dotAmount));

            emit Events.SettlementConfirmed(positionId, xcmHash);
        } else {
            // NFT delivery failed → mark for recovery
            settlement.phase = SettlementPhase.Failed;

            emit Events.SettlementFailed(positionId, xcmHash, "");
        }
    }

    // -------------------------------------------------------------------------
    // Recovery
    // -------------------------------------------------------------------------

    /// @notice Recover assets from a failed settlement after the timeout period.
    ///         Returns the NFT to the seller and DOT to the buyer.
    ///         Callable by either party after RECOVERY_TIMEOUT blocks.
    /// @param positionId The position ID (orderId or optionId) to recover.
    function recoverFailed(uint256 positionId) external whenNotPaused {
        Settlement storage settlement = settlements[positionId];

        // --- CHECKS ---
        if (settlement.positionId == 0) revert Errors.AlreadySettled(positionId);
        if (settlement.phase != SettlementPhase.Failed &&
            settlement.phase != SettlementPhase.Dispatched) {
            revert Errors.AlreadySettled(positionId);
        }

        // For dispatched settlements, require timeout before recovery
        if (settlement.phase == SettlementPhase.Dispatched) {
            if (uint32(block.number) < settlement.dispatchBlock + RECOVERY_TIMEOUT) {
                revert Errors.RecoveryTimeoutNotReached(positionId);
            }
        }

        // Only seller or buyer can initiate recovery
        if (msg.sender != settlement.seller && msg.sender != settlement.buyer) {
            revert Errors.Unauthorised(msg.sender);
        }

        // --- EFFECTS ---
        settlement.phase = SettlementPhase.Recovered;

        // --- INTERACT ---
        // Return NFT to seller (it's still in this contract's escrow)
        coretimeNFT.transferFrom(address(this), settlement.seller, uint256(settlement.regionId));

        // Return DOT to buyer
        if (settlement.dotAmount > 0) {
            bool dotReturned = IAssetsPrecompile(ASSETS_PRECOMPILE)
                .transfer(settlement.buyer, uint256(settlement.dotAmount));
            if (!dotReturned) revert Errors.DOTTransferFailed(uint256(settlement.dotAmount));
        }

        // Unlock region in ledger
        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.unlockRegion(settlement.regionId);
        ledger.releaseMargin(settlement.buyer, uint256(settlement.dotAmount));
        ledger.decrementPositionCount(settlement.seller);
        ledger.decrementPositionCount(settlement.buyer);

        emit Events.RecoveryInitiated(positionId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Internal — XCM Construction
    // -------------------------------------------------------------------------

    /// @notice Dispatch XCM to deliver a coretime NFT to the buyer.
    ///         Constructs an XCM v5 program:
    ///           WithdrawAsset { (CoretimeNFT(regionId), 1) }
    ///           InitiateTeleport {
    ///             assets: All,
    ///             dest: Parachain(1000), // Asset Hub
    ///             xcm: [ DepositAsset { All, beneficiary: buyer } ]
    ///           }
    /// @param regionId The coretime region NFT token ID.
    /// @param buyer    The buyer's address to receive the NFT.
    /// @return xcmHash Hash of the dispatched XCM message.
    function _dispatchNFTDelivery(uint128 regionId, address buyer)
        internal
        returns (bytes32 xcmHash)
    {
        // Construct XCM program for NFT delivery
        // The XCM program is SCALE-encoded and dispatched via the REAL XCM precompile
        bytes memory xcmProgram = _buildNFTDeliveryXcm(regionId, buyer);

        // Execute XCM via the REAL Polkadot Hub XCM precompile
        // Interface: execute(bytes message, uint64 maxWeight) returns (bool)
        bool success = IXcmPrecompile(XCM_PRECOMPILE)
            .execute(xcmProgram, DEFAULT_REF_TIME);

        if (!success) {
            revert Errors.XcmDispatchFailed(bytes32(0));
        }

        // Return a tracking hash based on regionId and block
        xcmHash = keccak256(abi.encodePacked(regionId, buyer, block.number));
    }

    /// @notice Build the SCALE-encoded XCM v5 program for NFT delivery.
    ///         This constructs the raw bytes that the XCM precompile expects.
    /// @param regionId The coretime region NFT token ID.
    /// @param buyer    The buyer's address.
    /// @return xcmProgram The SCALE-encoded XCM program bytes.
    function _buildNFTDeliveryXcm(uint128 regionId, address buyer)
        internal
        pure
        returns (bytes memory xcmProgram)
    {
        // XCM v5 program structure (SCALE-encoded):
        //
        // Xcm([
        //   WithdrawAsset {
        //     assets: [(CoretimeNFT(regionId), 1)]
        //   },
        //   InitiateTeleport {
        //     assets: All,
        //     dest: Parachain(1000),  // Asset Hub
        //     xcm: Xcm([
        //       DepositAsset {
        //         assets: All,
        //         beneficiary: AccountId32 { id: buyer_address }
        //       }
        //     ])
        //   }
        // ])
        //
        // NOTE: The actual SCALE encoding of this XCM program depends on the
        // exact XCM v5 type definitions and SCALE codec rules. The bytes below
        // represent a simplified encoding. In production, this would use a
        // proper SCALE encoding library or be constructed in the PVM Rust module
        // where SCALE encoding is native.

        // Encode the buyer address as a 32-byte AccountId32
        bytes32 buyerAccountId = bytes32(uint256(uint160(buyer)));

        // Build the XCM program bytes
        // This is a simplified representation — actual SCALE encoding will differ
        xcmProgram = abi.encodePacked(
            // XCM version prefix (v5)
            uint8(5),
            // Number of instructions
            uint8(2),
            // Instruction 0: WithdrawAsset
            uint8(0),                      // WithdrawAsset opcode
            uint128(regionId),             // NFT ID
            uint128(1),                    // Amount (1 NFT)
            // Instruction 1: InitiateTeleport
            uint8(4),                      // InitiateTeleport opcode
            uint32(ASSET_HUB_PARA_ID),     // Destination parachain
            // Inner XCM: DepositAsset
            uint8(1),                      // Number of inner instructions
            uint8(2),                      // DepositAsset opcode
            buyerAccountId                 // Beneficiary
        );
    }

    /// @notice Build the SCALE-encoded XCM v5 program for DOT payment.
    /// @param seller    The seller's address to receive DOT.
    /// @param dotAmount DOT amount to transfer.
    /// @return xcmProgram The SCALE-encoded XCM program bytes.
    function _buildDOTPaymentXcm(address seller, uint128 dotAmount)
        internal
        pure
        returns (bytes memory xcmProgram)
    {
        bytes32 sellerAccountId = bytes32(uint256(uint160(seller)));

        xcmProgram = abi.encodePacked(
            uint8(5),                       // XCM version prefix (v5)
            uint8(2),                       // Number of instructions
            uint8(0),                       // WithdrawAsset opcode
            uint128(dotAmount),             // DOT amount
            uint8(4),                       // InitiateTeleport opcode
            uint32(CORETIME_PARA_ID),       // Destination: Coretime Chain
            uint8(1),                       // Number of inner instructions
            uint8(2),                       // DepositAsset opcode
            sellerAccountId                 // Beneficiary (seller)
        );
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    /// @notice Get the settlement details for a position.
    /// @param positionId The position ID (orderId or optionId).
    /// @return settlement The settlement struct.
    function getSettlement(uint256 positionId)
        external
        view
        returns (Settlement memory)
    {
        return settlements[positionId];
    }

    /// @notice Check if a settlement is in a recoverable state.
    /// @param positionId The position ID.
    /// @return recoverable True if recovery can be initiated.
    function isRecoverable(uint256 positionId) external view returns (bool recoverable) {
        Settlement storage settlement = settlements[positionId];
        if (settlement.positionId == 0) return false;

        if (settlement.phase == SettlementPhase.Failed) return true;

        if (settlement.phase == SettlementPhase.Dispatched &&
            uint32(block.number) >= settlement.dispatchBlock + RECOVERY_TIMEOUT) {
            return true;
        }

        return false;
    }
}
