"use client";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAccount } from "wagmi";
import { useOptionsData, useOption, useBuyOption, useExerciseOption } from "@/hooks/useOptions";
import { formatDOT, truncateAddress, OPTION_STATUS_LABELS, OPTION_STATUS_COLORS } from "@/lib/utils";

function OptionRow({ optionId }: { optionId: bigint }) {
  const { option, isLoading } = useOption(optionId);
  const { address } = useAccount();
  const { buyOption, isPending: buyPending } = useBuyOption();
  const { exercise, isPending: exercisePending } = useExerciseOption();

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
        <div className="flex gap-2">
          {option.status === 0 && !isWriter && (
            <Button size="sm" onClick={() => buyOption(option.optionId)} loading={buyPending}>
              Buy
            </Button>
          )}
          {option.status === 1 && isHolder && (
            <Button size="sm" variant="outline" onClick={() => exercise(option.optionId)} loading={exercisePending}>
              Exercise
            </Button>
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
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
