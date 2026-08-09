import type { Metadata } from "next";
import Link from "next/link";
import { Camera } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { HistoryView } from "@/components/HistoryView";

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
        description="Every scan is stored so you can see what’s improving week to week."
        action={
          <Link href="/scan">
            <Button>
              <Camera className="h-4 w-4" />
              New scan
            </Button>
          </Link>
        }
      />
      <HistoryView />
    </div>
  );
}
