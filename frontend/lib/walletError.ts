/**
 * Surfaces viem / wagmi write errors (including custom revert data when the node returns it).
 * Note: `gasUsed` tiny (~0x500) + empty `revertReason` often means **wrong function selector** (bad ABI),
 * not "out of gas" — OOG usually uses most of the supplied gas.
 */
export function formatTransactionError(err: unknown, maxLen = 400): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err.slice(0, maxLen);

  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    const parts: string[] = [];

    if (typeof o.shortMessage === "string") parts.push(o.shortMessage);
    if (typeof o.details === "string" && o.details !== o.shortMessage) parts.push(o.details);
    if (typeof o.message === "string" && !parts.includes(o.message)) parts.push(o.message);

    const cause = o.cause;
    if (cause && typeof cause === "object") {
      const c = cause as Record<string, unknown>;
      if (typeof c.shortMessage === "string") parts.push(`Cause: ${c.shortMessage}`);
      if (typeof c.message === "string" && c.message !== c.shortMessage) parts.push(String(c.message));
      if (typeof c.data === "string" && c.data !== "0x") parts.push(`data: ${c.data.slice(0, 66)}…`);
    }

    const merged = parts.filter(Boolean).join(" — ");
    if (merged) return merged.slice(0, maxLen);
  }

  if (err instanceof Error) return err.message.slice(0, maxLen);
  return String(err).slice(0, maxLen);
}
