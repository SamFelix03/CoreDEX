"use client";
import { Card, CardHeader } from "@/components/ui/Card";
import { useVaultStats } from "@/hooks/useVault";
import { formatPercent, formatRate } from "@/lib/utils";

export function VaultStatsCard() {
  const { stats, isLoading } = useVaultStats();

  return (
    <Card glow>
      <CardHeader label="Yield Vault" />
      <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <StatBox
          label="Total Deposited"
          value={isLoading ? "..." : String(stats?.totalDeposited ?? 0)}
          sub="regions"
          color="var(--green)"
        />
        <StatBox
          label="Total Lent"
          value={isLoading ? "..." : String(stats?.totalLent ?? 0)}
          sub="regions"
          color="var(--cyan)"
        />
        <StatBox
          label="Available"
          value={isLoading ? "..." : String(stats?.availableRegions ?? 0)}
          sub="regions"
          color="var(--text)"
        />
        <StatBox
          label="Utilisation"
          value={isLoading ? "..." : formatPercent(stats?.utilisationRate ?? 0n)}
          color="var(--amber)"
        />
        <StatBox
          label="Lending Rate"
          value={isLoading ? "..." : formatRate(stats?.lendingRate ?? 0n)}
          color="var(--pink)"
        />
        <StatBox
          label="Current Epoch"
          value={isLoading ? "..." : String(stats?.currentEpoch ?? 0)}
          color="var(--muted)"
        />
      </div>
    </Card>
  );
}

function StatBox({ label, value, sub, color = "var(--text)" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 3, padding: "10px 12px" }}>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 18, color }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
