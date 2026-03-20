import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatUnits, parseUnits } from "viem";
import { DOT_DECIMALS, RELAY_BLOCK_TIME_SECONDS } from "@/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── DOT Formatting ─────────────────────────────────────────────────────────

export function formatDOT(value: bigint, digits = 4): string {
  const formatted = formatUnits(value, DOT_DECIMALS);
  const num = parseFloat(formatted);
  if (num === 0) return "0";
  if (num < 0.0001) return "< 0.0001";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDOTCompact(value: bigint): string {
  const num = parseFloat(formatUnits(value, DOT_DECIMALS));
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(2)}K`;
  return num.toFixed(2);
}

// ─── Gwei Formatting ─────────────────────────────────────────────────────────
//
// `marginBalance` is treated as a raw integer "gwei" value in the UI.
// We avoid JS `Number` math here so very large on-chain values don't overflow.
export function formatGweiWithCommas(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const s = abs.toString();
  const withCommas = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sign + withCommas;
}

export function formatGweiCompact(value: bigint, fractionDigits = 2): string {
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  if (abs === 0n) return "0";

  const s = abs.toString();
  const digits = s.length;

  // 10^3 buckets.
  const suffixes = ["", "K", "M", "B", "T", "P", "E"] as const;
  const groups = Math.floor((digits - 1) / 3);
  if (groups <= 0) return formatGweiWithCommas(value);

  const suffix = suffixes[Math.min(groups, suffixes.length - 1)];
  const firstChunkLen = digits - groups * 3; // 1..3
  const firstChunk = s.slice(0, firstChunkLen);
  const remainderDigits = s.slice(firstChunkLen);

  const frac = fractionDigits > 0 ? remainderDigits.slice(0, fractionDigits) : "";
  if (!frac || /^0+$/.test(frac)) return sign + firstChunk + suffix;

  // Trim trailing zeros from truncated fraction for cleaner output.
  const fracTrimmed = frac.replace(/0+$/, "");
  return sign + firstChunk + "." + fracTrimmed + suffix;
}

/** Trim trailing zeros for HTML number inputs (strike, etc.). */
export function dotWeiToInputString(wei: bigint): string {
  const s = formatUnits(wei, DOT_DECIMALS);
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "") || "0";
}

export function parseDOT(value: string): bigint {
  try { return parseUnits(value, DOT_DECIMALS); }
  catch { return 0n; }
}

// ─── Percentages ────────────────────────────────────────────────────────────

export function formatPercent(value: bigint, precision = 18, digits = 2): string {
  const num = parseFloat(formatUnits(value, precision)) * 100;
  return num.toFixed(digits) + "%";
}

export function formatRate(value: bigint, precision = 18, digits = 4): string {
  return parseFloat(formatUnits(value, precision)).toFixed(digits);
}

// ─── Block Numbers ──────────────────────────────────────────────────────────

export function blocksToTime(blocks: bigint): string {
  const seconds = Number(blocks) * RELAY_BLOCK_TIME_SECONDS;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}d ${hours}h`;
}

export function blocksRemaining(targetBlock: bigint, currentBlock: bigint): bigint {
  return targetBlock > currentBlock ? targetBlock - currentBlock : 0n;
}

// ─── Address ────────────────────────────────────────────────────────────────

export function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function isZeroAddress(addr: string): boolean {
  return !addr || addr === "0x" || addr === "0x0000000000000000000000000000000000000000";
}

// ─── Status Labels ──────────────────────────────────────────────────────────

export const ORDER_STATUS_LABELS = ["Open", "Matched", "Settled", "Cancelled", "Expired"] as const;
export const OPTION_STATUS_LABELS = ["Active", "Purchased", "Exercised", "Expired"] as const;
export const SETTLEMENT_STATUS_LABELS = ["None", "Pending", "Confirmed", "Failed"] as const;

export const ORDER_STATUS_COLORS: Record<string, string> = {
  Open: "var(--green)", Matched: "var(--cyan)", Settled: "var(--text)",
  Cancelled: "var(--muted)", Expired: "var(--amber)",
};

export const OPTION_STATUS_COLORS: Record<string, string> = {
  Active: "var(--green)", Purchased: "var(--cyan)", Exercised: "var(--text)", Expired: "var(--amber)",
};
