"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OwnedCoretimeRegion } from "@/hooks/useOwnedCoretimeRegions";
import { Button } from "@/components/ui/Button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regions: OwnedCoretimeRegion[];
  isLoading: boolean;
  fetchError: Error | null;
  onPick: (id: bigint) => void;
  onRefresh: () => void;
};

export function RegionPickerModal({
  open,
  onOpenChange,
  regions,
  isLoading,
  fetchError,
  onPick,
  onRefresh,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[min(520px,85vh)] w-full max-w-md flex-col rounded-xl border border-border bg-card shadow-xl"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="region-picker-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="region-picker-title" className="text-sm font-semibold text-foreground">
            Your Coretime regions
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-b border-border/80 px-4 py-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 text-[10px]" onClick={onRefresh}>
            Refresh list
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {fetchError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {fetchError.message}
            </p>
          )}
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Scanning chain for your NFTs…</p>
          )}
          {!isLoading && !fetchError && regions.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground leading-relaxed px-2">
              No regions found for this wallet in the scanned id range. Mint one using the banner above, then
              refresh.
            </p>
          )}
          {!isLoading && regions.length > 0 && (
            <ul className="space-y-2">
              {regions.map((r) => (
                <li key={r.id.toString()}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(r.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "w-full rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-left text-sm",
                      "transition-colors hover:border-primary/50 hover:bg-secondary"
                    )}
                  >
                    <span className="font-mono font-semibold text-primary">#{r.id.toString()}</span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      Region blocks {r.begin.toLocaleString()} → {r.end.toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
