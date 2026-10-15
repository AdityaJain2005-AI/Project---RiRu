"use client";

import * as React from "react";
import Link from "next/link";
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Upload,
  Video,
  VideoOff,
} from "lucide-react";
import { Badge, Button, Card, cn } from "./ui";

type Finding = {
  concern: string;
  severity: string;
  confidence: number;
  explanation: string;
  escalate: boolean;
  region: {
    zone: string;
    space: string;
    box: { x: number; y: number; w: number; h: number } | null;
  };
};

type ScanResult = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "rejected_quality";
  skinType: string | null;
  skinTypeConfidence: number | null;
  quality: { accepted: boolean; reasons: string[] } | null;
  findings: Finding[];
  summary: string;
  imageStored: boolean;
  disclaimer: string;
  escalation: string | null;
  warnings?: string[];
};

type Step = "ready" | "live" | "uploading" | "analyzing" | "done";

const REASONS: Record<string, string> = {
  no_face: "No face was detected.",
  multiple_faces: "More than one face was in the frame.",
  too_dark: "The photo is too dark.",
  too_bright: "The photo is too bright.",
  blurry: "The photo is blurry.",
  off_center: "The face is turned too far or not centered.",
  face_too_small: "Move closer so the face fills more of the frame.",
  clipped: "Part of the face is cut off.",
};

function previewHint(video: HTMLVideoElement | null): string {
  const prefix = "Preview only. The server decides.";
  if (!video || video.videoWidth === 0) return prefix;
  const canvas = document.createElement("canvas");
  const width = 80;
  const height = 80;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return prefix;
  ctx.drawImage(video, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0; i < width * height; i++) {
    const value = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    gray[i] = value;
    sum += value;
  }
  const mean = sum / (width * height);
  let energy = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = -4 * gray[i] + gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width];
      energy += lap * lap;
      count++;
    }
  }
  if (mean < 45) return `${prefix} This frame looks dark.`;
  if (mean > 210) return `${prefix} This frame looks bright.`;
  if (energy / count < 40) return `${prefix} This frame looks soft or blurry.`;
  return `${prefix} Lighting looks usable from here.`;
}

