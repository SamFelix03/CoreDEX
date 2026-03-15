"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAccount } from "wagmi";
import { useForwardOrders } from "@/hooks/useForwardOrders";
import { useOptionsData } from "@/hooks/useOptions";
import { useVaultDeposits } from "@/hooks/useVault";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

function PositionCard({
  href,
  title,
  badgeLabel,
  badgeColor,
  value,
  sub,
  delay,
}: {
  href: string;
  title: string;
  badgeLabel: string;
  badgeColor: string;
  value: number;
  sub: string;
  delay: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href} className="block">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ animationDelay: delay }}
        className={cn(
          "rounded-xl border border-border bg-card p-5 shadow-lg transition-all duration-500 animate-slide-in-up cursor-pointer",
          hovered && "scale-[1.02] shadow-xl"
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          <div
            className={cn(
              "size-6 rounded-full bg-primary/20 flex items-center justify-center transition-transform duration-300",
              hovered && "rotate-45"
            )}
          >
            <ArrowUpRight className="size-3.5 text-primary" />
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground mb-1">{value}</p>
        <div className="flex items-center gap-2">
          <Badge label={badgeLabel} color={badgeColor} />
          <span className="text-xs text-muted-foreground">{sub}</span>
        </div>
      </div>
    </Link>
  );
}

export function UserPositions() {
  const { address } = useAccount();
  const { sellerOrderIds, buyerOrderIds } = useForwardOrders(address);
  const { writerOptionIds, holderOptionIds } = useOptionsData(address);
  const { receiptIds } = useVaultDeposits(address);

  if (!address) {
    return (
      <Card>
        <CardHeader label="Your Positions" />
        <div className="p-8 text-center animate-fade-in">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to view positions
          </p>
        </div>
      </Card>
    );
  }

  const forwardsTotal = (sellerOrderIds?.length ?? 0) + (buyerOrderIds?.length ?? 0);
  const optionsTotal = (writerOptionIds?.length ?? 0) + (holderOptionIds?.length ?? 0);

  return (
    <Card className="p-0 overflow-hidden">
      <CardHeader label="Your Positions" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6">
        <PositionCard
          href="/forwards"
          title="Forwards"
          badgeLabel="Sell/Buy"
          badgeColor="var(--cyan)"
          value={forwardsTotal}
          sub={`${sellerOrderIds?.length ?? 0} selling · ${buyerOrderIds?.length ?? 0} buying`}
          delay="0ms"
        />
        <PositionCard
          href="/options"
          title="Options"
          badgeLabel="Write/Hold"
          badgeColor="var(--pink)"
          value={optionsTotal}
          sub={`${writerOptionIds?.length ?? 0} written · ${holderOptionIds?.length ?? 0} held`}
          delay="100ms"
        />
        <PositionCard
          href="/vault"
          title="Vault"
          badgeLabel="Deposits"
          badgeColor="var(--green)"
          value={receiptIds?.length ?? 0}
          sub="active deposits"
          delay="200ms"
        />
      </div>
    </Card>
  );
}
