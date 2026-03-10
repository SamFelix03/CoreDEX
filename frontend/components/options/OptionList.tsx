"use client";
import { Card, CardHeader } from "@/components/ui/Card";
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
        <td colSpan={7} style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--muted)" }}>
          Loading...
        </td>
      </tr>
    );
  }

  const statusLabel = OPTION_STATUS_LABELS[option.status] ?? "Unknown";
  const statusColor = OPTION_STATUS_COLORS[statusLabel] ?? "var(--muted)";
  const isWriter = address?.toLowerCase() === option.writer.toLowerCase();
  const isHolder = address?.toLowerCase() === option.holder.toLowerCase();

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--text)" }}>
        #{String(option.optionId)}
      </td>
      <td style={{ padding: "8px 12px" }}>
        <Badge
          label={option.optionType === 0 ? "Call" : "Put"}
          color={option.optionType === 0 ? "var(--cyan)" : "var(--pink)"}
        />
      </td>
      <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--muted)" }}>
        {String(option.coretimeRegion)}
      </td>
      <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--cyan)" }}>
        {formatDOT(option.strikePriceDOT)} DOT
      </td>
      <td style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "var(--pink)" }}>
        {formatDOT(option.premiumDOT)} DOT
      </td>
      <td style={{ padding: "8px 12px" }}>
        <Badge label={statusLabel} color={statusColor} />
      </td>
      <td style={{ padding: "8px 12px", display: "flex", gap: 4 }}>
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
    <Card>
      <CardHeader label="Your Options" />
      {allOptionIds.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "var(--muted)" }}>
            {address ? "No options found" : "Connect wallet to view options"}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Option", "Type", "Region", "Strike", "Premium", "Status", "Actions"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "left" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allOptionIds.map(id => (
                <OptionRow key={String(id)} optionId={id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
