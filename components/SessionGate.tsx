"use client";

import { useEffect, useState } from "react";

let sessionPromise: Promise<void> | null = null;

function ensureSession(): Promise<void> {
  if (!sessionPromise) {
    sessionPromise = fetch("/api/v1/session", { method: "POST" }).then(async (res) => {
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message || "Could not start a session.");
      }
      window.location.reload();
    });
  }
  return sessionPromise;
}

export function SessionGate({
  needsSession,
  children,
}: {
  needsSession: boolean;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!needsSession) return;
    let cancelled = false;
    ensureSession().catch((err: unknown) => {
      if (cancelled) return;
      sessionPromise = null;
      setError(err instanceof Error ? err.message : "Could not start a session.");
    });
    return () => {
      cancelled = true;
    };
  }, [needsSession]);

  if (!needsSession) return children;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <p className="text-sm font-medium text-zinc-800">
          {error ? "This browser could not start a private session." : "Starting a private session on this browser."}
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          {error ??
            "Core features work without an account. Photos are not stored. This is not a medical diagnosis."}
        </p>
      </div>
    </div>
  );
}
