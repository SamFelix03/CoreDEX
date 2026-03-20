"use client";

import { ArrowUpRight, TrendingUp } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useProtocolStatus } from "@/hooks/useProtocolStatus";
import { useVaultStats } from "@/hooks/useVault";
import { useLedgerStats } from "@/hooks/useLedger";
import { useAccount } from "wagmi";
import { cn, formatGweiCompact, formatGweiWithCommas, truncateAddress } from "@/lib/utils";
import { useState } from "react";

const statsConfig = [
  { title: "Registry Version", key: "version", isPrimary: true },
  { title: "Governance", key: "governance", isPrimary: false },
  { title: "Total Locks", key: "totalLocks", isPrimary: false },
  { title: "Vault Deposits", key: "vaultDeposits", isPrimary: false },
  { title: "Vault Lent", key: "vaultLent", isPrimary: false },
  { title: "Available Regions", key: "availableRegions", isPrimary: false },
  { title: "Your Positions", key: "yourPositions", isPrimary: false },
  { title: "Your Margin", key: "yourMargin", isPrimary: false },
];

export function ProtocolOverview() {
  const { address } = useAccount();
  const { paused, governance, version, isLoading: statusLoading } = useProtocolStatus();
  const { stats, isLoading: vaultLoading } = useVaultStats();
  const { totalLockEvents, marginBalance, openPositionCount, isLoading: ledgerLoading } = useLedgerStats(address);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const isLoading = statusLoading || vaultLoading || ledgerLoading;

  const compactYourMargin = isLoading ? "" : formatGweiCompact(marginBalance);
  const fullYourMargin = isLoading ? "" : formatGweiWithCommas(marginBalance);

  const values: Record<string, string> = {
    version: isLoading ? "…" : String(version ?? 0),
    governance: isLoading ? "…" : truncateAddress(governance ?? ""),
    totalLocks: isLoading ? "…" : String(totalLockEvents),
    vaultDeposits: isLoading ? "…" : String(stats?.totalDeposited ?? 0),
    vaultLent: isLoading ? "…" : String(stats?.totalLent ?? 0),
    availableRegions: isLoading ? "…" : String(stats?.availableRegions ?? 0),
    yourPositions: isLoading ? "…" : String(openPositionCount),
    yourMargin: isLoading ? "…" : `${compactYourMargin} gwei`,
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
          {statsConfig.map((stat, index) => (
            <div
              key={stat.key}
              onMouseEnter={() => setHoveredCard(index)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{ animationDelay: `${index * 80}ms` }}
              className={cn(
                "rounded-xl border border-border p-5 transition-all duration-500 ease-out animate-slide-in-up cursor-pointer",
                stat.isPrimary
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-card-foreground shadow-md",
                hoveredCard === index ? "scale-[1.02] shadow-xl" : ""
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xs font-medium opacity-90 uppercase tracking-wider">
                  {stat.title}
                </h3>
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center transition-transform duration-300",
                    stat.isPrimary ? "bg-primary-foreground/20" : "bg-primary/20",
                    hoveredCard === index && "rotate-45"
                  )}
                >
                  <ArrowUpRight
                    className={cn(
                      "size-3.5",
                      stat.isPrimary ? "text-primary-foreground" : "text-primary"
                    )}
                  />
                </div>
              </div>
              <p
                className="text-2xl font-bold mb-1 tabular-nums min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                title={
                  stat.key === "yourMargin" && !isLoading
                    ? `${fullYourMargin} gwei`
                    : undefined
                }
              >
                {values[stat.key]}
              </p>
              <div className="flex items-center gap-1.5 text-xs opacity-80">
                <TrendingUp className="size-3" />
                <span>Protocol stats</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
