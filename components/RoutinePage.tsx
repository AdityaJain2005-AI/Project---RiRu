"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Badge, Button, Card, PageHeader, cn } from "./ui";

type Step = { step: number; name: string; time: string; why: string };

export function RoutinePage() {
  const [phase, setPhase] = React.useState<"am" | "pm">("am");
  const [routine, setRoutine] = React.useState<{ am: Step[]; pm: Step[] } | null>(
    null
  );
  const [done, setDone] = React.useState<number[]>([]);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    const json = await res.json();
    setRoutine(json.routine);
    setPhase(json.prefs?.routinePhase ?? "am");
    const key = json.prefs?.routinePhase ?? "am";
    const completed =
      (json.prefs?.settings as { routineDone?: Record<string, number[]> })
        ?.routineDone?.[key] ?? [];
    setDone(completed);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function switchPhase(p: "am" | "pm") {
    setPhase(p);
    setBusy(true);
    try {
      await fetch("/api/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routinePhase: p }),
      });
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const json = await res.json();
      const completed =
        (json.prefs?.settings as { routineDone?: Record<string, number[]> })
          ?.routineDone?.[p] ?? [];
      setDone(completed);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStep(step: number) {
    const next = done.includes(step)
      ? done.filter((s) => s !== step)
      : [...done, step].sort((a, b) => a - b);
    setDone(next);
    setBusy(true);
    try {
      await fetch("/api/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routineDone: { phase, steps: next },
        }),
      });
    } finally {
      setBusy(false);
    }
  }

  const steps = routine?.[phase] ?? [];
  const progress = steps.length
    ? Math.round((done.length / steps.length) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Daily care"
        title="Your routine"
        description="Check off steps as you finish them. Progress saves to your profile."
        action={
          busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          ) : undefined
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
          {(["am", "pm"] as const).map((p) => (
            <button
              key={p}
              onClick={() => void switchPhase(p)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
                phase === p
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:text-zinc-800"
              )}
            >
              {p === "am" ? "☀ Morning" : "☾ Night"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="tabular-nums font-medium text-zinc-700">{progress}%</span>
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((step) => {
          const checked = done.includes(step.step);
          return (
            <li key={step.step}>
              <button
                onClick={() => void toggleStep(step.step)}
                className={cn(
                  "flex w-full gap-4 rounded-2xl border p-4 text-left transition",
                  checked
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-zinc-200/80 bg-white hover:border-zinc-300"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold",
                    checked
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 text-zinc-600"
                  )}
                >
                  {checked ? <Check className="h-4 w-4" /> : step.step}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "font-medium",
                        checked ? "text-zinc-500 line-through" : "text-zinc-900"
                      )}
                    >
                      {step.name}
                    </span>
                    <Badge tone="zinc">{step.time}</Badge>
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">{step.why}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {progress === 100 && steps.length > 0 && (
        <Card className="mt-5 border-emerald-200 bg-emerald-50/50 p-4 text-sm text-emerald-900">
          Nice work — {phase === "am" ? "morning" : "night"} routine complete.
          Consistency beats more products.
        </Card>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          variant="outline"
          type="button"
          onClick={() => {
            setDone([]);
            void fetch("/api/prefs", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ routineDone: { phase, steps: [] } }),
            });
          }}
        >
          Reset checks
        </Button>
        <Link
          href={`/chat?q=${encodeURIComponent(
            `Tweak my ${phase === "am" ? "morning" : "night"} routine — I only have 5 minutes`
          )}`}
        >
          <Button type="button" variant="soft">
            <MessageCircle className="h-4 w-4" />
            Ask AI to tweak
          </Button>
        </Link>
        <Link href="/scan">
          <Button type="button" variant="ghost">
            New scan first
          </Button>
        </Link>
      </div>
    </div>
  );
}
