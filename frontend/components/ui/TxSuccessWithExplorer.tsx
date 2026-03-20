"use client";

import type { ReactNode } from "react";
import { useChainId } from "wagmi";
import { getTxExplorerUrl } from "@/lib/explorer";

type Props = {
  children: ReactNode;
  /** Latest successful transaction hash from wagmi `useWriteContract`. */
  hash?: `0x${string}` | null;
  className?: string;
};

/**
 * Success callout with an explorer link when the active chain has a known Subscan base.
 */
export function TxSuccessWithExplorer({ children, hash, className }: Props) {
  const chainId = useChainId();
  const url = hash ? getTxExplorerUrl(chainId, hash) : null;

  return (
    <div
      className={
        className ??
        "rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-xs text-green-400 animate-slide-in-up space-y-2"
      }
    >
      <div>{children}</div>
      {hash && (
        <div className="flex flex-col gap-1">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline font-mono text-[11px] break-all hover:opacity-90"
            >
              View transaction on explorer ↗
            </a>
          ) : (
            <span className="font-mono text-[10px] text-green-400/80 break-all">Tx: {hash}</span>
          )}
        </div>
      )}
    </div>
  );
}
