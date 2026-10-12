import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ScanFlow } from "@/components/ScanFlow";

export const metadata: Metadata = {
  title: "Face scan",
  description: "Camera or photo. A baseline visual estimate, not a diagnosis.",
};

export default function ScanPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Face scan"
        title="Face scan"
        description="A photo is checked for a clear face, then a baseline visual estimate is saved. This is not a measurement and not a diagnosis."
      />
      <ScanFlow />
    </div>
  );
}
