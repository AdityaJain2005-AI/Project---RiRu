"use client";

import * as React from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Badge, Button, Card } from "./ui";

type Token = {
  raw: string;
  inci: string | null;
  status: "matched" | "fuzzy" | "unparsed";
};

type IngredientScan = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "rejected_quality";
  ocrText: string | null;
  parsed: Token[];
  confirmedText: string | null;
  imageStored: boolean;
  disclaimer: string;
};

type IngredientNote = {
  inci: string;
  functions: string[];
  plainDescription: string;
};

type Verdict = {
  verdict: "good_fit" | "caution" | "avoid";
  reasons: { ruleKey: string; message: string }[];
  unparsed: string[];
  ingredients?: IngredientNote[];
  rulesetVersion: string;
  disclaimer: string;
};

const VERDICT_LABEL: Record<Verdict["verdict"], string> = {
  good_fit: "Looks compatible with this profile",
  caution: "Caution",
  avoid: "Avoid based on this profile",
};

function errorMessage(json: unknown, fallback: string): string {
  if (
    json &&
    typeof json === "object" &&
    "error" in json &&
    json.error &&
    typeof json.error === "object" &&
    "message" in json.error &&
    typeof json.error.message === "string"
  ) {
    return json.error.message;
  }
  return fallback;
}

async function pollScan(id: string): Promise<IngredientScan> {
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    const res = await fetch(`/api/v1/ingredients/scans/${id}`, { cache: "no-store" });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(errorMessage(json, "The label check failed."));
    const scan = json as IngredientScan;
    if (scan.status === "queued" || scan.status === "running") {
      await new Promise((resolve) => setTimeout(resolve, 800));
      continue;
    }
    return scan;
  }
  throw new Error("The label is still being read. No ingredient list was invented.");
}

