import type { Option } from "@/types/protocol";

const ZERO = "0x0000000000000000000000000000000000000000";

/** Writer listed the option; no holder yet (matches OptionsEngine: holder == address(0)). */
export function optionHasHolder(option: Option): boolean {
  const h = option.holder?.toLowerCase() ?? "";
  return h !== "" && h !== ZERO.toLowerCase();
}

/**
 * OptionsEngine.sol uses status: 0=active (written or purchased), 1=exercised, 2=expired.
 * “Purchased” is holder != 0 while still status 0.
 */
export function getOptionDisplayLabel(option: Option): string {
  if (option.status === 2) return "Expired";
  if (option.status === 1) return "Exercised";
  if (optionHasHolder(option)) return "Purchased";
  return "Open";
}

export function getOptionDisplayColorVar(label: string): string {
  switch (label) {
    case "Open":
      return "var(--green)";
    case "Purchased":
      return "var(--cyan)";
    case "Exercised":
      return "var(--text)";
    case "Expired":
      return "var(--amber)";
    default:
      return "var(--muted)";
  }
}
