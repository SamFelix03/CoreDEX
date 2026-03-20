import type { Abi } from "viem";

/**
 * Function selectors depend only on `function name(input types…)`. Output types and parameter
 * names do not change selectors, but wrong **input** types (e.g. uint256 vs uint128) call the
 * wrong function and revert with ~no gas. Keep in sync with `smart-contracts/typechain-types/factories/*__factory.ts`.
 */

// ─── CoreDexRegistry ABI ────────────────────────────────────────────────────
export const REGISTRY_ABI = [
  { name: "governance",        type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused",            type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "version",           type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "resolve",           type: "function", stateMutability: "view", inputs: [{ name: "key", type: "bytes32" }], outputs: [{ type: "address" }] },
  { name: "TIMELOCK_DELAY",    type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "register",          type: "function", stateMutability: "nonpayable", inputs: [{ name: "key", type: "bytes32" }, { name: "addr", type: "address" }], outputs: [] },
  { name: "proposeUpdate",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "key", type: "bytes32" }, { name: "newAddr", type: "address" }], outputs: [] },
  { name: "executeUpdate",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "key", type: "bytes32" }], outputs: [] },
  { name: "pause",             type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "unpause",           type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "transferGovernance",type: "function", stateMutability: "nonpayable", inputs: [{ name: "newGov", type: "address" }], outputs: [] },
  { name: "ContractUpdated",   type: "event", inputs: [{ name: "key", type: "bytes32", indexed: true }, { name: "oldAddr", type: "address", indexed: false }, { name: "newAddr", type: "address", indexed: false }, { name: "version", type: "uint256", indexed: false }] },
  { name: "ProtocolPaused",    type: "event", inputs: [{ name: "by", type: "address", indexed: true }] },
  { name: "ProtocolUnpaused",  type: "event", inputs: [{ name: "by", type: "address", indexed: true }] },
] as const satisfies Abi;

