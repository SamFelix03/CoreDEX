"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAccount } from "wagmi";
import { useForwardOrders, useForwardOrder, useMatchOrder, useCancelOrder, useSettleForward } from "@/hooks/useForwardOrders";
import { formatDOT, truncateAddress, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/utils";
import { TxSuccessWithExplorer } from "@/components/ui/TxSuccessWithExplorer";
import { TxDetailModal } from "@/components/ui/TxDetailModal";
import { FORWARD_MARKET_ADDRESS } from "@/constants";
import type { ForwardOrder } from "@/types/protocol";

function TxError({ message }: { message: string }) {
  return (
    <p className="text-[10px] text-red-400 break-words" role="alert">
      {message}
    </p>
  );
}

function OrderRow({ orderId }: { orderId: bigint }) {
  const { order, isLoading } = useForwardOrder(orderId);
  const { address } = useAccount();
  const {
    matchOrder,
    isWritePending: matchWritePending,
    isConfirming: matchConfirming,
    isSuccess: matchOk,
    hash: matchHash,
    reset: resetMatch,
    error: matchError,
  } = useMatchOrder();
  const {
    cancel,
    isWritePending: cancelWritePending,
    isConfirming: cancelConfirming,
    isSuccess: cancelOk,
    hash: cancelHash,
    reset: resetCancel,
    error: cancelError,
  } = useCancelOrder();
  const {
    settle,
    isWritePending: settleWritePending,
    isConfirming: settleConfirming,
    isSuccess: settleOk,
    hash: settleHash,
    reset: resetSettle,
    error: settleError,
  } = useSettleForward();

  const [matchDetailOpen, setMatchDetailOpen] = useState(false);
  const [matchDetail, setMatchDetail] = useState<{
    hash: `0x${string}`;
    order: ForwardOrder;
    matcher: `0x${string}`;
  } | null>(null);
  const shownMatchHashRef = useRef<string | null>(null);

  useEffect(() => {
    if (!matchHash) {
      shownMatchHashRef.current = null;
      return;
    }
    if (matchOk && order && address) {
      if (shownMatchHashRef.current !== matchHash) {
        shownMatchHashRef.current = matchHash;
        setMatchDetail({
          hash: matchHash,
          order: { ...order },
          matcher: address,
        });
        setMatchDetailOpen(true);
      }
    }
  }, [matchOk, matchHash, order, address]);

  const successHash =
    cancelOk && cancelHash ? cancelHash : settleOk && settleHash ? settleHash : null;
  const successLabel = cancelOk ? "Order cancelled." : settleOk ? "Settlement submitted." : null;

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
  const isBuyer = address?.toLowerCase() === order.buyer.toLowerCase();

  return (
    <>
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
                  loading={matchWritePending}
                  disabled={matchWritePending || matchConfirming}
                  title={matchConfirming && !matchWritePending ? "Waiting for block confirmation…" : undefined}
                >
                  {matchConfirming && !matchWritePending ? "Confirming…" : "Match"}
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
                  loading={cancelWritePending}
                  disabled={cancelWritePending || cancelConfirming}
                  title={cancelConfirming && !cancelWritePending ? "Waiting for block confirmation…" : undefined}
                >
                  {cancelConfirming && !cancelWritePending ? "Confirming…" : "Cancel"}
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
                  loading={settleWritePending}
                  disabled={settleWritePending || settleConfirming}
                  title={settleConfirming && !settleWritePending ? "Waiting for block confirmation…" : undefined}
                >
                  {settleConfirming && !settleWritePending ? "Confirming…" : "Settle"}
                </Button>
              )}
            </div>
            {matchError?.message && !matchWritePending && !matchConfirming && (
              <TxError message={matchError.message} />
            )}
            {cancelError?.message && !cancelWritePending && !cancelConfirming && (
              <TxError message={cancelError.message} />
            )}
            {settleError?.message && !settleWritePending && !settleConfirming && (
              <TxError message={settleError.message} />
            )}
            {successHash && successLabel && (
              <TxSuccessWithExplorer hash={successHash} className="!p-2 !text-[10px]">
                <span>{successLabel}</span>
              </TxSuccessWithExplorer>
            )}
          </div>
        </td>
      </tr>
      {matchDetail ? (
        <TxDetailModal
          open={matchDetailOpen}
          onClose={() => {
            setMatchDetailOpen(false);
            resetMatch();
            setMatchDetail(null);
          }}
          title="Forward order matched"
          subtitle="ForwardMarket.matchOrder — your strike (DOT) is escrowed in the market until settlement."
          txHash={matchDetail.hash}
          contract={{ label: "ForwardMarket", address: FORWARD_MARKET_ADDRESS }}
          functionName="matchOrder(uint256 orderId)"
          rows={[
            {
              label: "Order ID",
              value: `#${String(matchDetail.order.orderId)}`,
            },
            {
              label: "DOT escrowed (strike)",
              value: `${formatDOT(matchDetail.order.strikePriceDOT)} DOT`,
              hint: "Transferred from you into ForwardMarket via the assets precompile; released to seller on settle after delivery block.",
            },
            {
              label: "Seller",
              value: <span className="font-mono text-xs">{matchDetail.order.seller}</span>,
            },
            {
              label: "Buyer (you)",
              value: <span className="font-mono text-xs">{matchDetail.matcher}</span>,
            },
            {
              label: "Coretime region (NFT id)",
              value: String(matchDetail.order.regionId),
            },
            {
              label: "Delivery block",
              value: String(matchDetail.order.deliveryBlock),
              hint: "After this block, either party can call settle() to trigger settlement + seller payout (per contract).",
            },
            {
              label: "On-chain status after tx",
              value: "Matched (1)",
              hint: "ForwardMarket.orders(id).status — list UI refreshes from chain reads.",
            },
          ]}
          footnote={
            "Settle (separate tx) moves order status to settled, pays the seller the escrowed DOT, and invokes " +
            "SettlementExecutor for NFT delivery. Explorer shows all events (e.g. OrderMatched)."
          }
        />
      ) : null}
    </>
  );
}

export function OrderList() {
  const { address } = useAccount();
  const { sellerOrderIds, buyerOrderIds } = useForwardOrders(address);

  const allOrderIds = [
    ...(sellerOrderIds ?? []),
    ...(buyerOrderIds ?? []),
  ].filter((v, i, a) => a.findIndex((x) => x === v) === i);

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
