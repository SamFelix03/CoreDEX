"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAccount } from "wagmi";
import { cn } from "@/lib/utils";
import { useOwnedCoretimeRegions } from "@/hooks/useOwnedCoretimeRegions";
import { RegionPickerModal } from "./RegionPickerModal";

type Props = {
  label?: string;
  /** String so empty state works with form state */
  value: string;
  onChange: (regionId: string) => void;
  disabled?: boolean;
  helperText?: string;
};

export function RegionSelectorField({
  label = "Coretime region",
  value,
  onChange,
  disabled,
  helperText,
}: Props) {
  const [open, setOpen] = useState(false);
  const { isConnected } = useAccount();
  const { data: regions = [], isLoading, isFetching, error, refetch } = useOwnedCoretimeRegions();
  const loading = isLoading || isFetching;

  useEffect(() => {
    if (open) void refetch();
  }, [open, refetch]);

  const display =
    value?.trim() !== ""
      ? `Region #${value}`
      : isConnected
        ? "Choose a region…"
        : "Connect wallet first";

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[10px] font-mono font-normal text-white uppercase tracking-[0.5px]">
          {label}
        </span>
      )}
      <button
        type="button"
        disabled={disabled || !isConnected}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg bg-black px-4 py-2.5 text-left text-sm text-white",
          "focus:outline-none focus:ring-2 focus:ring-white/20 transition-all",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-white/50"
        )}
      >
        <span className="truncate font-mono">{display}</span>
        <ChevronDown className="size-4 shrink-0 text-white/50" />
      </button>
      {value?.trim() !== "" && !disabled && (
        <button
          type="button"
          className="self-start text-[10px] text-muted-foreground underline hover:text-foreground"
          onClick={() => onChange("")}
        >
          Clear selection
        </button>
      )}
      {helperText && <p className="text-[10px] text-muted-foreground leading-relaxed">{helperText}</p>}
      {!isConnected && (
        <p className="text-[10px] text-amber-200/90">Connect your wallet to load regions you own.</p>
      )}

      <RegionPickerModal
        open={open}
        onOpenChange={setOpen}
        regions={regions}
        isLoading={loading && regions.length === 0}
        fetchError={error as Error | null}
        onPick={(id) => onChange(id.toString())}
        onRefresh={() => refetch()}
      />
    </div>
  );
}
