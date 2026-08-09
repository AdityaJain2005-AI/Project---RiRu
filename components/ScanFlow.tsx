"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { Badge, Button, Card, ScoreRing, cn } from "./ui";

type Step = "ready" | "capturing" | "analyzing" | "done";

export function ScanFlow() {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [step, setStep] = React.useState<Step>("ready");
  const [source, setSource] = React.useState<"camera" | "upload">("camera");
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    overallScore: number;
    summary: string;
    metrics: { label: string; score: number }[];
  } | null>(null);

  async function run(src: "camera" | "upload", fileName?: string) {
    setSource(src);
    setError(null);
    setStep("capturing");
    await new Promise((r) => setTimeout(r, 900));
    setStep("analyzing");
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: src, fileName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      setResult({
        overallScore: json.scan.overallScore,
        summary: json.scan.summary,
        metrics: (json.scan.metrics ?? []).map(
          (m: { label: string; score: number }) => ({
            label: m.label,
            score: m.score,
          })
        ),
      });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
      setStep("ready");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void run("upload", f.name);
          e.target.value = "";
        }}
      />

      {/* progress */}
      <ol className="flex items-center justify-between gap-2">
        {["Ready", "Capture", "Analyze", "Results"].map((label, i) => {
          const idx =
            step === "ready"
              ? 0
              : step === "capturing"
                ? 1
                : step === "analyzing"
                  ? 2
                  : 3;
          const on = i <= idx;
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold",
                  on ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-500"
                )}
              >
                {i < idx ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("text-[10px] font-medium", on ? "text-zinc-800" : "text-zinc-400")}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <Card elevated className="overflow-hidden p-0">
        <div className="relative aspect-[4/5] bg-gradient-to-b from-zinc-100 via-zinc-50 to-emerald-50/50">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative h-[72%] w-[62%]">
              <div className="absolute inset-0 rounded-[45%] bg-gradient-to-b from-stone-200/90 via-stone-100 to-stone-200/70 shadow-inner" />
              <div className="absolute left-[28%] top-[38%] h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
              <div className="absolute right-[28%] top-[38%] h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
              <div className="absolute inset-[10%] rounded-[42%] border border-dashed border-emerald-400/35" />
              {(step === "capturing" || step === "analyzing") && (
                <div className="absolute inset-x-4 top-[12%] h-0.5 animate-facelab-scan bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              )}
            </div>
          </div>
          {[
            "left-4 top-4 border-l-2 border-t-2",
            "right-4 top-4 border-r-2 border-t-2",
            "bottom-4 left-4 border-b-2 border-l-2",
            "bottom-4 right-4 border-b-2 border-r-2",
          ].map((p) => (
            <div key={p} className={cn("absolute h-7 w-7 rounded-sm border-emerald-500/70", p)} />
          ))}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/80 to-transparent px-5 pb-5 pt-16">
            {step === "ready" && (
              <p className="text-center text-sm text-zinc-600">
                Center your face in good light. We map 128 landmarks and save
                scores to your history.
              </p>
            )}
            {step === "capturing" && (
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-700">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                Capturing frame…
              </p>
            )}
            {step === "analyzing" && (
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-700">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                Reading hydration, barrier, tone…
              </p>
            )}
            {step === "done" && result && (
              <div className="flex items-center justify-center gap-4">
                <ScoreRing score={result.overallScore} size={100} stroke={8} />
                <div className="min-w-0 flex-1">
                  <Badge tone="emerald">Saved to history</Badge>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    Score {result.overallScore}
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-xs text-zinc-500">
                    {result.summary}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 p-5">
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          {step === "ready" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="lg"
                className="w-full"
                onClick={() => void run("camera")}
              >
                <Camera className="h-4 w-4" />
                Use camera mesh
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Upload photo
              </Button>
            </div>
          )}

          {(step === "capturing" || step === "analyzing") && (
            <Button size="lg" className="w-full" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Working…
            </Button>
          )}

          {step === "done" && result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {result.metrics.slice(0, 3).map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl bg-zinc-50 px-2 py-2 text-center ring-1 ring-zinc-100"
                  >
                    <p className="text-sm font-semibold tabular-nums">{m.score}</p>
                    <p className="text-[10px] text-zinc-400">{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button size="lg" className="w-full" onClick={() => router.push("/dashboard")}>
                  Open skin lab
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setResult(null);
                    setStep("ready");
                  }}
                >
                  Scan again
                </Button>
              </div>
              <p className="text-center text-xs text-zinc-400">
                Source: {source === "upload" ? "uploaded photo" : "camera mesh"} ·{" "}
                <Link href="/history" className="text-emerald-700 hover:underline">
                  View history
                </Link>
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-2xl border border-zinc-200/70 bg-white/80 px-4 py-3 text-xs text-zinc-500">
        <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        Demo mode generates biomarkers and stores them in PostgreSQL. No real
        camera stream is required — the mesh visualizes analysis progress.
      </div>
    </div>
  );
}
