import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { VaultStatsCard } from "@/components/vault/VaultStats";
import { DepositForm } from "@/components/vault/DepositForm";
import { BorrowForm } from "@/components/vault/BorrowForm";

export default function VaultPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <div style={{ height: 52 }} />

      <main style={{ flex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <VaultStatsCard />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DepositForm />
          <BorrowForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
