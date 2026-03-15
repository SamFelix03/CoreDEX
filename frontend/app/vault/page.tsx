import { AppLayout } from "@/components/layout/AppLayout";
import { VaultStatsCard } from "@/components/vault/VaultStats";
import { DepositForm } from "@/components/vault/DepositForm";
import { BorrowForm } from "@/components/vault/BorrowForm";

export default function VaultPage() {
  return (
    <AppLayout
      title="Vault"
      description="Deposit regions and borrow Coretime."
    >
      <VaultStatsCard />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <DepositForm />
        <BorrowForm />
      </div>
    </AppLayout>
  );
}
