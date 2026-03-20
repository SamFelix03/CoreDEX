// ─── Forward Orders ─────────────────────────────────────────────────────────

export enum OrderStatus {
  Open     = 0,
  Matched  = 1,
  Settled  = 2,
  Cancelled = 3,
  Expired  = 4,
}

export interface ForwardOrder {
  orderId:        bigint;
  seller:         string;
  buyer:          string;
  regionId:       bigint;
  strikePriceDOT: bigint;
  deliveryBlock:  bigint;
  status:         OrderStatus;
  createdBlock:   bigint;
}

// ─── Options ────────────────────────────────────────────────────────────────

export enum OptionType {
  Call = 0,
  Put  = 1,
}

/**
 * ⚠️ On-chain `OptionsEngine` uses: 0=active (listed or purchased), 1=exercised, 2=expired.
 * Do not assume `1` means “purchased” — use `holder != 0` for that (see `optionOnChainUi.ts`).
 */
export enum OptionStatus {
  Active    = 0,
  Purchased = 1,
  Exercised = 2,
  Expired   = 3,
}

export interface Option {
  optionId:       bigint;
  writer:         string;
  holder:         string;
  optionType:     OptionType;
  coretimeRegion: bigint;
  strikePriceDOT: bigint;
  premiumDOT:     bigint;
  expiryBlock:    bigint;
  status:         OptionStatus;
}

// ─── Yield Vault ────────────────────────────────────────────────────────────

export interface VaultDeposit {
  receiptId:   bigint;
  depositor:   string;
  regionId:    bigint;
  depositBlock: bigint;
  isActive:    boolean;
}

export interface VaultLoan {
  loanId:      bigint;
  borrower:    string;
  regionId:    bigint;
  feePaid:     bigint;
  dueBlock:    bigint;
  isReturned:  boolean;
}

export interface VaultStats {
  totalDeposited:   bigint;
  totalLent:        bigint;
  currentEpoch:     bigint;
  utilisationRate:  bigint;
  lendingRate:      bigint;
  availableRegions: bigint;
}

// ─── Settlement ─────────────────────────────────────────────────────────────

export enum SettlementStatus {
  None      = 0,
  Pending   = 1,
  Confirmed = 2,
  Failed    = 3,
}

export interface Settlement {
  positionId:    bigint;
  seller:        string;
  buyer:         string;
  regionId:      bigint;
  dotAmount:     bigint;
  xcmHash:       string;
  status:        SettlementStatus;
  dispatchBlock: bigint;
}

// ─── Registry ───────────────────────────────────────────────────────────────

export interface ProtocolStatus {
  paused:     boolean;
  governance: string;
  version:    bigint;
}
