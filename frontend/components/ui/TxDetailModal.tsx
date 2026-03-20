"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useChainId } from "wagmi";
import { getAddressExplorerUrl, getTxExplorerUrl } from "@/lib/explorer";
import { Button } from "@/components/ui/Button";

export type TxDetailRow = {
  label: string;
  /** Plain text or short JSX */
  value: ReactNode;
  /** Smaller secondary line (e.g. explanation) */
  hint?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One-line summary under the title */
  subtitle?: ReactNode;
  txHash: `0x${string}`;
  rows: TxDetailRow[];
  /** Contract the tx called (label + address) */
  contract?: { label: string; address: `0x${string}` };
  /** Solidity function name for display */
  functionName?: string;
  /** Extra on-chain / UX note at the bottom */
  footnote?: string;
};

/**
 * Dialog showing successful tx hash, explorer link, and structured on-chain context.
 */
export function TxDetailModal({
  open,
  onClose,
  title,
  subtitle,
  txHash,
  rows,
  contract,
  functionName,
  footnote,
}: Props) {
  const chainId = useChainId();
  const txUrl = getTxExplorerUrl(chainId, txHash);
  const contractUrl = contract ? getAddressExplorerUrl(chainId, contract.address) : null;

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tx-detail-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-[101] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-xl">
        <div className="border-b border-border px-5 py-4">
          <h2 id="tx-detail-modal-title" className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          {contract ? (
            <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Contract
              </div>
              <div className="text-foreground font-medium">{contract.label}</div>
              <div className="font-mono text-[11px] break-all text-primary">
                {contractUrl ? (
                  <a href={contractUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {contract.address}
                  </a>
                ) : (
                  contract.address
                )}
              </div>
              {functionName ? (
                <div className="text-xs text-muted-foreground pt-1">
                  Function: <code className="text-foreground">{functionName}</code>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-green-500/25 bg-green-500/5 px-3 py-2 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Transaction
            </div>
            <div className="font-mono text-[11px] break-all text-foreground">{txHash}</div>
            {txUrl ? (
              <a
                href={txUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-primary underline font-medium"
              >
                View on block explorer ↗
              </a>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Set <code className="text-foreground">NEXT_PUBLIC_TX_EXPLORER_BASE</code> for your chain to
                enable links.
              </p>
            )}
          </div>

          <dl className="space-y-3">
            {rows.map((row) => (
              <div key={row.label}>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="mt-0.5 text-foreground break-words">{row.value}</dd>
                {row.hint ? <dd className="mt-1 text-xs text-muted-foreground">{row.hint}</dd> : null}
              </div>
            ))}
          </dl>

          {footnote ? <p className="text-xs text-muted-foreground border-t border-border pt-3">{footnote}</p> : null}
        </div>

        <div className="border-t border-border px-5 py-3 flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
