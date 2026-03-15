"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { useVaultStats } from "@/hooks/useVault";
import { formatPercent, formatRate } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const VAULT_STATS = [
  { label: "Total Deposited", key: "totalDeposited", sub: "regions", isPrimary: true },
  { label: "Total Lent", key: "totalLent", sub: "regions", isPrimary: false },
  { label: "Available", key: "availableRegions", sub: "regions", isPrimary: false },
  { label: "Utilisation", key: "utilisation", isPrimary: false },
  { label: "Lending Rate", key: "lendingRate", isPrimary: false },
  { label: "Current Epoch", key: "currentEpoch", isPrimary: false },
];

export function VaultStatsCard() {
  const { stats, isLoading } = useVaultStats();
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const values: Record<string, string> = {
    totalDeposited: isLoading ? "…" : String(stats?.totalDeposited ?? 0),
    totalLent: isLoading ? "…" : String(stats?.totalLent ?? 0),
    availableRegions: isLoading ? "…" : String(stats?.availableRegions ?? 0),
    utilisation: isLoading ? "…" : formatPercent(stats?.utilisationRate ?? 0n),
    lendingRate: isLoading ? "…" : formatRate(stats?.lendingRate ?? 0n),
    currentEpoch: isLoading ? "…" : String(stats?.currentEpoch ?? 0),
  };

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader label="Yield Vault" />
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {VAULT_STATS.map((item, index) => (
            <div
              key={item.key}
              onMouseEnter={() => setHoveredCard(index)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{ animationDelay: `${index * 80}ms` }}
              className={cn(
                "rounded-xl border border-border p-5 transition-all duration-500 animate-slide-in-up cursor-pointer",
                item.isPrimary
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-card-foreground shadow-md",
                hoveredCard === index && "scale-[1.02] shadow-xl"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xs font-medium opacity-90 uppercase tracking-wider">
                  {item.label}
                </h3>
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center transition-transform duration-300",
                    item.isPrimary ? "bg-primary-foreground/20" : "bg-primary/20",
                    hoveredCard === index && "rotate-45"
                  )}
                >
                  <ArrowUpRight
                    className={cn(
                      "size-3.5",
                      item.isPrimary ? "text-primary-foreground" : "text-primary"
                    )}
                  />
                </div>
              </div>
              <p className="text-2xl font-bold mb-1">{values[item.key]}</p>
              {"sub" in item && item.sub && (
                <p className="text-xs opacity-80">{item.sub}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
