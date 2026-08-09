import type { Metadata } from "next";
import { LabDashboard } from "@/components/LabDashboard";

export const metadata: Metadata = {
  title: "Skin lab",
  description: "Scores, concerns, and ingredient matches from your latest scan.",
};

export default function DashboardPage() {
  return <LabDashboard />;
}