export function IngredientFlow() {
  const [ack, setAck] = React.useState(false);
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [storeImage, setStoreImage] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [scan, setScan] = React.useState<IngredientScan | null>(null);
  const [draft, setDraft] = React.useState("");
  const [usedImage, setUsedImage] = React.useState(false);
  const [verdict, setVerdict] = React.useState<Verdict | null>(null);

  const tokens = scan?.parsed ?? [];
  const showEditor = scan && scan.status !== "queued" && scan.status !== "running";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ack) {
      setError("Confirm the notice before a list or photo is sent.");
      return;
    }
    const typed = text.trim();
    if (!typed && !file) {
      setError("Type the list or choose a photo.");
      return;
    }
    if (file && file.size > 8 * 1024 * 1024) {
      setError("That photo is larger than 8 MB.");
      return;
    }
    setBusy(true);
    setError(null);
    setVerdict(null);
    setScan(null);
    const body = new FormData();
    body.set("disclaimerAck", "true");
    if (typed) {
      body.set("text", typed);
      setUsedImage(false);
    } else if (file) {
      body.set("image", file);
      body.set("storeImage", storeImage ? "true" : "false");
      setUsedImage(true);
    }
    try {
      const res = await fetch("/api/v1/ingredients/scan", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body,
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json, "The label check failed."));
      let next = json as IngredientScan;
      if (next.status === "queued" || next.status === "running") {
        next = await pollScan(next.id);
      }
      setScan(next);
      setDraft(next.ocrText ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The label check failed.");
    } finally {
      setBusy(false);
    }
  }

  async function checkText() {
    if (!scan || !ack) {
      setError("Confirm the notice before the list is checked.");
      return;
    }
    if (!draft.trim()) {
      setError("The ingredient list is empty.");
      return;
    }
    setBusy(true);
    setError(null);
    setVerdict(null);
    try {
      const patched = await fetch(`/api/v1/ingredients/scans/${scan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedText: draft }),
      });
      const patchJson: unknown = await patched.json().catch(() => null);
      if (!patched.ok) throw new Error(errorMessage(patchJson, "Could not save the text."));
      const saved = patchJson as IngredientScan;
      setScan(saved);
      const analyzed = await fetch("/api/v1/ingredients/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientScanId: saved.id, disclaimerAck: true }),
      });
      const verdictJson: unknown = await analyzed.json().catch(() => null);
      if (!analyzed.ok) throw new Error(errorMessage(verdictJson, "Could not check the list."));
      setVerdict(verdictJson as Verdict);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check the list.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <label className="flex items-start gap-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={ack}
              onChange={(event) => setAck(event.target.checked)}
            />
            <span>Informational only, not a medical diagnosis.</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-zinc-800">Ingredient list</span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={5}
              maxLength={8000}
              placeholder="Aqua, Glycerin, Niacinamide"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-400"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
              <ImagePlus className="h-4 w-4 text-emerald-600" />
              <span>{file ? file.name : "Photo of a label"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
              <span>Take a photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <label className="flex items-start gap-3 text-sm text-zinc-600">
            <input
              type="checkbox"
              className="mt-1"
              checked={storeImage}
              onChange={(event) => setStoreImage(event.target.checked)}
            />
            <span>Keep a copy of the photo. Off by default. If storage is unset, the photo is still discarded.</span>
          </label>
          <p className="text-xs leading-relaxed text-zinc-500">
            Typed text is used instead of a photo. A photo stays in memory for reading and is not saved unless you ask and storage is configured. A typed list does not need the photo service.
          </p>
          <Button type="submit" disabled={busy || !ack}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Read this list
          </Button>
        </form>
      </Card>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {showEditor && scan ? (
        <Card className="space-y-4 p-5">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-zinc-900">Check the text</h2>
            <p className="text-sm text-zinc-500">
              {scan.status === "failed"
                ? scan.ocrText
                  ? "The text was read, but the check did not finish. No list was invented. You can still edit it."
                  : "The label could not be read. No ingredient list was invented. You can type it here."
                : scan.status === "rejected_quality"
                  ? "Not enough text was read from the photo. Type the list instead. Nothing was invented."
                  : "Edit anything the reader got wrong, then check this text."}
            </p>
            {usedImage && !scan.imageStored ? (
              <p className="text-xs text-zinc-500">The photo was not kept.</p>
            ) : null}
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={6}
            maxLength={8000}
            className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-400"
          />
          {tokens.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tokens.map((token, index) => (
                <Badge
                  key={`${token.raw}-${index}`}
                  tone={token.status === "matched" ? "emerald" : token.status === "fuzzy" ? "amber" : "rose"}
                >
                  {token.status === "matched"
                    ? token.inci
                    : token.status === "fuzzy"
                      ? `${token.raw} → ${token.inci} (close spelling)`
                      : `${token.raw} (not in the catalog)`}
                </Badge>
              ))}
            </div>
          ) : null}
          <Button type="button" onClick={() => void checkText()} disabled={busy || !ack}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Check this text
          </Button>
          {verdict ? (
            <div className="space-y-3 border-t border-zinc-100 pt-4">
              <Badge tone={verdict.verdict === "avoid" ? "rose" : verdict.verdict === "caution" ? "amber" : "emerald"}>
                {VERDICT_LABEL[verdict.verdict]}
              </Badge>
              <p className="text-xs text-zinc-400">Rules {verdict.rulesetVersion}</p>
              {verdict.reasons.length > 0 ? (
                <ul className="space-y-2 text-sm text-zinc-700">
                  {verdict.reasons.map((reason) => (
                    <li key={`${reason.ruleKey}-${reason.message}`}>{reason.message}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-600">No conflict in this rule pack for the current profile.</p>
              )}
              {verdict.unparsed.length > 0 ? (
                <p className="text-sm text-zinc-600">
                  Not in the catalog: {verdict.unparsed.join(", ")}.
                </p>
              ) : null}
              {verdict.ingredients && verdict.ingredients.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-zinc-900">What these ingredients are used for</h3>
                  <ul className="space-y-3">
                    {verdict.ingredients.map((item) => (
                      <li key={item.inci} className="rounded-2xl bg-zinc-50 px-3 py-2">
                        <p className="text-sm font-medium text-zinc-900">{item.inci}</p>
                        <p className="text-xs text-zinc-500">Used as {item.functions.join(", ")}.</p>
                        <p className="text-sm text-zinc-700">{item.plainDescription}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="text-sm text-zinc-500">{verdict?.disclaimer ?? scan.disclaimer}</p>
        </Card>
      ) : null}
    </div>
  );
}
