import type { Metadata } from "next";
import Link from "next/link";
import { Camera } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { HistoryView } from "@/components/HistoryView";
import { PrivacyPanel } from "@/components/PrivacyPanel";
import { ProgressPanel } from "@/components/ProgressPanel";

export const metadata: Metadata = {
  title: "History",
  description: "Past skin scans and score trend.",
};

export default function HistoryPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Progress"
        title="Scan history"
        description="Succeeded scans, concern labels, and an optional daily check-in. Sample scores are not measurements."
        action={
          <Link href="/scan">
            <Button>
              <Camera className="h-4 w-4" />
              New scan
            </Button>
          </Link>
        }
      />
      <PrivacyPanel />
      <ProgressPanel />
      <HistoryView />
    </div>
  );
}
