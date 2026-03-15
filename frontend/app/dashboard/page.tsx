import { AppLayout } from "@/components/layout/AppLayout";
import { ProtocolOverview } from "@/components/dashboard/ProtocolOverview";
import { UserPositions } from "@/components/dashboard/UserPositions";

export default function DashboardPage() {
  return (
    <AppLayout
      title="Dashboard"
      description="Protocol overview and your positions."
    >
      <ProtocolOverview />
      <UserPositions />
    </AppLayout>
  );
}
