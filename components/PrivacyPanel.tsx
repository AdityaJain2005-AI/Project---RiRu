"use client";

import * as React from "react";
import { Card } from "./ui";

export function PrivacyPanel() {
  const [deleteAfter, setDeleteAfter] = React.useState<boolean | null>(null);
  const [confirm, setConfirm] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    void fetch("/api/v1/privacy/image-retention", { cache: "no-store" })
      .then((res) => res.json())
      .then((json: { deleteAfterAnalysis?: boolean }) => setDeleteAfter(Boolean(json.deleteAfterAnalysis)))
      .catch(() => setError("Could not load privacy settings."));
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/privacy/image-retention", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deleteAfterAnalysis: next }),
      });
      const json = (await res.json()) as { deleteAfterAnalysis?: boolean; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message || "Could not save the image setting.");
      setDeleteAfter(Boolean(json.deleteAfterAnalysis));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the image setting.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/me/export", { cache: "no-store" });
      if (!res.ok) {
        const json = (await res.json()) as { error?: { message?: string } };
        throw new Error(json.error?.message || "Could not export this account.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "riru-export.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Export downloaded. It includes your clinician note. It does not include photo bytes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export this account.");
    } finally {
      setBusy(false);
    }
  }

  async function wipe() {
    if (confirm !== "delete my data") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/me/data", {
        method: "DELETE",
        headers: { "idempotency-key": crypto.randomUUID() },
      });
      const json = (await res.json()) as { requestId?: string; error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message || "Could not delete this account.");
      setMessage(`Deleted. Receipt ${json.requestId}.`);
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6 p-4">
      <h2 className="text-sm font-semibold">Your data</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Photos are removed after analysis unless you turn that off. Export is a JSON file of this account. Delete removes scans, chat, routines, and notes.
      </p>
      <label className="mt-3 flex items-start gap-2 text-xs text-zinc-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={deleteAfter !== false}
          disabled={busy || deleteAfter === null}
          onChange={(event) => void toggle(event.target.checked)}
        />
        <span>Delete photos after analysis. On by default.</span>
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void download()}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-800"
        >
          Export my data
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
          value={confirm}
          placeholder="type delete my data"
          onChange={(event) => setConfirm(event.target.value)}
        />
        <button
          type="button"
          disabled={busy || confirm !== "delete my data"}
          onClick={() => void wipe()}
          className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40"
        >
          Delete my data
        </button>
      </div>
      {message ? <p className="mt-2 text-xs text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </Card>
  );
}
