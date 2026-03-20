"use client";

import { format, addMinutes } from "date-fns";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  estimatedBlock: bigint | null;
  estimateError: string | null;
  isLoadingHead: boolean;
  latestBlockNumber?: bigint | null;
  /** When false, omit the estimated block line (e.g. vault borrow only sends duration blocks). */
  showEstimatedBlockLine?: boolean;
};

export function FutureRelayTimeInput({
  label,
  description,
  value,
  onChange,
  disabled,
  estimatedBlock,
  estimateError,
  isLoadingHead,
  latestBlockNumber,
  showEstimatedBlockLine = true,
}: Props) {
  const minLocal = format(addMinutes(new Date(), 2), "yyyy-MM-dd'T'HH:mm");

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-mono font-normal text-white uppercase tracking-[0.5px]">
        {label}
      </label>
      <input
        type="datetime-local"
        min={minLocal}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex h-10 w-full rounded-lg border-0 bg-black px-4 py-2.5 text-sm text-white",
          "placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      />
      {description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}
      {isLoadingHead && (
        <p className="text-xs text-muted-foreground">Reading chain head…</p>
      )}
      {showEstimatedBlockLine &&
        !isLoadingHead &&
        value?.trim() &&
        estimatedBlock !== null &&
        !estimateError && (
        <p className="text-xs text-white/80">
          <span className="text-muted-foreground">Block sent to contract:</span>{" "}
          <span className="font-mono font-semibold text-primary">{estimatedBlock.toString()}</span>
          {latestBlockNumber !== null && latestBlockNumber !== undefined && (
            <span className="text-muted-foreground">
              {" "}
              (head ~{latestBlockNumber.toString()})
            </span>
          )}
        </p>
      )}
      {estimateError && (
        <p className="text-xs text-destructive">{estimateError}</p>
      )}
    </div>
  );
}
