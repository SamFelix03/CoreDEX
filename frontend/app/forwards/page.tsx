import { AppLayout } from "@/components/layout/AppLayout";
import { CreateAskForm } from "@/components/forwards/CreateAskForm";
import { OrderList } from "@/components/forwards/OrderList";
import { ForwardMarketChart } from "@/components/forwards/ForwardMarketChart";

export default function ForwardsPage() {
  return (
    <AppLayout
      title="Forwards"
      description="Create asks and manage your forward orders."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <CreateAskForm />
        <div className="lg:col-span-2">
          <ForwardMarketChart />
          <OrderList />
        </div>
      </div>
    </AppLayout>
  );
}
