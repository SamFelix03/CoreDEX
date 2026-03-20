import { AppLayout } from "@/components/layout/AppLayout";
import { WriteOptionForm } from "@/components/options/WriteOptionForm";
import { OptionList } from "@/components/options/OptionList";
import { OptionsMarketChart } from "@/components/options/OptionsMarketChart";
import { CoretimeMintBanner } from "@/components/coretime/CoretimeMintBanner";

export default function OptionsPage() {
  return (
    <AppLayout
      title="Options"
      description="Write calls and puts, manage your options."
    >
      <div className="space-y-6">
        <CoretimeMintBanner />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <WriteOptionForm />
          <div className="lg:col-span-2 flex flex-col gap-6">
            <OptionsMarketChart />
            <OptionList />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
