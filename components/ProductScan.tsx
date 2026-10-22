"use client";

import * as React from "react";
import { FlaskConical, Loader2, Upload } from "lucide-react";
import { Badge, Button, Card, cn } from "./ui";
import type { IngredientDetail } from "@/lib/ocr";

export function ProductScan() {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = React.useState("");
  const [preview, setPreview] = React.useState<string | null>(null);
  const [raw, setRaw] = React.useState("");
  const [busy, setBusy] = React.useState<"ocr" | "parse" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ingredients, setIngredients] = React.useState<string[]>([]);
  const [details, setDetails] = React.useState<IngredientDetail[] | null>(null);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function runOcr(file: File) {
    setBusy("ocr");
    setError(null);
    setIngredients([]);
    setDetails(null);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const text = data.text?.trim() ?? "";
      setRaw(text);
      if (!text) throw new Error("No text found — try a sharper label photo.");
      await parse(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR failed");
      setBusy(null);
    }
  }

  async function parse(text: string) {
    setBusy("parse");
    setError(null);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, save: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parse failed");
      setIngredients(json.ingredients ?? []);
      setDetails(json.details ?? null);
      setRaw(json.raw ?? text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card elevated className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Ingredient label OCR
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Tesseract runs in the browser. We split the INCI list and score
              each name against a local dictionary (same logic as the old Flask
              scanner).
            </p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (preview) URL.revokeObjectURL(preview);
            setPreview(URL.createObjectURL(f));
            void runOcr(f);
            e.target.value = "";
          }}
        />

        <Button
          size="lg"
          className="w-full"
          disabled={Boolean(busy)}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "ocr" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {busy === "ocr" ? "Reading label…" : "Upload ingredients photo"}
        </Button>

        {preview && (
          <img
            src={preview}
            alt="Label preview"
            className="max-h-56 w-full rounded-xl object-contain ring-1 ring-zinc-100"
          />
        )}

        <label className="block text-xs font-medium text-zinc-500">
          Or paste the INCI list
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={4}
            className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-800 outline-none ring-emerald-500/30 focus:ring-2"
            placeholder="Water, Glycerin, Niacinamide, …"
          />
        </label>
        <Button
          variant="outline"
          className="w-full"
          disabled={Boolean(busy) || !pasted.trim()}
          onClick={() => void parse(pasted)}
        >
          {busy === "parse" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Parse text
        </Button>
      </Card>

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {ingredients.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {ingredients.length} ingredients
            </h3>
            <Badge tone="emerald">Saved to lab history</Badge>
          </div>
          {details ? (
            <ul className="mt-4 space-y-2">
              {details.map((d) => (
                <li
                  key={d.name}
                  className={cn(
                    "rounded-xl border-l-4 bg-zinc-50 px-3 py-2",
                    d.rating === "good" && "border-emerald-500",
                    d.rating === "neutral" && "border-zinc-300",
                    d.rating === "caution" && "border-amber-500"
                  )}
                >
                  <p className="text-sm font-medium text-zinc-900">{d.name}</p>
                  <p className="text-xs text-zinc-500">{d.function}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    {d.concern}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ingredients.map((i) => (
                <Badge key={i}>{i}</Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      {raw && !ingredients.length && !busy && (
        <pre className="overflow-auto rounded-xl bg-zinc-900 p-4 text-xs text-zinc-100">
          {raw}
        </pre>
      )}
    </div>
  );
}
