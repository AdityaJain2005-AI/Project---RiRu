import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { ChatPage } from "@/components/ChatPage";

export const metadata: Metadata = {
  title: "RiRu chat",
  description: "Answers from RiRu notes, with citations. Informational only, not a medical diagnosis.",
};

export default function ChatRoute() {
  return (
    <div>
      <PageHeader
        eyebrow="Coach"
        title="RiRu chat"
        description="Short answers from the notes in this app. Informational only, not a medical diagnosis."
      />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading chat…</p>}>
        <ChatPage />
      </Suspense>
    </div>
  );
}
