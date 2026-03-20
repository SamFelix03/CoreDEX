"use client";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAccount } from "wagmi";
import { useForwardOrders, useForwardOrder, useMatchOrder, useCancelOrder, useSettleForward } from "@/hooks/useForwardOrders";
import { formatDOT, truncateAddress, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/utils";
import { TxSuccessWithExplorer } from "@/components/ui/TxSuccessWithExplorer";

function OrderRow({ orderId }: { orderId: bigint }) {
  const { order, isLoading } = useForwardOrder(orderId);
  const { address } = useAccount();
  const { matchOrder, isPending: matchPending, isSuccess: matchOk, hash: matchHash, reset: resetMatch } =
    useMatchOrder();
  const { cancel, isPending: cancelPending, isSuccess: cancelOk, hash: cancelHash, reset: resetCancel } =
    useCancelOrder();
  const { settle, isPending: settlePending, isSuccess: settleOk, hash: settleHash, reset: resetSettle } =
    useSettleForward();

  const successHash =
    matchOk && matchHash ? matchHash : cancelOk && cancelHash ? cancelHash : settleOk && settleHash ? settleHash : null;
  const successLabel = matchOk ? "Order matched." : cancelOk ? "Order cancelled." : settleOk ? "Settlement submitted." : null;

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
        <div className="flex flex-col gap-2 max-w-[220px]">
          <div className="flex flex-wrap gap-2">
            {order.status === 0 && !isSeller && (
              <Button
                size="sm"
                onClick={() => {
                  resetCancel();
                  resetSettle();
                  resetMatch();
                  void matchOrder(order.orderId);
                }}
                loading={matchPending}
              >
                Match
              </Button>
            )}
            {order.status === 0 && isSeller && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  resetMatch();
                  resetSettle();
                  resetCancel();
                  void cancel(order.orderId);
                }}
                loading={cancelPending}
              >
                Cancel
              </Button>
            )}
            {order.status === 1 && (isSeller || isBuyer) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetMatch();
                  resetCancel();
                  resetSettle();
                  void settle(order.orderId);
                }}
                loading={settlePending}
              >
                Settle
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
        <div className="max-h-[420px] overflow-auto overscroll-contain">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-secondary/95 backdrop-blur">
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
