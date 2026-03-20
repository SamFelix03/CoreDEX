"use client";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAccount } from "wagmi";
import { useOptionsData, useOption, useBuyOption, useExerciseOption } from "@/hooks/useOptions";
import { formatDOT, truncateAddress, OPTION_STATUS_LABELS, OPTION_STATUS_COLORS } from "@/lib/utils";
import { TxSuccessWithExplorer } from "@/components/ui/TxSuccessWithExplorer";

function OptionRow({ optionId }: { optionId: bigint }) {
  const { option, isLoading } = useOption(optionId);
  const { address } = useAccount();
  const {
    buyOption,
    isWritePending: buyWritePending,
    isConfirming: buyConfirming,
    isSuccess: buyOk,
    hash: buyHash,
    reset: resetBuy,
  } = useBuyOption();
  const {
    exercise,
    isWritePending: exerciseWritePending,
    isConfirming: exerciseConfirming,
    isSuccess: exerciseOk,
    hash: exerciseHash,
    reset: resetExercise,
  } = useExerciseOption();

  const successHash = buyOk && buyHash ? buyHash : exerciseOk && exerciseHash ? exerciseHash : null;
  const successLabel = buyOk ? "Option purchased." : exerciseOk ? "Exercise submitted." : null;

  if (isLoading || !option) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3 text-sm text-muted-foreground">
          Loading…
        </td>
      </tr>
    );
  }

  const statusLabel = OPTION_STATUS_LABELS[option.status] ?? "Unknown";
  const statusColor = OPTION_STATUS_COLORS[statusLabel] ?? "var(--muted)";
  const isWriter = address?.toLowerCase() === option.writer.toLowerCase();
  const isHolder = address?.toLowerCase() === option.holder.toLowerCase();

  return (
    <tr className="border-b border-border transition-colors hover:bg-secondary/30">
      <td className="px-4 py-3 text-sm text-foreground">#{String(option.optionId)}</td>
      <td className="px-4 py-3">
        <Badge
          label={option.optionType === 0 ? "Call" : "Put"}
          color={option.optionType === 0 ? "var(--cyan)" : "var(--pink)"}
        />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{String(option.coretimeRegion)}</td>
      <td className="px-4 py-3 text-sm text-primary">{formatDOT(option.strikePriceDOT)} DOT</td>
      <td className="px-4 py-3 text-sm text-primary">{formatDOT(option.premiumDOT)} DOT</td>
      <td className="px-4 py-3">
        <Badge label={statusLabel} color={statusColor} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2 max-w-[200px]">
          <div className="flex flex-wrap gap-2">
            {option.status === 0 && !isWriter && (
              <Button
                size="sm"
                onClick={() => {
                  resetExercise();
                  resetBuy();
                  void buyOption(option.optionId);
                }}
                loading={buyWritePending}
                disabled={buyWritePending || buyConfirming}
                title={buyConfirming && !buyWritePending ? "Waiting for block confirmation…" : undefined}
              >
                {buyConfirming && !buyWritePending ? "Confirming…" : "Buy"}
              </Button>
            )}
            {option.status === 1 && isHolder && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetBuy();
                  resetExercise();
                  void exercise(option.optionId);
                }}
                loading={exerciseWritePending}
                disabled={exerciseWritePending || exerciseConfirming}
                title={
                  exerciseConfirming && !exerciseWritePending
                    ? "Waiting for block confirmation…"
                    : undefined
                }
              >
                {exerciseConfirming && !exerciseWritePending ? "Confirming…" : "Exercise"}
              </Button>
            )}
          </div>
          {successHash && successLabel && (
            <TxSuccessWithExplorer hash={successHash} className="!p-2 !text-[10px]">
              <span>{successLabel}</span>
            </TxSuccessWithExplorer>
          )}
        </div>
      </td>
    </tr>
  );
}

export function OptionList() {
  const { address } = useAccount();
  const { writerOptionIds, holderOptionIds } = useOptionsData(address);

  const allOptionIds = [
    ...(writerOptionIds ?? []),
    ...(holderOptionIds ?? []),
  ].filter((v, i, a) => a.findIndex(x => x === v) === i);

  return (
    <Card className="animate-slide-in-up p-0 overflow-hidden">
      <CardHeader label="Your Options" />
      {allOptionIds.length === 0 ? (
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {address ? "No options found" : "Connect wallet to view options"}
          </p>
        </CardContent>
      ) : (
        <div className="max-h-[420px] overflow-auto overscroll-contain">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-secondary/95 backdrop-blur">
                {["Option", "Type", "Region", "Strike", "Premium", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allOptionIds.map((id) => (
                <OptionRow key={String(id)} optionId={id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
