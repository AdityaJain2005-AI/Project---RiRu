"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Badge, Button, Card } from "./ui";

type Budget = "low" | "mid" | "high";
type Period = "am" | "pm" | "weekly";
type StepKind = "cleanser" | "treatment" | "moisturizer" | "spf" | "extra";

type Product = {
  id: string;
  name: string;
  brand: string;
  stepKind: StepKind;
  budget: Budget;
  description: string;
  why: string;
};

type Step = {
  period: Period;
  position: number;
  kind: StepKind;
  title: string;
  instructions: string;
  why: string;
  caution: string | null;
  product: Product | null;
  alternatives: Product[];
};

type Routine = {
  id: string;
  summary: string;
  recoveryActive: boolean;
  clinicianOverridesApp: string | null;
  steps: Step[];
  lifestyle: string[];
  disclaimer: string;
};

type Price = {
  id: string;
  priceCents: number;
  currency: string;
  url: string;
};

type Alternative = {
  product: Product;
  score: number;
  why: string;
};

const PERIOD_LABEL: Record<Period, string> = {
  am: "Morning",
  pm: "Night",
  weekly: "Weekly",
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

function dollarsToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const parts = trimmed.split(".");
  const whole = Number(parts[0]);
  const frac = parts[1] ?? "";
  const padded = `${frac}00`.slice(0, 2);
  const cents = whole * 100 + Number(padded);
  if (!Number.isSafeInteger(cents) || cents > 2_000_000_000) return null;
  return cents;
}

