"use client";

import * as React from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Badge, Button, Card, cn } from "./ui";

type Msg = { id?: string; role: "user" | "ai"; text: string };

export function ChatPage() {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        const json = await res.json();
        setMessages(json.messages ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || busy) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setMessages((m) => [
        ...m,
        { role: "ai", text: json.message.text, id: json.message.id },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "ai",
          text: e instanceof Error ? e.message : "Could not reply.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card elevated className="flex min-h-[70vh] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-zinc-100 bg-gradient-to-r from-emerald-50/80 to-white px-4 py-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">AI Cosmetologist</p>
          <p className="text-[11px] text-zinc-500">
            Knows your latest scan · replies saved to your lab
          </p>
        </div>
        <Badge tone="emerald" className="ml-auto">
          Online
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {loading && (
          <p className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
          </p>
        )}
        {!loading && messages.length === 0 && (
          <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
            Ask about hydration, SPF, cleanser swaps, or tonight’s routine.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={msg.id ?? i}
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
              msg.role === "ai"
                ? "self-start rounded-tl-md bg-zinc-100 text-zinc-700"
                : "self-end rounded-tr-md bg-emerald-600 text-white shadow-sm shadow-emerald-600/15"
            )}
          >
            {msg.text}
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 self-start text-xs text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-zinc-100 p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[
            "Why is hydration low?",
            "Tweak my PM for 5 minutes",
            "Travel SPF kit",
          ].map((q) => (
            <button
              key={q}
              onClick={() => void send(q)}
              className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder="Ask anything about your skin plan…"
            className="h-11 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-emerald-500/30 placeholder:text-zinc-400 focus:bg-white focus:ring-2"
          />
          <Button size="icon" className="h-11 w-11" onClick={() => void send()} disabled={busy}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