async function pollScan(id: string): Promise<ScanResult> {
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    const res = await fetch(`/api/v1/scans/${id}`, { cache: "no-store" });
    const json = (await res.json()) as ScanResult & { error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message || "Scan failed");
    if (json.status === "succeeded" || json.status === "rejected_quality" || json.status === "failed") {
      return json;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error("The scan is still running. Open history in a minute. No score was invented.");
}

export function ScanFlow() {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const previewRef = React.useRef<string | null>(null);
  const [step, setStep] = React.useState<Step>("ready");
  const [ack, setAck] = React.useState(false);
  const [storeImage, setStoreImage] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hint, setHint] = React.useState("Preview only. The server decides.");
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ScanResult | null>(null);

  React.useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (step !== "live") return;
    const id = window.setInterval(() => setHint(previewHint(videoRef.current)), 400);
    return () => window.clearInterval(id);
  }, [step]);

  function rememberPreview(blob: Blob) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(blob);
    previewRef.current = url;
    setPreviewUrl(url);
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function startCamera() {
    setError(null);
    if (!ack) {
      setError("Confirm the notice before the camera opens.");
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser has no camera. Upload a photo instead.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 900 } },
        audio: false,
      });
      streamRef.current = stream;
      setStep("live");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Camera permission was denied. You can upload a photo instead.");
    }
  }

  async function submit(blob: Blob, source: "camera" | "upload") {
    if (!ack) {
      setError("Confirm the notice before a photo is sent.");
      setStep("ready");
      return;
    }
    if (blob.size > 8 * 1024 * 1024) {
      setError("That photo is larger than 8 MB.");
      setStep("ready");
      return;
    }
    setError(null);
    setResult(null);
    rememberPreview(blob);
    setStep("uploading");
    const body = new FormData();
    body.set("image", blob, source === "camera" ? "frame.jpg" : "photo");
    body.set("source", source);
    body.set("disclaimerAck", "true");
    body.set("storeImage", storeImage ? "true" : "false");
    try {
      const res = await fetch("/api/v1/scans", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body,
      });
      const json = (await res.json()) as {
        scan?: { id: string };
        error?: { message?: string };
      };
      if (!res.ok || !json.scan?.id) {
        throw new Error(json.error?.message || "Scan failed");
      }
      setStep("analyzing");
      const scan = await pollScan(json.scan.id);
      setResult(scan);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setStep("ready");
    }
  }

  async function captureAndSubmit() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("The camera has no frame yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/jpeg", 0.85);
    });
    stopCamera();
    if (!blob) {
      setError("Could not read a frame from the camera.");
      setStep("ready");
      return;
    }
    await submit(blob, "camera");
  }

  function reset() {
    stopCamera();
    setResult(null);
    setError(null);
    setStep("ready");
  }

  const stepIndex =
    step === "ready" ? 0 : step === "live" || step === "uploading" ? 1 : step === "analyzing" ? 2 : 3;
  const boxes =
    result?.status === "succeeded"
      ? result.findings.filter((item) => item.severity !== "none" && item.region.box)
      : [];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (!ack) {
            setError("Confirm the notice before a photo is sent.");
            return;
          }
          void submit(file, "upload");
        }}
      />

      <Card className="space-y-3 p-4">
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={ack}
            onChange={(event) => setAck(event.target.checked)}
          />
          <span>I understand this is informational only, not a medical diagnosis.</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            className="mt-1"
            checked={storeImage}
            onChange={(event) => setStoreImage(event.target.checked)}
          />
          <span>
            Keep a private copy of this photo. Off by default. If storage is not configured, the
            photo is still discarded and the scan continues.
          </span>
        </label>
      </Card>

      <ol className="flex items-center justify-between gap-2">
        {["Ready", "Capture", "Analyze", "Results"].map((label, index) => {
          const on = index <= stepIndex;
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold",
                  on ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-500"
                )}
              >
                {index < stepIndex ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={cn("text-[10px] font-medium", on ? "text-zinc-800" : "text-zinc-400")}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <Card elevated className="overflow-hidden p-0">
        <div
          className={cn(
            "relative bg-gradient-to-b from-zinc-100 via-zinc-50 to-emerald-50/50",
            previewUrl && step !== "live" ? "min-h-48" : "aspect-[4/5]"
          )}
        >
          {step === "live" && (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {previewUrl && step !== "live" && (
            <img src={previewUrl} alt="Photo held in this browser" className="block h-auto w-full" />
          )}
          {boxes.length > 0 && previewUrl && step !== "live" && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
            >
              {boxes.map((item) =>
                item.region.box ? (
                  <rect
                    key={item.concern}
                    x={item.region.box.x}
                    y={item.region.box.y}
                    width={item.region.box.w}
                    height={item.region.box.h}
                    fill="none"
                    stroke="rgb(5, 150, 105)"
                    strokeWidth={0.008}
                  />
                ) : null
              )}
            </svg>
          )}
          {(step === "ready" || step === "live") && (
            <div className="pointer-events-none absolute inset-[14%] rounded-[46%] border border-dashed border-emerald-500/80" />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent px-5 pb-5 pt-16">
            {step === "ready" && (
              <p className="text-center text-sm text-zinc-600">
                Use the camera or a photo. The server checks the frame. This is not a measurement.
              </p>
            )}
            {step === "live" && <p className="text-center text-sm font-medium text-zinc-700">{hint}</p>}
            {(step === "uploading" || step === "analyzing") && (
              <p className="flex items-center justify-center gap-2 text-sm font-medium text-zinc-700">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                {step === "uploading" ? "Sending the photo…" : "Checking the photo…"}
              </p>
            )}
            {step === "done" && result && (
              <p className="text-center text-sm font-medium text-zinc-800">
                {result.status === "succeeded"
                  ? "Baseline visual estimate"
                  : result.status === "rejected_quality"
                    ? "Photo not accepted"
                    : "Analysis did not finish"}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3 p-5">
          {error && (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}

          {step === "ready" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="lg" className="w-full" onClick={() => void startCamera()}>
                <Video className="h-4 w-4" />
                Open live camera
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

          {step === "live" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="lg" className="w-full" onClick={() => void captureAndSubmit()}>
                <Camera className="h-4 w-4" />
                Capture and analyze
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

          {(step === "uploading" || step === "analyzing") && (
            <Button size="lg" className="w-full" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Working…
            </Button>
          )}

          {step === "done" && result && (
            <div className="space-y-3">
              {result.status === "succeeded" && result.skinType && (
                <p className="text-sm text-zinc-700">
                  Visual skin-type guess: <span className="font-semibold">{result.skinType}</span>
                  {result.skinTypeConfidence != null
                    ? ` (${Math.round(result.skinTypeConfidence * 100)}% confidence, capped at 55%)`
                    : ""}
                  . Sensitive skin is taken from your profile, not from the photo.
                </p>
              )}
              {result.warnings && result.warnings.length > 0 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {result.warnings.join(" ")}
                </p>
              )}
              {result.quality && !result.quality.accepted && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
                  {result.quality.reasons.map((reason) => (
                    <li key={reason}>{REASONS[reason] ?? reason}</li>
                  ))}
                </ul>
              )}
              <p className="text-sm leading-relaxed text-zinc-600">{result.summary}</p>
              {result.escalation && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {result.escalation}
                </p>
              )}
              {result.status === "succeeded" && (
                <ul className="space-y-2">
                  {result.findings
                    .filter((item) => item.severity !== "none" || item.concern === "acne")
                    .map((item) => (
                      <li key={item.concern} className="rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium capitalize text-zinc-900">
                            {item.concern.replaceAll("_", " ")}
                          </p>
                          <Badge tone={item.severity === "severe" ? "rose" : item.severity === "none" ? "zinc" : "emerald"}>
                            {item.severity}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.explanation}</p>
                      </li>
                    ))}
                </ul>
              )}
              <p className="text-xs text-zinc-500">
                {result.imageStored
                  ? "A private copy of the photo was stored."
                  : "The photo was not kept on the server. This preview stays in the browser until you leave."}
              </p>
              <p className="text-xs text-zinc-500">{result.disclaimer}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href={`/dashboard?scanId=${result.id}`}>
                  <Button size="lg" className="w-full">
                    Open in lab
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="w-full" onClick={reset}>
                  Scan again
                </Button>
              </div>
              <p className="text-center text-xs text-zinc-400">
                <Link href="/history" className="text-emerald-700 hover:underline">
                  History
                </Link>
                {" · "}
                <Link
                  href={`/chat?q=${encodeURIComponent("Explain my latest face estimate. Do not invent a score.")}`}
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
        The live hint is advisory. The server accepts or rejects the photo. There is no single
        0–100 score for this estimate.
      </div>
    </div>
  );
}
