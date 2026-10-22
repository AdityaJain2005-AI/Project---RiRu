"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { Badge, Button, Card, ScoreRing, cn } from "./ui";
import CaptureReview from "./cv/CaptureReview";

const FaceScan = dynamic(() => import("./cv/FaceScan"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center rounded-[1.75rem] bg-zinc-900 text-sm text-zinc-300">
      Loading MediaPipe face landmarker…
    </div>
  ),
});

type Step = "ready" | "analyzing" | "done";

type Review = {
  session: { frontImage?: File | null; leftImage?: File | null; rightImage?: File | null };
  views?: Record<string, { metadata?: { qualityScore?: number; yaw?: number } | null }>;
  isComplete: boolean;
  retake?: (view: string) => void;
};

export function ScanFlow() {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [step, setStep] = React.useState<Step>("ready");
  const [mode, setMode] = React.useState<"cv" | "upload">("cv");
  const [error, setError] = React.useState<string | null>(null);
  const [review, setReview] = React.useState<Review>({
    session: {},
    isComplete: false,
  });
  const [result, setResult] = React.useState<{
    id: string;
    overallScore: number;
    summary: string;
    metrics: { label: string; score: number }[];
  } | null>(null);

  const handleSession = React.useCallback((next: Review) => {
    setReview(next);
  }, []);

  async function analyze(source: "camera" | "upload", opts?: { fileName?: string }) {
    setError(null);
    setStep("analyzing");
    try {
      const qualities = Object.values(review.views ?? {})
        .map((v) => v.metadata?.qualityScore)
        .filter((n): n is number => typeof n === "number");
      const quality =
        qualities.length > 0
          ? qualities.reduce((a, b) => a + b, 0) / qualities.length
          : undefined;

      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          fileName: opts?.fileName,
          captured: source === "camera" && review.isComplete,
          cv: {
            views: ["front", "left", "right"].filter((v) => {
              const key = `${v}Image` as keyof Review["session"];
              return Boolean(review.session[key]);
            }),
            quality,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      setResult({
        id: json.scan.id,
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
    <div className="mx-auto max-w-3xl space-y-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void analyze("upload", { fileName: f.name });
          e.target.value = "";
        }}
      />

      <ol className="flex items-center justify-between gap-2">
        {["Landmarks", "3 views", "Analyze", "Results"].map((label, i) => {
          const idx =
            step === "done"
              ? 3
              : step === "analyzing"
                ? 2
                : review.isComplete
                  ? 1
                  : 0;
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
              <span
                className={cn(
                  "text-[10px] font-medium",
                  on ? "text-zinc-800" : "text-zinc-400"
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === "cv" ? "default" : "outline"}
          onClick={() => setMode("cv")}
        >
          MediaPipe face scan
        </Button>
        <Button
          size="sm"
          variant={mode === "upload" ? "default" : "outline"}
          onClick={() => setMode("upload")}
        >
          Upload photo
        </Button>
        <Link href="/product" className="ml-auto">
          <Button size="sm" variant="outline">
            Product OCR
          </Button>
        </Link>
      </div>

      {mode === "cv" && step !== "done" && (
        <FaceScan onScanSessionChange={handleSession} />
      )}

      {mode === "cv" && review.isComplete && step !== "done" && (
        <CaptureReview
          session={review.session}
          onRetake={review.retake}
          onContinue={() => void analyze("camera")}
        />
      )}

      {mode === "upload" && step !== "done" && (
        <Card elevated className="p-6">
          <p className="text-sm text-zinc-600">
            Skip the live landmarker and score a still photo. Best with even
            light and a front-facing face.
          </p>
          <Button
            size="lg"
            className="mt-4 w-full"
            onClick={() => fileRef.current?.click()}
            disabled={step === "analyzing"}
          >
            <Upload className="h-4 w-4" />
            Choose photo
          </Button>
        </Card>
      )}

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {step === "analyzing" && (
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-700">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          Scoring biomarkers from the captured views…
        </p>
      )}

      {step === "done" && result && (
        <Card elevated className="p-6">
          <div className="flex items-center gap-4">
            <ScoreRing score={result.overallScore} size={100} stroke={8} />
            <div className="min-w-0 flex-1">
              <Badge tone="emerald">
                <Sparkles className="h-3 w-3" />
                Saved to history
              </Badge>
              <p className="mt-1 text-sm font-semibold text-zinc-900">
                Score {result.overallScore}
              </p>
              <p className="mt-0.5 line-clamp-3 text-xs text-zinc-500">
                {result.summary}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
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
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              size="lg"
              className="w-full"
              onClick={() => router.push(`/dashboard?scanId=${result.id}`)}
            >
              Open in lab
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => {
                setResult(null);
                setReview({ session: {}, isComplete: false });
                setStep("ready");
              }}
            >
              Scan again
            </Button>
          </div>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-2xl border border-zinc-200/70 bg-white/80 px-4 py-3 text-xs text-zinc-500">
        <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        Live scan uses MediaPipe Face Landmarker in the browser (front / left /
        right). Ingredient labels live on{" "}
        <Link href="/product" className="text-emerald-700 hover:underline">
          Product OCR
        </Link>
        .
      </div>
    </div>
  );
}
