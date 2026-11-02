import React from "react";
import { useNavigate } from "react-router-dom";
import WhatsAppDashboardOverview from "@/components/whatsapp/WhatsAppDashboardOverview";

export default function WhatsAppDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100dvh-140px)] space-y-6 rounded-2xl bg-[#f9f8ff] p-3 text-slate-900 dark:bg-slate-950/30 dark:text-slate-100 sm:p-5">
      <WhatsAppDashboardOverview
        onNavigateTab={(tab) => {
          navigate("/dashboard/communications/whatsapp");
        }}
        onOpenNewCampaign={() => {
          navigate("/dashboard/communications/whatsapp");
        }}
      />
    </div>
  );
}
