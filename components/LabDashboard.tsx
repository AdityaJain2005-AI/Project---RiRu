"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  Bell,
  Camera,
  ChevronRight,
  Droplets,
  Loader2,
  MessageCircle,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Upload,
  Waves,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ScoreRing,
  Skeleton,
  cn,
} from "./ui";

type Metric = {
  id: string;
  label: string;
  score: number;
  delta: number;
  tip: string;
};
type Concern = {
  id: string;
  title: string;
  severity: string;
  zone: string;
  confidence: number;
};
type Ingredient = {
  name: string;
  role: string;
  match: number;
  tone: "emerald" | "teal";
  favorited?: boolean;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  hydration: Droplets,
  barrier: Shield,
  texture: Waves,
  clarity: Sparkles,
  elasticity: Activity,
  pigment: Sun,
};

export function LabDashboard() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"overview" | "concerns" | "ingredients">(
    "overview"
  );
  const [busy, setBusy] = React.useState(false);
  const [data, setData] = React.useState<{
    user: { name: string; initials: string; skinType: string; streakDays: number };
    scan: {
      overallScore: number;
      metrics: Metric[];
      concerns: Concern[];
      ingredients: Ingredient[];
      summary: string;
      lastScanLabel: string;
    } | null;
    history: { score: number }[];
    notifications: { id: string; title: string; body: string; read: boolean }[];
  } | null>(null);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", skinType: "" });
  const [selectedConcern, setSelectedConcern] = React.useState<string | null>(
    null
  );
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setData({
        user: json.user,
        scan: json.scan,
        history: json.history,
        notifications: json.notifications,
      });
      setForm({ name: json.user.name, skinType: json.user.skinType });
      if (json.scan?.concerns?.[0])
        setSelectedConcern(json.scan.concerns[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }

  async function scan(source: "camera" | "upload", fileName?: string) {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, fileName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      flash(`Scan saved · score ${json.scan.overallScore}`);
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFav(ing: Ingredient) {
    await fetch("/api/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        favoriteIngredient: { name: ing.name, favorited: !ing.favorited },
      }),
    });
    flash(ing.favorited ? `Removed ${ing.name}` : `Saved ${ing.name}`);
    await load();
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    flash("Profile updated");
    setSettingsOpen(false);
    await load();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Lab couldn’t load"
        body={error || "Unknown error"}
        action={<Button onClick={() => { setLoading(true); void load(); }}>Retry</Button>}
      />
    );
  }

  const scanData = data.scan;
  const score = scanData?.overallScore ?? 0;
  const metrics = scanData?.metrics ?? [];
  const concerns = scanData?.concerns ?? [];
  const ingredients = scanData?.ingredients ?? [];
  const active =
    concerns.find((c) => c.id === selectedConcern) ?? concerns[0];
  const unread = data.notifications.filter((n) => !n.read).length;

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void scan("upload", f.name);
          e.target.value = "";
        }}
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-xl md:bottom-8">
          {toast}
        </div>
      )}

      <PageHeader
        eyebrow="Skin lab"
        title={`${data.user.name.split(" ")[0]}’s diagnostics`}
        description={
          scanData
            ? `${scanData.lastScanLabel} · ${data.user.skinType} skin · ${data.user.streakDays}-day streak`
            : "Run a scan to unlock biomarkers and concerns."
        }
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  setNotifOpen((v) => !v);
                  setSettingsOpen(false);
                  if (!notifOpen) {
                    await fetch("/api/prefs", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ markNotificationsRead: true }),
                    });
                    await load();
                  }
                }}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500" />
                )}
              </Button>
              {notifOpen && (
                <Card className="absolute right-0 z-20 mt-2 w-80 p-2 shadow-lg">
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Notifications
                  </p>
                  {data.notifications.length === 0 && (
                    <p className="px-2 py-3 text-sm text-zinc-500">All clear.</p>
                  )}
                  {data.notifications.map((n) => (
                    <div key={n.id} className="rounded-xl px-2 py-2 hover:bg-zinc-50">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-zinc-500">{n.body}</p>
                    </div>
                  ))}
                </Card>
              )}
            </div>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSettingsOpen((v) => !v);
                  setNotifOpen(false);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              {settingsOpen && (
                <Card className="absolute right-0 z-20 mt-2 w-80 p-4 shadow-lg">
                  <p className="mb-3 text-sm font-semibold">Profile</p>
                  <form onSubmit={saveProfile} className="space-y-3">
                    <label className="block text-xs font-medium text-zinc-600">
                      Name
                      <input
                        className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                        value={form.name}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, name: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block text-xs font-medium text-zinc-600">
                      Skin type
                      <select
                        className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm"
                        value={form.skinType}
                        onChange={(e) =>
                          setForm((s) => ({ ...s, skinType: e.target.value }))
                        }
                      >
                        {["Combination", "Oily", "Dry", "Normal", "Sensitive"].map(
                          (t) => (
                            <option key={t}>{t}</option>
                          )
                        )}
                      </select>
                    </label>
                    <Button type="submit" size="sm" className="w-full">
                      Save
                    </Button>
                  </form>
                </Card>
              )}
            </div>
            <Link href="/scan">
              <Button disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Scan
              </Button>
            </Link>
          </div>
        }
      />

      {!scanData ? (
        <EmptyState
          title="No scan data yet"
          body="Start with a face scan so the lab can show scores, concerns, and ingredient matches."
          action={
            <Link href="/scan">
              <Button>
                <Camera className="h-4 w-4" />
                Start scan
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card elevated className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <Badge tone="teal">Latest · {scanData.lastScanLabel}</Badge>
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    Overall skin score{" "}
                    <span className="text-emerald-600">{score}</span>
                  </h2>
                  <p className="max-w-md text-sm leading-relaxed text-zinc-500">
                    {scanData.summary}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void scan("camera")}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Quick rescan
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Photo
                    </Button>
                    <Link href="/chat">
                      <Button size="sm" variant="soft">
                        <MessageCircle className="h-3.5 w-3.5" />
                        Ask AI
                      </Button>
                    </Link>
                  </div>
                </div>
                <ScoreRing score={score} />
              </div>
            </Card>

            <Card elevated className="p-5">
              <p className="mb-3 text-sm font-semibold">Score history</p>
              <div className="flex h-24 items-end gap-1.5">
                {(data.history.length
                  ? data.history.map((h) => h.score)
                  : [score]
                ).map((s, i, arr) => {
                  const min = Math.min(...arr) - 2;
                  const max = Math.max(...arr) + 2;
                  const h = ((s - min) / (max - min || 1)) * 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-emerald-600 to-teal-400"
                      style={{ height: `${Math.max(14, h)}%` }}
                    />
                  );
                })}
              </div>
              <div className="mt-4 flex justify-between text-xs text-zinc-400">
                <span>{data.history.length} scans in DB</span>
                <Link href="/history" className="font-medium text-emerald-700 hover:underline">
                  Full history
                </Link>
              </div>
            </Card>
          </div>

          <div className="mb-4 inline-flex rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
            {(
              [
                ["overview", "Overview"],
                ["concerns", "Concerns"],
                ["ingredients", "Ingredients"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-medium transition",
                  tab === id
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.map((m) => {
                const Icon = ICONS[m.id] ?? Activity;
                const tone =
                  m.score >= 80
                    ? "bg-emerald-500"
                    : m.score >= 70
                      ? "bg-teal-500"
                      : "bg-amber-400";
                return (
                  <Card key={m.id} className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {m.label}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        <span
                          className={cn(
                            "mr-1.5 text-[11px]",
                            m.delta >= 0 ? "text-emerald-600" : "text-rose-500"
                          )}
                        >
                          {m.delta >= 0 ? "+" : ""}
                          {m.delta}
                        </span>
                        {m.score}
                      </span>
                    </div>
                    <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={cn("h-full rounded-full", tone)}
                        style={{ width: `${m.score}%` }}
                      />
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-500">{m.tip}</p>
                  </Card>
                );
              })}
            </div>
          )}

          {tab === "concerns" && active && (
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <Card className="h-fit p-2">
                {concerns.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConcern(c.id)}
                    className={cn(
                      "flex w-full flex-col rounded-xl px-3 py-3 text-left",
                      selectedConcern === c.id
                        ? "bg-zinc-900 text-white"
                        : "hover:bg-zinc-50"
                    )}
                  >
                    <span className="text-sm font-medium">{c.title}</span>
                    <span
                      className={cn(
                        "text-xs",
                        selectedConcern === c.id
                          ? "text-zinc-400"
                          : "text-zinc-500"
                      )}
                    >
                      {c.zone} · {c.severity}
                    </span>
                  </button>
                ))}
              </Card>
              <Card elevated className="p-5">
                <Badge
                  tone={active.severity === "Moderate" ? "amber" : "emerald"}
                >
                  {active.severity}
                </Badge>
                <h3 className="mt-2 text-xl font-semibold">{active.title}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Primarily on the {active.zone}. Model confidence{" "}
                  {Math.round(active.confidence * 100)}%.
                </p>
                <Link href="/chat" className="mt-5 inline-block">
                  <Button>
                    Ask AI for a plan
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </Card>
            </div>
          )}

          {tab === "ingredients" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ingredients.map((ing) => (
                <Card key={ing.name} className="p-4">
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white",
                        ing.tone === "emerald" ? "bg-emerald-500" : "bg-teal-500"
                      )}
                    >
                      {ing.match}
                    </span>
                    <Badge tone={ing.tone}>{ing.role}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{ing.name}</p>
                  <Button
                    size="sm"
                    variant={ing.favorited ? "soft" : "outline"}
                    className="mt-3 w-full"
                    onClick={() => void toggleFav(ing)}
                  >
                    {ing.favorited ? "Saved ★" : "Save ingredient"}
                  </Button>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/routine">
              <Button variant="outline">Open routine checklist</Button>
            </Link>
            <Link href="/history">
              <Button variant="ghost">View all history</Button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
