import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ScanFlow } from "@/components/ScanFlow";

export const metadata: Metadata = {
  title: "Face scan",
  description: "Guided AI skin scan — camera or photo.",
};

export default function ScanPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Diagnostic"
        title="Face scan"
        description="One quiet minute. We map landmarks, score biomarkers, and save everything to your lab history."
      />
      <ScanFlow />
    </div>
  );
}
