import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ChatPage } from "@/components/ChatPage";

export const metadata: Metadata = {
  title: "AI Cosmetologist",
  description: "Chat grounded in your latest skin scan.",
};

export default function ChatRoute() {
  return (
    <div>
      <PageHeader
        eyebrow="Coach"
        title="AI cosmetologist"
        description="Short, practical answers based on your latest biomarkers."
      />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading chat…</p>}>
        <ChatPage />
      </Suspense>
    </div>
  );
}