// ─── ForwardMarket ABI ──────────────────────────────────────────────────────
export const FORWARD_MARKET_ABI = [
  { name: "nextOrderId",     type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "GRACE_PERIOD",    type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  { name: "PRICE_BAND_PCT",  type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  { name: "orders",          type: "function", stateMutability: "view",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [
      // Solidity getter for `mapping(uint256 => ForwardOrder) public orders;`
      // where ForwardOrder fields are:
      //   orderId, seller, buyer, coretimeRegion(uint128), strikePriceDOT(uint128),
      //   deliveryBlock(uint32), createdBlock(uint32), status(uint8)
      { name: "orderId",         type: "uint256" },
      { name: "seller",         type: "address" },
      { name: "buyer",          type: "address" },
      { name: "coretimeRegion", type: "uint128" },
      { name: "strikePriceDOT", type: "uint128" },
      { name: "deliveryBlock",  type: "uint32" },
      { name: "createdBlock",   type: "uint32" },
      { name: "status",         type: "uint8" },
    ],
  },
  { name: "getSellerOrders", type: "function", stateMutability: "view", inputs: [{ name: "seller", type: "address" }], outputs: [{ type: "uint256[]" }] },
  { name: "getBuyerOrders",  type: "function", stateMutability: "view", inputs: [{ name: "buyer", type: "address" }], outputs: [{ type: "uint256[]" }] },
  { name: "getRegionOrder",  type: "function", stateMutability: "view", inputs: [{ name: "regionId", type: "uint128" }], outputs: [{ type: "uint256" }] },
  /** Must match Solidity `createAsk(uint128,uint128,uint32)` — wrong types = wrong selector = instant revert (~no gas). */
  { name: "createAsk",       type: "function", stateMutability: "nonpayable", inputs: [{ name: "regionId", type: "uint128" }, { name: "strikePrice", type: "uint128" }, { name: "deliveryBlock", type: "uint32" }], outputs: [{ name: "orderId", type: "uint256" }] },
  { name: "matchOrder",      type: "function", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { name: "settle",          type: "function", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { name: "cancel",          type: "function", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { name: "expireOrder",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "orderId", type: "uint256" }], outputs: [] },
  { name: "OrderCreated",    type: "event", inputs: [{ name: "orderId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "regionId", type: "uint128", indexed: false }, { name: "strikePriceDOT", type: "uint128", indexed: false }, { name: "deliveryBlock", type: "uint32", indexed: false }] },
  { name: "OrderMatched",    type: "event", inputs: [{ name: "orderId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true }] },
  { name: "OrderSettled",    type: "event", inputs: [{ name: "orderId", type: "uint256", indexed: true }, { name: "success", type: "bool", indexed: false }] },
  { name: "OrderCancelled",  type: "event", inputs: [{ name: "orderId", type: "uint256", indexed: true }, { name: "cancelledBy", type: "address", indexed: true }] },
  { name: "OrderExpired",    type: "event", inputs: [{ name: "orderId", type: "uint256", indexed: true }] },
] as const satisfies Abi;

// ─── OptionsEngine ABI ──────────────────────────────────────────────────────
export const OPTIONS_ENGINE_ABI = [
  { name: "nextOptionId",  type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "OPTION_CALL",   type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "OPTION_PUT",    type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "options",       type: "function", stateMutability: "view",
    inputs: [{ name: "optionId", type: "uint256" }],
    outputs: [
      // Solidity getter for `mapping(uint256 => Option) public options;`
      // where Option fields are:
      //   optionId, writer, holder, coretimeRegion(uint128), strikePriceDOT(uint128),
      //   premiumDOT(uint128), expiryBlock(uint32), optionType(uint8), status(uint8)
      { name: "optionId",       type: "uint256" },
      { name: "writer",         type: "address" },
      { name: "holder",         type: "address" },
      { name: "coretimeRegion", type: "uint128" },
      { name: "strikePriceDOT", type: "uint128" },
      { name: "premiumDOT",     type: "uint128" },
      { name: "expiryBlock",    type: "uint32" },
      { name: "optionType",     type: "uint8" },
      { name: "status",         type: "uint8" },
    ],
  },
  { name: "getWriterOptions", type: "function", stateMutability: "view", inputs: [{ name: "writer", type: "address" }], outputs: [{ type: "uint256[]" }] },
  { name: "getHolderOptions", type: "function", stateMutability: "view", inputs: [{ name: "holder", type: "address" }], outputs: [{ type: "uint256[]" }] },
  /** Solidity: `writeCall(uint128,uint128,uint32)` */
  { name: "writeCall",   type: "function", stateMutability: "nonpayable", inputs: [{ name: "regionId", type: "uint128" }, { name: "strike", type: "uint128" }, { name: "expiryBlock", type: "uint32" }], outputs: [{ name: "optionId", type: "uint256" }] },
  { name: "writePut",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "regionId", type: "uint128" }, { name: "strike", type: "uint128" }, { name: "expiryBlock", type: "uint32" }], outputs: [{ name: "optionId", type: "uint256" }] },
  { name: "buyOption",   type: "function", stateMutability: "nonpayable", inputs: [{ name: "optionId", type: "uint256" }], outputs: [] },
  { name: "exercise",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "optionId", type: "uint256" }], outputs: [] },
  { name: "expireOption",type: "function", stateMutability: "nonpayable", inputs: [{ name: "optionId", type: "uint256" }], outputs: [] },
  /** On-chain emits: optionType + premium (uint128) only — no region/strike/expiry in the log. */
  { name: "OptionWritten",   type: "event", inputs: [{ name: "optionId", type: "uint256", indexed: true }, { name: "writer", type: "address", indexed: true }, { name: "optionType", type: "uint8", indexed: false }, { name: "premium", type: "uint128", indexed: false }] },
  { name: "OptionPurchased", type: "event", inputs: [{ name: "optionId", type: "uint256", indexed: true }, { name: "holder", type: "address", indexed: true }] },
  { name: "OptionExercised", type: "event", inputs: [{ name: "optionId", type: "uint256", indexed: true }] },
  { name: "OptionExpired",   type: "event", inputs: [{ name: "optionId", type: "uint256", indexed: true }] },
] as const satisfies Abi;

// ─── YieldVault ABI ─────────────────────────────────────────────────────────
export const YIELD_VAULT_ABI = [
  { name: "totalDeposited",    type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalLent",         type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "currentEpoch",      type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "nextReceiptId",     type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "nextLoanId",        type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "utilisationRate",   type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "currentLendingRate",type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "rate", type: "uint128" }] },
  { name: "availableRegions",  type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getDepositorReceipts", type: "function", stateMutability: "view", inputs: [{ name: "depositor", type: "address" }], outputs: [{ type: "uint256[]" }] },
  { name: "deposits",         type: "function", stateMutability: "view",
    inputs: [{ name: "receiptTokenId", type: "uint256" }],
    outputs: [
      { name: "receiptTokenId", type: "uint256" },
      { name: "depositor",      type: "address" },
      { name: "regionId",       type: "uint128" },
      { name: "depositBlock",   type: "uint32" },
      { name: "isLent",         type: "bool" },
      { name: "withdrawn",      type: "bool" },
    ],
  },
  { name: "loans",            type: "function", stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [
      { name: "loanId",           type: "uint256" },
      { name: "borrower",         type: "address" },
      { name: "regionId",         type: "uint128" },
      { name: "startBlock",       type: "uint32" },
      { name: "durationBlocks",   type: "uint32" },
      { name: "feePaid",          type: "uint128" },
      { name: "returned",         type: "bool" },
    ],
  },
  { name: "deposit",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "regionId", type: "uint128" }], outputs: [{ name: "receiptId", type: "uint256" }] },
  { name: "withdraw",   type: "function", stateMutability: "nonpayable", inputs: [{ name: "receiptId", type: "uint256" }], outputs: [] },
  { name: "borrow",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "coreCount", type: "uint32" }, { name: "durationBlocks", type: "uint32" }], outputs: [{ name: "loanId", type: "uint256" }] },
  { name: "returnLoan", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }], outputs: [] },
  { name: "claimYield", type: "function", stateMutability: "nonpayable", inputs: [{ name: "receiptTokenId", type: "uint256" }, { name: "epoch", type: "uint256" }], outputs: [] },
  { name: "RegionDeposited", type: "event", inputs: [{ name: "depositor", type: "address", indexed: true }, { name: "regionId", type: "uint128", indexed: true }, { name: "receiptTokenId", type: "uint256", indexed: false }] },
  { name: "RegionWithdrawn", type: "event", inputs: [{ name: "depositor", type: "address", indexed: true }, { name: "regionId", type: "uint128", indexed: true }] },
  { name: "RegionLent",      type: "event", inputs: [{ name: "regionId", type: "uint128", indexed: true }, { name: "borrower", type: "address", indexed: true }, { name: "durationBlocks", type: "uint32", indexed: false }, { name: "fee", type: "uint128", indexed: false }] },
  { name: "RegionReturned",  type: "event", inputs: [{ name: "regionId", type: "uint128", indexed: true }] },
  { name: "YieldClaimed",    type: "event", inputs: [{ name: "depositor", type: "address", indexed: true }, { name: "receiptTokenId", type: "uint256", indexed: true }, { name: "amountDOT", type: "uint128", indexed: false }] },
] as const satisfies Abi;

// ─── SettlementExecutor ABI ─────────────────────────────────────────────────
export const SETTLEMENT_ABI = [
  { name: "totalSettlements",  type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "RECOVERY_TIMEOUT",  type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint32" }] },
  { name: "getSettlement",     type: "function", stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "positionId",       type: "uint256" },
          { name: "settlementType",   type: "uint8" },
          { name: "phase",            type: "uint8" },
          { name: "seller",           type: "address" },
          { name: "buyer",            type: "address" },
          { name: "regionId",         type: "uint128" },
          { name: "dotAmount",        type: "uint128" },
          { name: "xcmHash",          type: "bytes32" },
          { name: "dispatchBlock",    type: "uint32" },
          { name: "confirmBlock",     type: "uint32" },
        ],
      },
    ],
  },
  { name: "isRecoverable",    type: "function", stateMutability: "view", inputs: [{ name: "positionId", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "recoverFailed",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "positionId", type: "uint256" }], outputs: [] },
  { name: "SettlementDispatched", type: "event", inputs: [{ name: "positionId", type: "uint256", indexed: true }, { name: "xcmHash", type: "bytes32", indexed: false }] },
  { name: "SettlementConfirmed",  type: "event", inputs: [{ name: "positionId", type: "uint256", indexed: true }, { name: "xcmHash", type: "bytes32", indexed: false }] },
  { name: "SettlementFailed",     type: "event", inputs: [{ name: "positionId", type: "uint256", indexed: true }, { name: "xcmHash", type: "bytes32", indexed: false }, { name: "reason", type: "bytes", indexed: false }] },
  { name: "RecoveryInitiated",    type: "event", inputs: [{ name: "positionId", type: "uint256", indexed: true }, { name: "initiator", type: "address", indexed: true }] },
] as const satisfies Abi;

