// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Errors}           from "./libraries/Errors.sol";
import {Events}           from "./libraries/Events.sol";
import {CoreDexRegistry}  from "./CoreDexRegistry.sol";
import {CoretimeLedger}   from "./CoretimeLedger.sol";
import {ICoretimeNFT}     from "./interfaces/ICoretimeNFT.sol";
import {IAssetsPrecompile} from "./interfaces/IAssetsPrecompile.sol";

/// @title OptionsEngine
/// @notice Issues and manages European-style coretime options. A call option
///         gives the buyer the right (not obligation) to purchase a specific
///         coretime region at the strike price at expiry. A put option gives
///         the right to sell. Options require premium payment upfront and
///         collateral from the option writer.
///
/// @dev    EUROPEAN-STYLE:
///         Options are exercisable only at the expiry block, not before.
///         This simplifies settlement mechanics and removes the complexity
///         of early-exercise premium adjustments.
///
///         PRICING:
///         Premium is fetched from PricingModule (PVM) before issuance —
///         non-negotiable, not user-set. The PricingModule implements
///         Black-Scholes with inputs from CoretimeOracle.
///
///         COLLATERAL:
///         - Call writer: must escrow the coretime NFT (physical delivery)
///         - Put writer: must escrow DOT equal to strikePriceDOT (cash settlement)
///         - Collateral locked for full option lifetime — no partial withdrawal
contract OptionsEngine {

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    address public constant ASSETS_PRECOMPILE =
        0xc82e04234549D48b961d8Cb3F3c60609dDF3F006; // MockAssets PVM contract

    uint8 public constant OPTION_CALL = 0;
    uint8 public constant OPTION_PUT  = 1;

    // -------------------------------------------------------------------------
    // Registry keys
    // -------------------------------------------------------------------------

    bytes32 public constant KEY_PRICING_MODULE  = keccak256("PricingModule");
    bytes32 public constant KEY_CORETIME_ORACLE = keccak256("CoretimeOracle");
    bytes32 public constant KEY_SETTLEMENT      = keccak256("SettlementExecutor");
    bytes32 public constant KEY_LEDGER          = keccak256("CoretimeLedger");

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct Option {
        uint256 optionId;
        address writer;              // sold the option, posted collateral
        address holder;              // paid the premium, holds the right
        uint128 coretimeRegion;      // underlying coretime NFT token ID
        uint128 strikePriceDOT;      // strike in DOT planck (18 decimals)
        uint128 premiumDOT;          // premium paid at issuance (from PricingModule)
        uint32  expiryBlock;         // relay chain block
        uint8   optionType;          // 0 = call, 1 = put
        uint8   status;              // 0=active, 1=exercised, 2=expired
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    CoreDexRegistry public immutable registry;
    ICoretimeNFT    public immutable coretimeNFT;

    mapping(uint256 => Option) public options;
    mapping(address => uint256[]) public writerOptions;
    mapping(address => uint256[]) public holderOptions;
    uint256 public nextOptionId;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _registry, address _coretimeNFT) {
        if (_registry == address(0)) revert Errors.ZeroAddress();
        if (_coretimeNFT == address(0)) revert Errors.ZeroAddress();
        registry = CoreDexRegistry(_registry);
        coretimeNFT = ICoretimeNFT(_coretimeNFT);
        nextOptionId = 1;
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier whenNotPaused() {
        if (registry.paused()) revert Errors.ProtocolPaused();
        _;
    }

    // -------------------------------------------------------------------------
    // Write Options
    // -------------------------------------------------------------------------

    /// @notice Write a call option — writer escrows their coretime NFT.
    ///         The option is created but not yet active until a holder buys it.
    /// @param regionId    The coretime region NFT token ID.
    /// @param strike      Strike price in DOT planck (18 decimals).
    /// @param expiryBlock Relay chain block at which the option can be exercised.
    /// @return optionId   The newly created option ID.
    function writeCall(
        uint128 regionId,
        uint128 strike,
        uint32  expiryBlock
    )
        external
        whenNotPaused
        returns (uint256 optionId)
    {
        // --- CHECKS ---
        if (expiryBlock <= uint32(block.number)) {
            revert Errors.DeliveryBlockInPast(expiryBlock);
        }
        if (strike == 0) revert Errors.ZeroAmount();
        if (coretimeNFT.ownerOf(uint256(regionId)) != msg.sender) {
            revert Errors.Unauthorised(msg.sender);
        }

        // Get premium from PricingModule
        uint128 premium = _getPremium(strike, expiryBlock, OPTION_CALL);

        // Lock region in ledger
        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.lockRegion(regionId, ledger.OPTION_POSITION());

        // --- EFFECTS ---
        optionId = nextOptionId++;

        options[optionId] = Option({
            optionId:       optionId,
            writer:         msg.sender,
            holder:         address(0),
            coretimeRegion: regionId,
            strikePriceDOT: strike,
            premiumDOT:     premium,
            expiryBlock:    expiryBlock,
            optionType:     OPTION_CALL,
            status:         0 // active (awaiting holder)
        });

        writerOptions[msg.sender].push(optionId);

        // --- INTERACT ---
        // Escrow the NFT
        coretimeNFT.transferFrom(msg.sender, address(this), uint256(regionId));
        ledger.incrementPositionCount(msg.sender);

        emit Events.OptionWritten(optionId, msg.sender, OPTION_CALL, premium);
    }

    /// @notice Write a put option — writer escrows DOT equal to strike price.
    /// @param regionId    The coretime region NFT token ID (underlying).
    /// @param strike      Strike price in DOT planck (18 decimals).
    /// @param expiryBlock Relay chain block at which the option can be exercised.
    /// @return optionId   The newly created option ID.
    function writePut(
        uint128 regionId,
        uint128 strike,
        uint32  expiryBlock
    )
        external
        whenNotPaused
        returns (uint256 optionId)
    {
        if (expiryBlock <= uint32(block.number)) {
            revert Errors.DeliveryBlockInPast(expiryBlock);
        }
        if (strike == 0) revert Errors.ZeroAmount();

        uint128 premium = _getPremium(strike, expiryBlock, OPTION_PUT);

        // --- EFFECTS ---
        optionId = nextOptionId++;

        options[optionId] = Option({
            optionId:       optionId,
            writer:         msg.sender,
            holder:         address(0),
            coretimeRegion: regionId,
            strikePriceDOT: strike,
            premiumDOT:     premium,
            expiryBlock:    expiryBlock,
            optionType:     OPTION_PUT,
            status:         0
        });

        writerOptions[msg.sender].push(optionId);

        // --- INTERACT ---
        // Escrow DOT equal to strike price from writer (using transferFrom since contract is calling)
        bool transferred = IAssetsPrecompile(ASSETS_PRECOMPILE)
            .transferFrom(msg.sender, address(this), uint256(strike));
        if (!transferred) revert Errors.DOTTransferFailed(uint256(strike));

        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.addMargin(msg.sender, uint256(strike));
        ledger.incrementPositionCount(msg.sender);

        emit Events.OptionWritten(optionId, msg.sender, OPTION_PUT, premium);
    }

    // -------------------------------------------------------------------------
    // Buy Option
    // -------------------------------------------------------------------------

    /// @notice Buy an option — holder pays the premium to the writer.
    ///         The option becomes active.
    /// @param optionId The option ID to purchase.
    function buyOption(uint256 optionId) external whenNotPaused {
        Option storage opt = options[optionId];

        // --- CHECKS ---
        if (opt.optionId == 0) revert Errors.OptionNotActive(optionId);
        if (opt.status != 0)   revert Errors.OptionNotActive(optionId);
        if (opt.holder != address(0)) revert Errors.OptionNotActive(optionId);
        if (opt.writer == msg.sender) revert Errors.Unauthorised(msg.sender);

        // --- EFFECTS ---
        opt.holder = msg.sender;
        holderOptions[msg.sender].push(optionId);

        // --- INTERACT ---
        // Transfer premium from holder directly to writer (using transferFrom)
        bool premiumSent = IAssetsPrecompile(ASSETS_PRECOMPILE)
            .transferFrom(msg.sender, opt.writer, uint256(opt.premiumDOT));
        if (!premiumSent) revert Errors.DOTTransferFailed(uint256(opt.premiumDOT));

        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));
        ledger.incrementPositionCount(msg.sender);

        emit Events.OptionPurchased(optionId, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Exercise Option (European-style: only at expiry block)
    // -------------------------------------------------------------------------

    /// @notice Exercise an option at the expiry block.
    ///         For calls: holder pays strike, receives NFT.
    ///         For puts: holder delivers NFT, receives strike DOT.
    /// @param optionId The option ID to exercise.
    function exercise(uint256 optionId) external whenNotPaused {
        Option storage opt = options[optionId];

        // --- CHECKS ---
        if (opt.optionId == 0)         revert Errors.OptionNotActive(optionId);
        if (opt.status != 0)           revert Errors.OptionNotActive(optionId);
        if (opt.holder == address(0))  revert Errors.OptionNotActive(optionId);
        if (opt.holder != msg.sender)  revert Errors.NotOptionHolder(msg.sender, optionId);
        if (uint32(block.number) != opt.expiryBlock) {
            revert Errors.NotAtExpiryBlock(optionId, opt.expiryBlock);
        }

        // --- EFFECTS ---
        opt.status = 1; // exercised

        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));

        if (opt.optionType == OPTION_CALL) {
            // --- INTERACT: Call exercise ---
            // Holder pays strike price in DOT (using transferFrom since contract is calling)
            bool dotPaid = IAssetsPrecompile(ASSETS_PRECOMPILE)
                .transferFrom(msg.sender, address(this), uint256(opt.strikePriceDOT));
            if (!dotPaid) revert Errors.DOTTransferFailed(uint256(opt.strikePriceDOT));

            // Transfer DOT to writer
            bool dotToWriter = IAssetsPrecompile(ASSETS_PRECOMPILE)
                .transfer(opt.writer, uint256(opt.strikePriceDOT));
            if (!dotToWriter) revert Errors.DOTTransferFailed(uint256(opt.strikePriceDOT));

            // Transfer NFT to holder via SettlementExecutor
            address settlementAddr = registry.resolve(KEY_SETTLEMENT);
            // solhint-disable-next-line avoid-low-level-calls
            (bool settled, ) = settlementAddr.call(
                abi.encodeWithSignature("settleOption(uint256)", optionId)
            );
            require(settled, "Settlement call failed");

            // Unlock region
            ledger.unlockRegion(opt.coretimeRegion);
        } else {
            // --- INTERACT: Put exercise ---
            // Holder delivers NFT
            coretimeNFT.transferFrom(msg.sender, opt.writer, uint256(opt.coretimeRegion));

            // Release escrowed DOT (strike) to holder
            bool dotToHolder = IAssetsPrecompile(ASSETS_PRECOMPILE)
                .transfer(opt.holder, uint256(opt.strikePriceDOT));
            if (!dotToHolder) revert Errors.DOTTransferFailed(uint256(opt.strikePriceDOT));

            ledger.releaseMargin(opt.writer, uint256(opt.strikePriceDOT));
        }

        ledger.decrementPositionCount(opt.writer);
        ledger.decrementPositionCount(opt.holder);

        emit Events.OptionExercised(optionId, msg.sender);
    }

    /// @notice Expire an unexercised option after the expiry block.
    ///         Releases collateral back to the writer.
    /// @param optionId The option ID to expire.
    function expireOption(uint256 optionId) external whenNotPaused {
        Option storage opt = options[optionId];

        // --- CHECKS ---
        if (opt.optionId == 0) revert Errors.OptionNotActive(optionId);
        if (opt.status != 0)   revert Errors.OptionNotActive(optionId);
        if (uint32(block.number) <= opt.expiryBlock) {
            revert Errors.OptionNotExpired(optionId);
        }

        // --- EFFECTS ---
        opt.status = 2; // expired

        CoretimeLedger ledger = CoretimeLedger(registry.resolve(KEY_LEDGER));

        // --- INTERACT ---
        if (opt.optionType == OPTION_CALL) {
            // Return NFT to writer
            coretimeNFT.transferFrom(address(this), opt.writer, uint256(opt.coretimeRegion));
            ledger.unlockRegion(opt.coretimeRegion);
        } else {
            // Return DOT to writer
            bool dotReturned = IAssetsPrecompile(ASSETS_PRECOMPILE)
                .transfer(opt.writer, uint256(opt.strikePriceDOT));
            if (!dotReturned) revert Errors.DOTTransferFailed(uint256(opt.strikePriceDOT));
            ledger.releaseMargin(opt.writer, uint256(opt.strikePriceDOT));
        }

        ledger.decrementPositionCount(opt.writer);
        if (opt.holder != address(0)) {
            ledger.decrementPositionCount(opt.holder);
        }

        emit Events.OptionExpired(optionId);
    }

    // -------------------------------------------------------------------------
    // Internal — PricingModule Integration
    // -------------------------------------------------------------------------

    /// @notice Get the premium for an option from the PricingModule (PVM).
    /// @param strike      Strike price in DOT planck.
    /// @param expiryBlock Expiry block number.
    /// @param optionType  0 = call, 1 = put.
    /// @return premium    Premium in DOT planck.
    function _getPremium(
        uint128 strike,
        uint32  expiryBlock,
        uint8   optionType
    ) internal view returns (uint128 premium) {
        // Get spot price and volatility from CoretimeOracle
        address oracleAddr = registry.resolve(KEY_CORETIME_ORACLE);

        (bool spotSuccess, bytes memory spotResult) = oracleAddr.staticcall(
            abi.encodeWithSignature("spotPrice()")
        );
        if (!spotSuccess || spotResult.length < 32) revert Errors.PricingModuleCallFailed();
        uint128 spotPrice = abi.decode(spotResult, (uint128));

        (bool volSuccess, bytes memory volResult) = oracleAddr.staticcall(
            abi.encodeWithSignature("impliedVolatility()")
        );
        if (!volSuccess || volResult.length < 32) revert Errors.PricingModuleCallFailed();
        uint64 volatility = abi.decode(volResult, (uint64));

        // Call PricingModule to get premium via Black-Scholes
        address pricingAddr = registry.resolve(KEY_PRICING_MODULE);
        bytes memory calldata_ = abi.encodeWithSignature(
            "price_option(uint128,uint128,uint32,uint64,uint8)",
            spotPrice,
            strike,
            expiryBlock - uint32(block.number),
            volatility,
            optionType
        );

        (bool success, bytes memory result) = pricingAddr.staticcall(calldata_);
        if (!success || result.length < 64) revert Errors.PricingModuleCallFailed();

        (premium, ) = abi.decode(result, (uint128, uint128));
    }

    // -------------------------------------------------------------------------
    // View Functions
    // -------------------------------------------------------------------------

    function getWriterOptions(address writer) external view returns (uint256[] memory) {
        return writerOptions[writer];
    }

    function getHolderOptions(address holder) external view returns (uint256[] memory) {
        return holderOptions[holder];
    }
}
