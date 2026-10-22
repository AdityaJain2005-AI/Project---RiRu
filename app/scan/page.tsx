import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ScanFlowClient } from "@/components/ScanFlowClient";

export const metadata: Metadata = {
  title: "Face scan",
  description: "Guided AI skin scan — MediaPipe landmarks or photo.",
};

export default function ScanPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Diagnostic"
        title="Face scan"
        description="One quiet minute. MediaPipe maps landmarks across three views, then we score biomarkers into your lab history."
      />
      <ScanFlowClient />
    </div>
  );
}
