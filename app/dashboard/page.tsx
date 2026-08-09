import type { Metadata } from "next";
import { Suspense } from "react";
import { LabDashboard } from "@/components/LabDashboard";

export const metadata: Metadata = {
  title: "Skin lab",
  description: "Scores, concerns, and ingredient matches from your latest scan.",
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading lab…</p>}>
      <LabDashboard />
    </Suspense>
  );
}
