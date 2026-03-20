"use client";

import { useMemo, useState } from "react";
import { useChainId } from "wagmi";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TxSuccessWithExplorer } from "@/components/ui/TxSuccessWithExplorer";
import { useVaultBorrow, useVaultStats } from "@/hooks/useVault";
import { ASSET_HUB_CHAIN_ID } from "@/constants";
import { formatTransactionError } from "@/lib/walletError";
import { computeVaultBorrowFee } from "@/lib/vaultBorrow";
import { formatDOT } from "@/lib/utils";

/** Defaults match `smart-contracts/scripts/test-yieldvault-individual.ts` (`coreCount = 1`, `durationBlocks = 1000`). */
const DEFAULT_CORE = "1";
const DEFAULT_DURATION_BLOCKS = "1000";

export function BorrowForm() {
  const [coreCount, setCoreCount] = useState(DEFAULT_CORE);
  const [durationBlocks, setDurationBlocks] = useState(DEFAULT_DURATION_BLOCKS);

  const chainId = useChainId();
  const wrongChain = chainId !== ASSET_HUB_CHAIN_ID;

  const { stats } = useVaultStats();
  const { borrow, isPending, isSuccess, error, reset, hash } = useVaultBorrow();

  const coreN = Number.parseInt(coreCount.trim(), 10);
  const durN = Number.parseInt(durationBlocks.trim(), 10);
  const countsValid =
    Number.isFinite(coreN) &&
    Number.isFinite(durN) &&
    coreN >= 1 &&
    durN >= 1 &&
    coreN <= 0xffff_ffff &&
    durN <= 0xffff_ffff;

  const previewFee = useMemo(() => {
    if (!stats || !countsValid) return null;
    return computeVaultBorrowFee(coreN, durN, stats.lendingRate);
  }, [stats, countsValid, coreN, durN]);

  const canSubmit = countsValid && !wrongChain;

  const handleBorrow = async () => {
    if (!canSubmit) return;
    try {
      await borrow(BigInt(coreN), BigInt(durN));
    } catch (e) {
      console.error("borrow failed:", e);
    }
  };

  return (
    <Card className="animate-slide-in-up">
      <CardHeader label="Borrow Regions" />
      <CardContent className="flex flex-col gap-4">
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
        <Input
          label="Duration (blocks)"
          type="number"
          min={1}
          placeholder={DEFAULT_DURATION_BLOCKS}
          value={durationBlocks}
          onChange={(e) => {
            reset();
            setDurationBlocks(e.target.value);
          }}
          disabled={wrongChain}
        />
        <p className="text-[10px] text-muted-foreground -mt-2 leading-relaxed">
          Same shape as the Hardhat script: <span className="font-mono">borrow(uint32 coreCount, uint32 durationBlocks)</span>
          . The wallet may ask you to <strong>approve DOT</strong> for the vault first (lending fee), then confirm{" "}
          <strong>borrow</strong>.
        </p>
        {previewFee !== null && (
          <p className="text-xs text-muted-foreground">
            Estimated lending fee (from current rate):{" "}
            <span className="font-mono text-foreground">{formatDOT(previewFee)} DOT</span>
          </p>
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
          variant="outline"
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
