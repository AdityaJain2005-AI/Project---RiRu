import type { Metadata } from "next";
import FacelabSkinDiagnosticDashboard from "@/components/FacelabSkinDiagnosticDashboard";

export const metadata: Metadata = {
  title: "Skin Diagnostic Dashboard",
  description:
    "AI skin scores, concerns, personalized routine, ingredient matches, and cosmetologist chat.",
};

export default function DashboardPage() {
  return <FacelabSkinDiagnosticDashboard />;
}
