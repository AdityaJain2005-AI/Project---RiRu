"use client";

import * as React from "react";
import { Card } from "./ui";

type Progress = {
  disclaimer: string;
  timeline: { id: string; createdAt: string; analysisKind: string; sampleScore: boolean; summary: string }[];
  beforeAfter: {
    before: { createdAt: string; summary: string; sampleScore: boolean; analysisKind: string };
    after: { createdAt: string; summary: string; sampleScore: boolean; analysisKind: string };
    sameScan: boolean;
    sampleScoreDelta: number | null;
  } | null;
  concerns: {
    concern: string;
    direction: "lower" | "higher" | "same";
    measured: boolean;
    points: { severity: string; sampleScore: boolean; createdAt: string }[];
  }[];
  checkIns: { id: string; day: string; note: string | null }[];
};

export function ProgressPanel() {
  const [data, setData] = React.useState<Progress | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/v1/progress", { cache: "no-store" });
    const json = (await res.json()) as Progress & { error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message || "Could not load progress.");
    setData(json);
  }, []);

  React.useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load progress."));
  }, [load]);

  async function checkIn() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/check-ins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note, completedStepIds: [] }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message || "Could not save the check-in.");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the check-in.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p className="mb-4 text-sm text-rose-700">{error}</p>;
  if (!data) return <p className="mb-4 text-sm text-zinc-500">Loading progress…</p>;

  return (
    <div className="mb-6 space-y-4">
      <Card className="p-4">
        <h2 className="text-sm font-semibold">Before and after</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Succeeded scans only. A sample score is a placeholder, not a measurement. Concern labels are estimates.
        </p>
        {data.beforeAfter ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-zinc-100 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Earlier</p>
              <p className="mt-1 text-xs text-zinc-500">{data.beforeAfter.before.createdAt.slice(0, 10)}</p>
              <p className="mt-2 text-sm text-zinc-800">{data.beforeAfter.before.summary || "No summary saved."}</p>
              {data.beforeAfter.before.sampleScore ? (
                <p className="mt-2 text-[11px] text-amber-700">Sample score ({data.beforeAfter.before.analysisKind})</p>
              ) : null}
            </article>
            <article className="rounded-xl border border-zinc-100 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Latest</p>
              <p className="mt-1 text-xs text-zinc-500">{data.beforeAfter.after.createdAt.slice(0, 10)}</p>
              <p className="mt-2 text-sm text-zinc-800">{data.beforeAfter.after.summary || "No summary saved."}</p>
              {data.beforeAfter.after.sampleScore ? (
                <p className="mt-2 text-[11px] text-amber-700">Sample score ({data.beforeAfter.after.analysisKind})</p>
              ) : null}
            </article>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No succeeded scan yet.</p>
        )}
        {data.beforeAfter?.sampleScoreDelta != null ? (
          <p className="mt-2 text-xs text-zinc-500">
            Sample score change: {data.beforeAfter.sampleScoreDelta > 0 ? "+" : ""}
            {data.beforeAfter.sampleScoreDelta}. This is not a clinical change.
          </p>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Concerns over time</h2>
        {data.concerns.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No concern labels are saved on succeeded scans yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.concerns.map((trend) => (
              <li key={trend.concern} className="text-sm text-zinc-700">
                <span className="font-medium">{trend.concern.replaceAll("_", " ")}</span>
                <span className="text-zinc-500">
                  {" "}
                  {trend.points.map((point) => point.severity).join(" → ")} ({trend.direction}
                  {trend.measured ? "" : ", sample"})
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Today&apos;s check-in</h2>
        <p className="mt-1 text-xs text-zinc-500">Optional. One note per day. It does not change the scan.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-48 flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
            value={note}
            maxLength={500}
            placeholder="I followed the gentle list"
            onChange={(event) => setNote(event.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void checkIn()}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Save check-in
          </button>
        </div>
        {data.checkIns[0] ? (
          <p className="mt-2 text-xs text-zinc-500">
            Latest: {data.checkIns[0].day}
            {data.checkIns[0].note ? ` — ${data.checkIns[0].note}` : ""}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
      </Card>
      <p className="text-[11px] text-zinc-400">{data.disclaimer}</p>
    </div>
  );
}
