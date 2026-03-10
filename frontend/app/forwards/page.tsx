import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CreateAskForm } from "@/components/forwards/CreateAskForm";
import { OrderList } from "@/components/forwards/OrderList";

export default function ForwardsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <div style={{ height: 52 }} />

      <main style={{ flex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <CreateAskForm />
          <OrderList />
        </div>
      </main>
      <Footer />
    </div>
  );
}
