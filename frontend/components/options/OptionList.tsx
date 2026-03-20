"use client";
import { useEffect, useRef, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAccount, useBlockNumber } from "wagmi";
import { useOptionsData, useOption, useBuyOption, useExerciseOption } from "@/hooks/useOptions";
import { formatDOT, truncateAddress } from "@/lib/utils";
import { TxSuccessWithExplorer } from "@/components/ui/TxSuccessWithExplorer";
import { TxDetailModal } from "@/components/ui/TxDetailModal";
import { OPTIONS_ENGINE_ADDRESS, ASSET_HUB_CHAIN_ID } from "@/constants";
import type { Option } from "@/types/protocol";
import {
  getOptionDisplayColorVar,
  getOptionDisplayLabel,
  optionHasHolder,
} from "@/lib/optionOnChainUi";

function OptionRow({ optionId }: { optionId: bigint }) {
  const { option, isLoading } = useOption(optionId);
  const { address } = useAccount();
  const { data: headBlock } = useBlockNumber({ chainId: ASSET_HUB_CHAIN_ID, watch: true });

  const {
    buyOption,
    isWritePending: buyWritePending,
    isConfirming: buyConfirming,
    isSuccess: buyOk,
    hash: buyHash,
    reset: resetBuy,
    error: buyError,
  } = useBuyOption();
  const {
    exercise,
    isWritePending: exerciseWritePending,
    isConfirming: exerciseConfirming,
    isSuccess: exerciseOk,
    hash: exerciseHash,
    reset: resetExercise,
    error: exerciseError,
  } = useExerciseOption();

  const [buyDetailOpen, setBuyDetailOpen] = useState(false);
  const [buyDetail, setBuyDetail] = useState<{
    hash: `0x${string}`;
    option: Option;
    buyer: `0x${string}`;
  } | null>(null);
  const shownBuyHashRef = useRef<string | null>(null);

  useEffect(() => {
    if (!buyHash) {
      shownBuyHashRef.current = null;
      return;
    }
    if (buyOk && option && address) {
      if (shownBuyHashRef.current !== buyHash) {
        shownBuyHashRef.current = buyHash;
        setBuyDetail({
          hash: buyHash,
          option: { ...option },
          buyer: address,
        });
        setBuyDetailOpen(true);
      }
    }
  }, [buyOk, buyHash, option, address]);

  const successHash = exerciseOk && exerciseHash ? exerciseHash : null;
  const successLabel = exerciseOk ? "Exercise submitted." : null;

  if (isLoading || !option) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3 text-sm text-muted-foreground">
          Loading…
        </td>
      </tr>
    );
  }

  const statusLabel = getOptionDisplayLabel(option);
  const statusColor = getOptionDisplayColorVar(statusLabel);
  const isWriter = address?.toLowerCase() === option.writer.toLowerCase();
  const isHolder = address?.toLowerCase() === option.holder.toLowerCase();
  const held = optionHasHolder(option);

  const expiryNum = Number(option.expiryBlock);
  const headNum = headBlock !== undefined ? Number(headBlock) : undefined;
  const atExpiryBlock =
    headNum !== undefined && expiryNum > 0 && headNum === expiryNum;

  /** OptionsEngine: exercise only when block.number == expiryBlock (exact). */
  const canBuy = option.status === 0 && !held && !isWriter && !!address;

  return (
    <>
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
          <div className="flex flex-col gap-2 max-w-[220px]">
            <div className="flex flex-wrap gap-2">
              {canBuy && (
                <Button
                  size="sm"
                  onClick={() => {
                    resetExercise();
                    resetBuy();
                    void buyOption(option.optionId);
                  }}
                  loading={buyWritePending}
                  disabled={buyWritePending || buyConfirming}
                  title={buyConfirming && !buyWritePending ? "Waiting for block confirmation…" : undefined}
                >
                  {buyConfirming && !buyWritePending ? "Confirming…" : "Buy"}
                </Button>
              )}
              {option.status === 0 && isHolder && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    resetBuy();
                    resetExercise();
                    void exercise(option.optionId);
                  }}
                  loading={exerciseWritePending}
                  disabled={
                    exerciseWritePending || exerciseConfirming || !atExpiryBlock
                  }
                  title={
                    !atExpiryBlock
                      ? `Exercise is only allowed at relay block ${String(option.expiryBlock)} (current: ${headNum ?? "…"})`
                      : exerciseConfirming && !exerciseWritePending
                        ? "Waiting for block confirmation…"
                        : undefined
                  }
                >
                  {exerciseConfirming && !exerciseWritePending ? "Confirming…" : "Exercise"}
                </Button>
              )}
            </div>
            {buyError?.message && !buyWritePending && !buyConfirming && (
              <p className="text-[10px] text-red-400 break-words" role="alert">
                {buyError.message}
              </p>
            )}
            {exerciseError?.message && !exerciseWritePending && !exerciseConfirming && (
              <p className="text-[10px] text-red-400 break-words" role="alert">
                {exerciseError.message}
              </p>
            )}
            {successHash && successLabel && (
              <TxSuccessWithExplorer hash={successHash} className="!p-2 !text-[10px]">
                <span>{successLabel}</span>
              </TxSuccessWithExplorer>
            )}
          </div>
        </td>
      </tr>
      {buyDetail ? (
        <TxDetailModal
          open={buyDetailOpen}
          onClose={() => {
            setBuyDetailOpen(false);
            resetBuy();
            setBuyDetail(null);
          }}
          title="Option purchased"
          subtitle="OptionsEngine.buyOption — premium paid to writer; you are now the holder."
          txHash={buyDetail.hash}
          contract={{ label: "OptionsEngine", address: OPTIONS_ENGINE_ADDRESS }}
          functionName="buyOption(uint256 optionId)"
          rows={[
            {
              label: "Option ID",
              value: `#${String(buyDetail.option.optionId)}`,
            },
            {
              label: "Premium paid (to writer)",
              value: `${formatDOT(buyDetail.option.premiumDOT)} DOT`,
              hint: "Transferred via the assets precompile (DOT) from your wallet to the writer.",
            },
            {
              label: "Writer",
              value: <span className="font-mono text-xs">{buyDetail.option.writer}</span>,
            },
            {
              label: "Holder (you)",
              value: <span className="font-mono text-xs">{buyDetail.buyer}</span>,
            },
            {
              label: "Coretime region (NFT id)",
              value: String(buyDetail.option.coretimeRegion),
            },
            {
              label: "Strike",
              value: `${formatDOT(buyDetail.option.strikePriceDOT)} DOT`,
              hint: "Due on exercise at expiry block (calls) or put mechanics per contract.",
            },
            {
              label: "Expiry block",
              value: String(buyDetail.option.expiryBlock),
            },
            {
              label: "Type",
              value: buyDetail.option.optionType === 0 ? "Call" : "Put",
            },
          ]}
          footnote={
            "On-chain status stays 0 (active) until exercise or expiry; the UI shows Purchased once a holder is set. " +
            "Reads refetch after the tx mines so the row should update immediately."
          }
        />
      ) : null}
    </>
  );
}

export function OptionList() {
  const { address } = useAccount();
  const { writerOptionIds, holderOptionIds } = useOptionsData(address);

  const allOptionIds = [
    ...(writerOptionIds ?? []),
    ...(holderOptionIds ?? []),
  ].filter((v, i, a) => a.findIndex((x) => x === v) === i);

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
        <div className="max-h-[420px] overflow-auto overscroll-contain">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-secondary/95 backdrop-blur">
                {["Option", "Type", "Region", "Strike", "Premium", "Status", "Actions"].map((h) => (
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
