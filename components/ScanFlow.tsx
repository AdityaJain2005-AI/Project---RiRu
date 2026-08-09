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
  Video,
  VideoOff,
} from "lucide-react";
import { Badge, Button, Card, ScoreRing, cn } from "./ui";

type Step = "ready" | "live" | "capturing" | "analyzing" | "done";

export function ScanFlow() {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [step, setStep] = React.useState<Step>("ready");
  const [source, setSource] = React.useState<"camera" | "upload">("camera");
  const [error, setError] = React.useState<string | null>(null);
  const [camError, setCamError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    id: string;
    overallScore: number;
    summary: string;
    metrics: { label: string; score: number }[];
  } | null>(null);

  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    setCamError(null);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError("Camera not available in this browser — use mesh or upload.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 900 } },
        audio: false,
      });
      streamRef.current = stream;
      setStep("live");
      // attach after paint
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCamError("Camera permission denied — use mesh scan or upload a photo.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function captureFrame(): {
    captured: boolean;
    imageMeta?: { width: number; height: number; bytes: number };
  } {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return { captured: false };
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { captured: false };
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    return {
      captured: true,
      imageMeta: {
        width: canvas.width,
        height: canvas.height,
        bytes: Math.round((dataUrl.length * 3) / 4),
      },
    };
  }

  async function run(
    src: "camera" | "upload",
    opts?: { fileName?: string; fromLive?: boolean }
  ) {
    setSource(src);
    setError(null);
    setStep("capturing");

    let captured = false;
    let imageMeta: { width?: number; height?: number; bytes?: number } | undefined;

    if (opts?.fromLive) {
      const frame = captureFrame();
      captured = frame.captured;
      imageMeta = frame.imageMeta;
      stopCamera();
    }

    await new Promise((r) => setTimeout(r, 700));
    setStep("analyzing");
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: src,
          fileName: opts?.fileName,
          captured,
          imageMeta,
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
    <div className="mx-auto max-w-lg space-y-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void run("upload", { fileName: f.name });
          e.target.value = "";
        }}
      />

      <ol className="flex items-center justify-between gap-2">
        {["Ready", "Capture", "Analyze", "Results"].map((label, i) => {
          const idx =
            step === "ready"
              ? 0
              : step === "live" || step === "capturing"
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

      <Card elevated className="overflow-hidden p-0">
        <div className="relative aspect-[4/5] bg-gradient-to-b from-zinc-100 via-zinc-50 to-emerald-50/50">
          {/* live camera */}
          {step === "live" && (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {step !== "live" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-[72%] w-[62%]">
                <div className="absolute inset-0 rounded-[45%] bg-gradient-to-b from-stone-200/90 via-stone-100 to-stone-200/70 shadow-inner" />
                <div className="absolute left-[28%] top-[38%] h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
                <div className="absolute right-[28%] top-[38%] h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
                <div className="absolute inset-[10%] rounded-[42%] border border-dashed border-emerald-400/35" />
                {(step === "capturing" || step === "analyzing") && (
                  <div className="absolute inset-x-4 top-[12%] h-0.5 animate-facelab-scan bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
                )}
              </div>
            </div>
          )}

          {[
            "left-4 top-4 border-l-2 border-t-2",
            "right-4 top-4 border-r-2 border-t-2",
            "bottom-4 left-4 border-b-2 border-l-2",
            "bottom-4 right-4 border-b-2 border-r-2",
          ].map((p) => (
            <div
              key={p}
              className={cn("absolute h-7 w-7 rounded-sm border-emerald-500/70", p)}
            />
          ))}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/85 to-transparent px-5 pb-5 pt-16">
            {step === "ready" && (
              <p className="text-center text-sm text-zinc-600">
                Use your real camera, mesh preview, or a photo. Scores save to
                history.
              </p>
            )}
            {step === "live" && (
              <p className="text-center text-sm font-medium text-zinc-700">
                Align your face · then capture
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
          {(error || camError) && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error || camError}
            </p>
          )}

          {step === "ready" && (
            <div className="grid gap-2">
              <Button size="lg" className="w-full" onClick={() => void startCamera()}>
                <Video className="h-4 w-4" />
                Open live camera
              </Button>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={() => void run("camera")}
                >
                  <Camera className="h-4 w-4" />
                  Mesh scan
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
            </div>
          )}

          {step === "live" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="lg"
                className="w-full"
                onClick={() => void run("camera", { fromLive: true })}
              >
                <Camera className="h-4 w-4" />
                Capture & analyze
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => {
                  stopCamera();
                  setStep("ready");
                }}
              >
                <VideoOff className="h-4 w-4" />
                Cancel camera
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
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() =>
                    router.push(`/dashboard?scanId=${result.id}`)
                  }
                >
                  Open in lab
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
                Source: {source}
                {" · "}
                <Link href="/history" className="text-emerald-700 hover:underline">
                  History
                </Link>
                {" · "}
                <Link
                  href={`/chat?q=${encodeURIComponent("Explain my latest scan results")}`}
                  className="text-emerald-700 hover:underline"
                >
                  Ask AI
                </Link>
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-2xl border border-zinc-200/70 bg-white/80 px-4 py-3 text-xs text-zinc-500">
        <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        Live camera captures a real frame for metadata; biomarkers are analyzed
        and stored in PostgreSQL. Works without a camera via mesh or upload.
      </div>
    </div>
  );
}
