"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FutureRelayTimeInput } from "@/components/ui/FutureRelayTimeInput";
import { TxSuccessWithExplorer } from "@/components/ui/TxSuccessWithExplorer";
import { useVaultBorrow, useVaultStats } from "@/hooks/useVault";
import { useEstimatedRelayBlock } from "@/hooks/useEstimatedRelayBlock";
import { ASSET_HUB_CHAIN_ID, RELAY_BLOCK_UINT32_MAX } from "@/constants";
import { finalizeEvmFutureBlockForTx } from "@/lib/relayBlockEstimate";
import { formatTransactionError } from "@/lib/walletError";
import { VAULT_RATE_PRECISION } from "@/lib/vaultBorrow";
import { formatDOT, blocksToTime } from "@/lib/utils";

/** Default core count matches scripts (`borrow(1, durationBlocks)`). */
const DEFAULT_CORE = "1";

export function BorrowForm() {
  const [coreCount, setCoreCount] = useState(DEFAULT_CORE);
  const [returnWhen, setReturnWhen] = useState(() =>
    format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm")
  );
  const [blockFinalizeNote, setBlockFinalizeNote] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: ASSET_HUB_CHAIN_ID });
  const wrongChain = chainId !== ASSET_HUB_CHAIN_ID;

  const targetMs = useMemo(() => {
    if (!returnWhen?.trim()) return null;
    const t = new Date(returnWhen).getTime();
    return Number.isFinite(t) ? t : null;
  }, [returnWhen]);

  const {
    estimatedBlock: dueBlock,
    error: blockEstError,
    isLoadingHead,
    latestBlockNumber,
  } = useEstimatedRelayBlock(targetMs);

  const { stats } = useVaultStats();
  const { borrow, isPending, isSuccess, error, reset, hash } = useVaultBorrow();

  const coreN = Number.parseInt(coreCount.trim(), 10);
  const coreValid =
    Number.isFinite(coreN) && coreN >= 1 && coreN <= 0xffff_ffff;

  /** UI preview: blocks from cached head to estimated due block (same idea as forwards). */
  const previewDurationBlocks =
    dueBlock !== null && latestBlockNumber !== null && dueBlock > latestBlockNumber
      ? dueBlock - latestBlockNumber
      : null;

  const previewFee = useMemo(() => {
    if (!stats || !coreValid || previewDurationBlocks === null || previewDurationBlocks < 1n) return null;
    return (BigInt(coreN) * previewDurationBlocks * stats.lendingRate) / VAULT_RATE_PRECISION;
  }, [stats, coreValid, coreN, previewDurationBlocks]);

  /** Same gating idea as `CreateAskForm` — `publicClient` is checked inside the click handler. */
  const canSubmit =
    isConnected &&
    !!address &&
    !wrongChain &&
    coreValid &&
    previewDurationBlocks !== null &&
    previewDurationBlocks >= 1n &&
    previewDurationBlocks <= RELAY_BLOCK_UINT32_MAX &&
    !blockEstError &&
    !isLoadingHead;

  const handleBorrow = async () => {
    if (!canSubmit || dueBlock === null) return;
    if (!publicClient) {
      console.error("borrow: no public client");
      return;
    }
    setBlockFinalizeNote(null);
    try {
      const { block: dueFinal, error: finErr, adjusted } = await finalizeEvmFutureBlockForTx(
        publicClient,
        dueBlock
      );
      if (finErr) {
        setBlockFinalizeNote(finErr);
        return;
      }
      const head = await publicClient.getBlockNumber();
      let durationBlocks = dueFinal - head;
      if (durationBlocks < 1n) durationBlocks = 1n;
      if (durationBlocks > RELAY_BLOCK_UINT32_MAX) {
        setBlockFinalizeNote(
          "Computed loan duration exceeds uint32 max. Choose an earlier return-by time."
        );
        return;
      }
      if (adjusted) {
        setBlockFinalizeNote(
          `Loan duration set to ${durationBlocks.toString()} blocks (~${blocksToTime(
            durationBlocks
          )}) — fresh RPC head + minimum block lead applied (same pattern as forward asks).`
        );
      }
      await borrow(BigInt(coreN), durationBlocks);
    } catch (e) {
      console.error("borrow failed:", e);
    }
  };

  return (
    <Card className="animate-slide-in-up">
      <CardHeader label="Borrow Regions" />
      <CardContent className="flex flex-col gap-4">
        {!isConnected && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Connect your wallet to borrow.
          </div>
        )}
        {wrongChain && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Switch to <span className="font-mono">Polkadot Hub TestNet</span> (chain {ASSET_HUB_CHAIN_ID}).
          </div>
        )}
        <Input
          label="Core count"
          type="number"
          min={1}
          placeholder={DEFAULT_CORE}
          value={coreCount}
          onChange={(e) => {
            reset();
            setCoreCount(e.target.value);
          }}
          disabled={wrongChain}
        />
        <FutureRelayTimeInput
          label="Return by"
          description="Loan length is the number of EVM blocks from the current head until this time (~12s per block). If the pick is too soon, we add the same minimum block lead as forward asks."
          value={returnWhen}
          onChange={(v) => {
            reset();
            setReturnWhen(v);
          }}
          estimatedBlock={dueBlock}
          estimateError={blockEstError}
          isLoadingHead={isLoadingHead}
          latestBlockNumber={latestBlockNumber}
        />
        {previewDurationBlocks !== null && previewDurationBlocks >= 1n && !blockEstError && (
          <p className="text-xs text-muted-foreground">
            Approx. duration from current head:{" "}
            <span className="font-mono text-foreground">{previewDurationBlocks.toString()}</span> blocks (~
            {blocksToTime(previewDurationBlocks)}). Final value is recomputed at send time from a fresh head.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          On-chain: <span className="font-mono">borrow(uint32 coreCount, uint32 durationBlocks)</span>. The vault pulls
          the lending fee via DOT <span className="font-mono">transferFrom</span> — you may be asked to{" "}
          <strong>approve</strong> the vault first, then <strong>borrow</strong>.
        </p>
        {previewFee !== null && (
          <p className="text-xs text-muted-foreground">
            Estimated lending fee (from current rate):{" "}
            <span className="font-mono text-foreground">{formatDOT(previewFee)} DOT</span>
          </p>
        )}
        {blockFinalizeNote && (
          <div
            className={`rounded-lg border px-4 py-3 text-xs animate-slide-in-up ${
              blockFinalizeNote.includes("fresh RPC") || blockFinalizeNote.includes("Loan duration set")
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {blockFinalizeNote}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive animate-slide-in-up whitespace-pre-wrap break-words">
            {formatTransactionError(error)}
          </div>
        )}
        {isSuccess && (
          <TxSuccessWithExplorer hash={hash}>
            <span>Borrow confirmed — lending fee paid from your DOT balance (after approval if needed).</span>
          </TxSuccessWithExplorer>
        )}
        <Button
          onClick={handleBorrow}
          loading={isPending}
          disabled={!canSubmit}
          className="w-full"
        >
          Borrow
        </Button>
      </CardContent>
    </Card>
  );
}
