"use client";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useProtocolStatus } from "@/hooks/useProtocolStatus";
import { useVaultStats } from "@/hooks/useVault";
import { useLedgerStats } from "@/hooks/useLedger";
import { useAccount } from "wagmi";
import { truncateAddress } from "@/lib/utils";

export function ProtocolOverview() {
  const { address } = useAccount();
  const { paused, governance, version, isLoading: statusLoading } = useProtocolStatus();
  const { stats, isLoading: vaultLoading } = useVaultStats();
  const { totalLockEvents, marginBalance, openPositionCount, isLoading: ledgerLoading } = useLedgerStats(address);

  const isLoading = statusLoading || vaultLoading || ledgerLoading;

  return (
    <Card>
      <CardHeader
        label="Protocol Overview"
        right={
          paused !== undefined && (
            <Badge
              label={paused ? "Paused" : "Active"}
              color={paused ? "var(--red)" : "var(--green)"}
            />
          )
        }
      />
      <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatBox label="Registry Version" value={isLoading ? "…" : String(version ?? 0)} />
        <StatBox label="Governance" value={isLoading ? "…" : truncateAddress(governance ?? "")} color="var(--cyan)" />
        <StatBox label="Total Locks" value={isLoading ? "…" : String(totalLockEvents)} />
        <StatBox label="Vault Deposits" value={isLoading ? "…" : String(stats?.totalDeposited ?? 0)} />
        <StatBox label="Vault Lent" value={isLoading ? "…" : String(stats?.totalLent ?? 0)} />
        <StatBox label="Available Regions" value={isLoading ? "…" : String(stats?.availableRegions ?? 0)} color="var(--green)" />
        <StatBox label="Your Positions" value={isLoading ? "…" : String(openPositionCount)} color="var(--pink)" />
        <StatBox label="Your Margin" value={isLoading ? "…" : String(marginBalance) + " wei"} />
      </div>
    </Card>
  );
}

function StatBox({ label, value, color = "var(--text)" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 3, padding: "10px 12px" }}>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, color }}>
        {value}
      </div>
    </div>
  );
}