// ─── CoretimeLedger ABI ─────────────────────────────────────────────────────
export const LEDGER_ABI = [
  { name: "isRegionLocked",  type: "function", stateMutability: "view", inputs: [{ name: "regionId", type: "uint128" }], outputs: [{ name: "locked", type: "bool" }] },
  { name: "getRegionLocker", type: "function", stateMutability: "view", inputs: [{ name: "regionId", type: "uint128" }], outputs: [{ name: "locker", type: "address" }] },
  { name: "marginBalance",   type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "openPositionCount", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "totalLockEvents", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "RegionLocked",    type: "event", inputs: [{ name: "regionId", type: "uint128", indexed: true }, { name: "lockedBy", type: "address", indexed: true }, { name: "positionType", type: "bytes32", indexed: false }] },
  { name: "RegionUnlocked",  type: "event", inputs: [{ name: "regionId", type: "uint128", indexed: true }, { name: "unlockedBy", type: "address", indexed: true }] },
] as const satisfies Abi;

// ─── Asset Hub DOT precompile (ERC-20-style; `YieldVault.borrow` uses `transferFrom`) ───
export const ASSETS_PRECOMPILE_ABI = [
  {
    name:         "approve",
    type:         "function",
    stateMutability: "nonpayable",
    inputs:       [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs:      [{ type: "bool" }],
  },
  {
    name:         "allowance",
    type:         "function",
    stateMutability: "view",
    inputs:       [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs:      [{ type: "uint256" }],
  },
] as const satisfies Abi;
