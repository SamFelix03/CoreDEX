import { AppLayout } from "@/components/layout/AppLayout";
import { WriteOptionForm } from "@/components/options/WriteOptionForm";
import { OptionList } from "@/components/options/OptionList";

export default function OptionsPage() {
  return (
    <AppLayout
      title="Options"
      description="Write calls and puts, manage your options."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <WriteOptionForm />
        <div className="lg:col-span-2">
          <OptionList />
        </div>
      </div>
    </AppLayout>
  );
}
