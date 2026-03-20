import type { ForwardOrder, Option, OrderStatus, OptionStatus, OptionType } from "@/types/protocol";

function toBig(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string" && /^-?\d+$/.test(v)) return BigInt(v);
  return 0n;
}

function toAddr(v: unknown): `0x${string}` | string {
  if (typeof v === "string" && v.startsWith("0x")) return v as `0x${string}`;
  return String(v ?? "");
}

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v.length > 0) return Number(v);
  return NaN;
}

/**
 * `readContract` for `ForwardMarket.orders(id)` returns either a positional array or a named object
 * (viem ABI-decoded struct). Indexing `d[0]` only works for arrays — named objects broke Match UI.
 */
export function parseForwardOrderRead(data: unknown): ForwardOrder | undefined {
  if (data == null) return undefined;

  if (Array.isArray(data)) {
    const d = data;
    return {
      orderId:        toBig(d[0]),
      seller:         toAddr(d[1]),
      buyer:          toAddr(d[2]),
      regionId:       toBig(d[3]),
      strikePriceDOT: toBig(d[4]),
      deliveryBlock:  toBig(d[5]),
      createdBlock:   toBig(d[6]),
      status:         toNum(d[7]) as OrderStatus,
    };
  }

  if (typeof data === "object") {
    const r = data as Record<string, unknown>;
    return {
      orderId:        toBig(r.orderId),
      seller:         toAddr(r.seller),
      buyer:          toAddr(r.buyer),
      regionId:       toBig(r.coretimeRegion),
      strikePriceDOT: toBig(r.strikePriceDOT),
      deliveryBlock:  toBig(r.deliveryBlock),
      createdBlock:   toBig(r.createdBlock),
      status:         toNum(r.status) as OrderStatus,
    };
  }

  return undefined;
}

/** `OptionsEngine.options(id)` — same array vs named-object issue as forwards. */
export function parseOptionRead(data: unknown): Option | undefined {
  if (data == null) return undefined;

  if (Array.isArray(data)) {
    const d = data;
    return {
      optionId:       toBig(d[0]),
      writer:         toAddr(d[1]),
      holder:         toAddr(d[2]),
      coretimeRegion: toBig(d[3]),
      strikePriceDOT: toBig(d[4]),
      premiumDOT:     toBig(d[5]),
      expiryBlock:    toBig(d[6]),
      optionType:     toNum(d[7]) as OptionType,
      status:         toNum(d[8]) as OptionStatus,
    };
  }

  if (typeof data === "object") {
    const r = data as Record<string, unknown>;
    return {
      optionId:       toBig(r.optionId),
      writer:         toAddr(r.writer),
      holder:         toAddr(r.holder),
      coretimeRegion: toBig(r.coretimeRegion),
      strikePriceDOT: toBig(r.strikePriceDOT),
      premiumDOT:     toBig(r.premiumDOT),
      expiryBlock:    toBig(r.expiryBlock),
      optionType:     toNum(r.optionType) as OptionType,
      status:         toNum(r.status) as OptionStatus,
    };
  }

  return undefined;
}