function formatMoney(cents: number, currency: string): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const frac = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${whole}.${frac} ${currency}`;
}

function ProductBlock({ product }: { product: Product }) {
  const [openPrices, setOpenPrices] = React.useState(false);
  const [openSimilar, setOpenSimilar] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("USD");
  const [link, setLink] = React.useState("");
  const [prices, setPrices] = React.useState<Price[] | null>(null);
  const [similar, setSimilar] = React.useState<Alternative[] | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function loadPrices() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/v1/products/${product.id}/prices`, { cache: "no-store" });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json, "Could not load prices."));
      const rows = (json as { prices?: Price[] }).prices;
      setPrices(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not load prices.");
    } finally {
      setBusy(false);
    }
  }

  async function savePrice(event: React.FormEvent) {
    event.preventDefault();
    const priceCents = dollarsToCents(amount);
    if (priceCents === null) {
      setNote("Enter a price with up to two decimal places. Zero is allowed.");
      return;
    }
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
      setNote("Currency is three letters, such as USD.");
      return;
    }
    if (!link.trim()) {
      setNote("Paste the page link you copied.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/v1/products/${product.id}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceCents,
          currency: currency.trim().toUpperCase(),
          url: link.trim(),
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json, "Could not save the price."));
      setAmount("");
      setLink("");
      await loadPrices();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save the price.");
      setBusy(false);
    }
  }

  async function loadSimilar() {
    if (similar) {
      setOpenSimilar(true);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/v1/products/${product.id}/alternatives`, {
        cache: "no-store",
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json, "Could not list similar examples."));
      const rows = (json as { alternatives?: Alternative[] }).alternatives;
      setSimilar(Array.isArray(rows) ? rows : []);
      setOpenSimilar(true);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not list similar examples.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-zinc-900">{product.name}</p>
        <Badge tone="zinc">{product.budget}</Badge>
        <Badge tone="emerald">{product.stepKind}</Badge>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{product.brand}</p>
      <p className="mt-2 text-sm text-zinc-600">{product.description}</p>
      {product.why ? <p className="mt-1 text-sm text-zinc-500">{product.why}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const next = !openPrices;
            setOpenPrices(next);
            if (next && prices === null) void loadPrices();
          }}
        >
          Paste a price
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void loadSimilar()}>
          Similar examples
        </Button>
      </div>
      {openPrices ? (
        <form onSubmit={(event) => void savePrice(event)} className="mt-3 space-y-2">
          <p className="text-xs leading-relaxed text-zinc-500">
            Paste a price you saw. This app stores it for you and does not open the link or look up a shop.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              aria-label="Price"
              className="w-28 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-400"
            />
            <input
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              maxLength={3}
              aria-label="Currency"
              className="w-20 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm uppercase text-zinc-900 outline-none focus:border-emerald-400"
            />
            <input
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://"
              aria-label="Link you copied"
              className="min-w-[12rem] flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-400"
            />
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save price
          </Button>
          {prices && prices.length === 0 ? (
            <p className="text-xs text-zinc-500">No price saved for this example yet.</p>
          ) : null}
          {prices && prices.length > 0 ? (
            <ul className="space-y-1 text-sm text-zinc-700">
              {prices.map((price) => (
                <li key={price.id}>
                  {formatMoney(price.priceCents, price.currency)}{" "}
                  <a
                    href={price.url}
                    className="text-emerald-700 underline"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open the link you saved
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      ) : null}
      {openSimilar && similar ? (
        <ul className="mt-3 space-y-2">
          {similar.length === 0 ? (
            <li className="text-xs text-zinc-500">No other example in this step passed the filters.</li>
          ) : (
            similar.map((item) => (
              <li key={item.product.id} className="text-sm text-zinc-600">
                <span className="font-medium text-zinc-800">{item.product.name}</span>
                <span className="text-zinc-500">
                  {" "}
                  · overlap {item.score.toFixed(2)} · {item.why}
                </span>
              </li>
            ))
          )}
          <li className="text-xs text-zinc-500">
            Overlap of ingredient names (jaccard_v1). This is not a measured match.
          </li>
        </ul>
      ) : null}
      {note ? <p className="mt-2 text-sm text-rose-700">{note}</p> : null}
    </div>
  );
}

export function RecommendationPanel() {
  const [ack, setAck] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [routine, setRoutine] = React.useState<Routine | null>(null);

  async function build() {
    if (!ack) {
      setError("Confirm the notice before a list is built.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disclaimerAck: true }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorMessage(json, "Could not build the list."));
      setRoutine(json as Routine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the list.");
    } finally {
      setBusy(false);
    }
  }

  const periods: Period[] = ["am", "pm", "weekly"];

  return (
    <section className="mb-10 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">From your latest scan</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">
          Builds a short list from your latest succeeded face scan and your profile. Example
          products are formulas in this catalog, not shop listings. A rejected photo does not count.
        </p>
      </div>
      <Card className="space-y-3 p-4">
        <label className="flex items-start gap-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={ack}
            onChange={(event) => setAck(event.target.checked)}
          />
          <span>Informational only, not a medical diagnosis.</span>
        </label>
        <Button type="button" onClick={() => void build()} disabled={busy || !ack}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Build from latest scan
        </Button>
      </Card>
      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}
      {routine ? (
        <div className="space-y-4">
          <Card className="space-y-2 p-4">
            <p className="text-sm leading-relaxed text-zinc-700">{routine.summary}</p>
            {routine.clinicianOverridesApp ? (
              <p className="text-sm leading-relaxed text-amber-900">{routine.clinicianOverridesApp}</p>
            ) : null}
            {routine.lifestyle.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                {routine.lifestyle.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </Card>
          {periods.map((period) => {
            const steps = routine.steps.filter((step) => step.period === period);
            if (steps.length === 0) return null;
            return (
              <div key={period} className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {PERIOD_LABEL[period]}
                </h3>
                {steps.map((step) => (
                  <Card key={`${step.period}-${step.position}`} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-zinc-900">
                        {step.position}. {step.title}
                      </p>
                      <Badge tone="zinc">{step.kind}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">{step.instructions}</p>
                    <p className="mt-1 text-sm text-zinc-500">{step.why}</p>
                    {step.caution ? (
                      <p className="mt-2 text-sm text-amber-900">{step.caution}</p>
                    ) : null}
                    {step.product ? (
                      <ProductBlock product={step.product} />
                    ) : (
                      <p className="mt-2 text-sm text-zinc-500">No example product on this step.</p>
                    )}
                    {step.alternatives.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Other budget tiers
                        </p>
                        <ul className="mt-1 space-y-1">
                          {step.alternatives.map((item) => (
                            <li key={item.id} className="text-sm text-zinc-600">
                              {item.name} · {item.budget}
                              {item.why ? ` · ${item.why}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            );
          })}
          <p className="text-xs text-zinc-500">{routine.disclaimer}</p>
        </div>
      ) : null}
    </section>
  );
}
