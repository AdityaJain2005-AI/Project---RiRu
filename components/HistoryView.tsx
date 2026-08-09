"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, ScoreRing, Skeleton, cn } from "./ui";

type ScanRow = {
  id: string;
  overallScore: number;
  summary: string;
  source: string;
  metrics: { id: string; label: string; score: number }[];
  createdAt: string;
};

export function HistoryView() {
  const router = useRouter();
  const [scans, setScans] = React.useState<ScanRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function load() {
    try {
      const res = await fetch("/api/scans/list", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setScans(json.scans);
      if (json.scans[0]) setSelected(json.scans[0].id);
      else setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function removeScan(id: string) {
    if (!confirm("Delete this scan from your history?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/scans/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <EmptyState
        title="Couldn’t load history"
        body={error}
        action={
          <Button type="button" onClick={() => window.location.reload()}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!scans) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <EmptyState
        title="No scans yet"
        body="Run your first face scan to start a history you can compare over time."
        action={
          <Link href="/scan">
            <Button>
              <Camera className="h-4 w-4" />
              Start scan
            </Button>
          </Link>
        }
      />
    );
  }

  const active = scans.find((s) => s.id === selected) ?? scans[0];
  const scores = [...scans].reverse().map((s) => s.overallScore);
  const max = Math.max(...scores, 1);
  const min = Math.min(...scores, 0);
  const prev =
    scans.length > 1
      ? scans[scans.findIndex((s) => s.id === active.id) + 1]
      : null;
  const delta = prev ? active.overallScore - prev.overallScore : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        <Card elevated className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Score trend</p>
            <Badge tone="zinc">{scans.length} scans</Badge>
          </div>
          <div className="flex h-28 items-end gap-1.5">
            {scores.map((s, i) => {
              const h = ((s - min) / (max - min || 1)) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-emerald-600 to-teal-400 transition-all"
                  style={{ height: `${Math.max(12, h)}%` }}
                  title={`${s}`}
                />
              );
            })}
          </div>
        </Card>

        <ul className="space-y-2">
          {scans.map((s) => {
            const on = s.id === active.id;
            const d = new Date(s.createdAt);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition",
                    on
                      ? "border-emerald-200 bg-emerald-50/50 shadow-sm"
                      : "border-zinc-200/70 bg-white hover:border-zinc-300"
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold tabular-nums text-white">
                    {s.overallScore}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900">
                        {d.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <Badge tone="zinc">{s.source}</Badge>
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-xs text-zinc-500">
                      {s.summary}
                    </span>
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {d.toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Card elevated className="h-fit p-5 lg:sticky lg:top-20">
        <div className="flex flex-col items-center text-center">
          <ScoreRing score={active.overallScore} />
          <p className="mt-3 text-sm font-semibold">Selected scan</p>
          <p className="mt-1 text-xs text-zinc-500">
            {new Date(active.createdAt).toLocaleString()}
          </p>
          {delta != null && (
            <Badge tone={delta >= 0 ? "emerald" : "rose"} className="mt-2">
              {delta >= 0 ? "+" : ""}
              {delta} vs previous
            </Badge>
          )}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          {active.summary}
        </p>
        <div className="mt-4 space-y-2">
          {(active.metrics ?? []).slice(0, 6).map((m) => (
            <div
              key={m.id || m.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-zinc-500">{m.label}</span>
              <span className="font-semibold tabular-nums text-zinc-900">
                {m.score}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2">
          <Button
            className="w-full"
            type="button"
            onClick={() => router.push(`/dashboard?scanId=${active.id}`)}
          >
            Open in lab
          </Button>
          <Link
            href={`/chat?q=${encodeURIComponent(
              `Explain my scan from ${new Date(active.createdAt).toLocaleDateString()} with score ${active.overallScore}`
            )}`}
            className="block"
          >
            <Button className="w-full" variant="outline" type="button">
              Ask AI about this scan
            </Button>
          </Link>
          <Button
            className="w-full"
            variant="danger"
            type="button"
            disabled={deleting}
            onClick={() => void removeScan(active.id)}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete scan
          </Button>
        </div>
      </Card>
    </div>
  );
}
