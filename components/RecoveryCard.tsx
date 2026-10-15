"use client";

import * as React from "react";
import { Card } from "./ui";

type Recovery = {
  active: boolean;
  procedureType: string | null;
  procedureOn: string | null;
  clinicianOverridesApp: string | null;
  removedActives: string[];
  disclaimer: string;
};

const TYPES = ["laser", "peel", "microneedling", "other"] as const;

export function RecoveryCard() {
  const [state, setState] = React.useState<Recovery | null>(null);
  const [procedureType, setProcedureType] = React.useState<(typeof TYPES)[number]>("laser");
  const [procedureOn, setProcedureOn] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetch("/api/v1/profile/recovery-mode", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: Recovery) => {
        setState(json);
        if (json.procedureType && TYPES.includes(json.procedureType as (typeof TYPES)[number])) {
          setProcedureType(json.procedureType as (typeof TYPES)[number]);
        }
        if (json.procedureOn) setProcedureOn(json.procedureOn);
      })
      .catch(() => setError("Could not load recovery mode."));
  }, []);

  async function save(active: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/profile/recovery-mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          active,
          procedureType,
          procedureOn: procedureOn || null,
          clinicianNote: note,
        }),
      });
      const json = (await res.json()) as Recovery & { error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message || "Could not save recovery mode.");
      setState(json);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recovery mode.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-5 p-4">
      <h2 className="text-sm font-semibold text-zinc-900">After a procedure</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Turn this on after laser, a peel, or microneedling. The list then leaves out acids, retinoids, and benzoyl peroxide. Your clinician&apos;s note is saved and is not shown again on this page.
      </p>
      {state?.active && state.clinicianOverridesApp ? (
        <p className="mt-2 text-xs text-emerald-800">{state.clinicianOverridesApp}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-zinc-600">
          Procedure
          <select
            className="mt-1 block rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm"
            value={procedureType}
            onChange={(event) => setProcedureType(event.target.value as (typeof TYPES)[number])}
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Date
          <input
            type="date"
            className="mt-1 block rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
            value={procedureOn}
            onChange={(event) => setProcedureOn(event.target.value)}
          />
        </label>
        <label className="min-w-48 flex-1 text-xs text-zinc-600">
          Clinician note
          <input
            className="mt-1 block w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
            value={note}
            maxLength={500}
            placeholder="Saved privately. Not shown after you save."
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save(true)}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Turn on
        </button>
        <button
          type="button"
          disabled={busy || !state?.active}
          onClick={() => void save(false)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50"
        >
          Turn off
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
      {state ? <p className="mt-2 text-[11px] text-zinc-400">{state.disclaimer}</p> : null}
    </Card>
  );
}
