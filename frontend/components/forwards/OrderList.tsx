"use client";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAccount } from "wagmi";
import { useForwardOrders, useForwardOrder, useMatchOrder, useCancelOrder, useSettleForward } from "@/hooks/useForwardOrders";
import { formatDOT, truncateAddress, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/utils";

function OrderRow({ orderId }: { orderId: bigint }) {
  const { order, isLoading } = useForwardOrder(orderId);
  const { address } = useAccount();
  const { matchOrder, isPending: matchPending } = useMatchOrder();
  const { cancel, isPending: cancelPending } = useCancelOrder();
  const { settle, isPending: settlePending } = useSettleForward();

  if (isLoading || !order) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-3 text-sm text-muted-foreground">
          Loading…
        </td>
      </tr>
    );
  }

  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? "Unknown";
  const statusColor = ORDER_STATUS_COLORS[statusLabel] ?? "var(--muted)";
  const isSeller = address?.toLowerCase() === order.seller.toLowerCase();
  const isBuyer  = address?.toLowerCase() === order.buyer.toLowerCase();

  return (
    <tr className="border-b border-border transition-colors hover:bg-secondary/30">
      <td className="px-4 py-3 text-sm text-foreground">#{String(order.orderId)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{String(order.regionId)}</td>
      <td className="px-4 py-3 text-sm text-primary">{formatDOT(order.strikePriceDOT)} DOT</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{truncateAddress(order.seller)}</td>
      <td className="px-4 py-3">
        <Badge label={statusLabel} color={statusColor} />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          {order.status === 0 && !isSeller && (
            <Button size="sm" onClick={() => matchOrder(order.orderId)} loading={matchPending}>
              Match
            </Button>
          )}
          {order.status === 0 && isSeller && (
            <Button size="sm" variant="ghost" onClick={() => cancel(order.orderId)} loading={cancelPending}>
              Cancel
            </Button>
          )}
          {order.status === 1 && (isSeller || isBuyer) && (
            <Button size="sm" variant="outline" onClick={() => settle(order.orderId)} loading={settlePending}>
              Settle
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function OrderList() {
  const { address } = useAccount();
  const { sellerOrderIds, buyerOrderIds } = useForwardOrders(address);

  const allOrderIds = [
    ...(sellerOrderIds ?? []),
    ...(buyerOrderIds ?? []),
  ].filter((v, i, a) => a.findIndex(x => x === v) === i);

  return (
    <Card className="animate-slide-in-up p-0 overflow-hidden">
      <CardHeader label="Your Forward Orders" />
      {allOrderIds.length === 0 ? (
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {address ? "No forward orders found" : "Connect wallet to view orders"}
          </p>
        </CardContent>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {["Order", "Region", "Strike", "Seller", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allOrderIds.map((id) => (
                <OrderRow key={String(id)} orderId={id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
