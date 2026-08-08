"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Bell,
  Camera,
  ChevronRight,
  Droplets,
  Flame,
  Home,
  Leaf,
  Loader2,
  Menu,
  MessageCircle,
  ScanFace,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Upload,
  Waves,
  X,
} from "lucide-react";

// ─── types ───────────────────────────────────────────────────────────────────

type Metric = {
  id: string;
  label: string;
  score: number;
  delta: number;
  status: string;
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

type ChatMsg = { id?: string; role: "user" | "ai"; text: string };

type RoutineStep = { step: number; name: string; time: string; why: string };

type DashboardData = {
  user: {
    id: string;
    name: string;
    initials: string;
    skinType: string;
    streakDays: number;
  };
  scan: {
    id: string;
    overallScore: number;
    metrics: Metric[];
    concerns: Concern[];
    ingredients: Ingredient[];
    summary: string;
    source: string;
    createdAt: string;
    lastScanLabel: string;
  } | null;
  history: { score: number; date: string }[];
  messages: ChatMsg[];
  prefs: { routinePhase: "am" | "pm"; favorites: string[] };
  routine: { am: RoutineStep[]; pm: RoutineStep[] };
  notifications: {
    id: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
  }[];
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "concerns", label: "Concerns" },
  { id: "routine", label: "Routine" },
  { id: "ingredients", label: "Ingredients" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  hydration: Droplets,
  barrier: Shield,
  texture: Waves,
  clarity: Sparkles,
  elasticity: Activity,
  pigment: Sun,
};

// ─── utils / primitives ──────────────────────────────────────────────────────

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost" | "soft";
  size?: "default" | "sm" | "lg" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-500 active:scale-[0.98]",
        variant === "secondary" && "bg-zinc-900 text-white hover:bg-zinc-800",
        variant === "outline" &&
          "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
        variant === "ghost" && "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
        variant === "soft" && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-8 rounded-lg px-3 text-xs",
        size === "lg" && "h-12 rounded-2xl px-6 text-base",
        size === "icon" && "h-10 w-10",
        className
      )}
      {...props}
    />
  );
}

function Badge({
  className,
  tone = "zinc",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "zinc" | "emerald" | "teal" | "amber" | "rose";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "zinc" && "bg-zinc-100 text-zinc-600",
        tone === "emerald" && "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
        tone === "teal" && "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-100",
        tone === "amber" && "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100",
        tone === "rose" && "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100",
        className
      )}
      {...props}
    />
  );
}

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.03]",
        className
      )}
      {...props}
    />
  );
}

function ScoreRing({ score, size = 148, stroke = 10 }: { score: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-zinc-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#scoreGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold tracking-tight tabular-nums text-zinc-900">{score}</span>
        <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">Skin Score</span>
      </div>
    </div>
  );
}

function MetricBar({ label, score, delta, icon: Icon }: { label: string; score: number; delta: number; icon: React.ComponentType<{ className?: string }> }) {
  const tone = score >= 80 ? "bg-emerald-500" : score >= 70 ? "bg-teal-500" : "bg-amber-400";
  return (
    <div className="group space-y-2 rounded-xl p-3 transition-colors hover:bg-zinc-50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 group-hover:bg-white group-hover:text-emerald-600">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium text-zinc-700">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] font-medium tabular-nums", delta >= 0 ? "text-emerald-600" : "text-rose-500")}>
            {delta >= 0 ? "+" : ""}
            {delta}
          </span>
          <span className="text-sm font-semibold tabular-nums text-zinc-900">{score}</span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className={cn("h-full rounded-full transition-all duration-700", tone)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function FaceScanVisual({ scanning, score }: { scanning: boolean; score: number }) {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[280px] overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-zinc-100 via-zinc-50 to-emerald-50/40 ring-1 ring-zinc-200/80">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-[78%] w-[68%]">
          <div className="absolute inset-0 rounded-[45%] bg-gradient-to-b from-stone-200/90 via-stone-100 to-stone-200/70 shadow-inner" />
          <div className="absolute left-[28%] top-[38%] h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <div className="absolute right-[28%] top-[38%] h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <div className="absolute left-1/2 top-[52%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-teal-400/70" />
          <div className="absolute left-1/2 top-[64%] h-1 w-8 -translate-x-1/2 rounded-full bg-emerald-300/50" />
          <div className="absolute inset-[8%] rounded-[42%] border border-dashed border-emerald-400/30" />
        </div>
      </div>
      {[
        "left-4 top-4 border-l-2 border-t-2",
        "right-4 top-4 border-r-2 border-t-2",
        "bottom-4 left-4 border-b-2 border-l-2",
        "bottom-4 right-4 border-b-2 border-r-2",
      ].map((pos) => (
        <div key={pos} className={cn("absolute h-6 w-6 rounded-sm border-emerald-500/70", pos)} />
      ))}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-6 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.8)]",
          scanning ? "top-[12%] animate-facelab-scan" : "top-[42%] opacity-70"
        )}
      />
      <div className="absolute left-3 top-1/3 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-100">
        Live mesh
      </div>
      <div className="absolute bottom-[28%] right-3 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-teal-700 shadow-sm ring-1 ring-teal-100">
        Score {score}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/90 via-white/40 to-transparent px-4 pb-4 pt-10">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-medium text-zinc-600">
            <ScanFace className="h-3.5 w-3.5 text-emerald-600" />
            AI mesh · 128 pts
          </span>
          <Badge tone="emerald">{scanning ? "Scanning…" : "Live map"}</Badge>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points) - 2;
  const max = Math.max(...points) + 2;
  const w = 120;
  const h = 36;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / (max - min || 1)) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={coords} />
    </svg>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

export default function FacelabSkinDiagnosticDashboard() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState<TabId>("overview");
  const [routinePhase, setRoutinePhase] = React.useState<"am" | "pm">("am");
  const [scanning, setScanning] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [selectedConcern, setSelectedConcern] = React.useState<string>("pores");
  const [chatOpen, setChatOpen] = React.useState(true);
  const [draft, setDraft] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMsg[]>([]);
  const [mobileNav, setMobileNav] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [settingsForm, setSettingsForm] = React.useState({ name: "", skinType: "" });
  const [searchQ, setSearchQ] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const loadDashboard = React.useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      const json = (await res.json()) as DashboardData;
      setData(json);
      setMessages(json.messages ?? []);
      setRoutinePhase(json.prefs?.routinePhase ?? "am");
      setSettingsForm({
        name: json.user.name,
        skinType: json.user.skinType,
      });
      if (json.scan?.concerns?.[0]) setSelectedConcern(json.scan.concerns[0].id);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function runScan(source: "camera" | "upload", fileName?: string) {
    setScanning(true);
    setBusy("scan");
    try {
      // brief animation even if API is fast
      await new Promise((r) => setTimeout(r, 1600));
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, fileName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed");
      showToast(
        source === "upload"
          ? `Photo saved · score ${json.scan.overallScore}`
          : `Scan complete · score ${json.scan.overallScore}`
      );
      await loadDashboard();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
      setBusy(null);
    }
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? draft).trim();
    if (!text || busy === "chat") return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy("chat");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Chat failed");
      setMessages((m) => [...m, { role: "ai", text: json.message.text, id: json.message.id }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "ai", text: e instanceof Error ? e.message : "Could not reach cosmetologist." },
      ]);
    } finally {
      setBusy(null);
    }
  }

  async function changeRoutinePhase(phase: "am" | "pm") {
    setRoutinePhase(phase);
    setBusy("routine");
    try {
      await fetch("/api/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routinePhase: phase }),
      });
      showToast(`Routine set to ${phase === "am" ? "morning" : "night"}`);
    } finally {
      setBusy(null);
    }
  }

  async function toggleFavorite(ing: Ingredient) {
    const favorited = !ing.favorited;
    setBusy(`fav-${ing.name}`);
    try {
      await fetch("/api/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favoriteIngredient: { name: ing.name, favorited } }),
      });
      showToast(favorited ? `Saved ${ing.name}` : `Removed ${ing.name}`);
      await loadDashboard();
    } finally {
      setBusy(null);
    }
  }

  async function openNotifications() {
    setNotifOpen((v) => !v);
    setSettingsOpen(false);
    if (!notifOpen) {
      await fetch("/api/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markNotificationsRead: true }),
      });
      await loadDashboard();
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy("settings");
    try {
      const res = await fetch("/api/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settingsForm.name,
          skinType: settingsForm.skinType,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("Profile updated in database");
      setSettingsOpen(false);
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8F9] text-zinc-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
        Loading dashboard from database…
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F7F8F9] px-4 text-center">
        <p className="text-sm text-rose-600">{loadError || "No data"}</p>
        <Button onClick={() => { setLoading(true); void loadDashboard(); }}>Retry</Button>
      </div>
    );
  }

  const scan = data.scan;
  const score = scan?.overallScore ?? 0;
  const metrics = scan?.metrics ?? [];
  const concerns = scan?.concerns ?? [];
  const ingredients = (scan?.ingredients ?? []).filter(
    (i) =>
      !searchQ ||
      i.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      i.role.toLowerCase().includes(searchQ.toLowerCase())
  );
  const activeConcern = concerns.find((c) => c.id === selectedConcern) ?? concerns[0];
  const unread = data.notifications.filter((n) => !n.read).length;
  const historyScores = data.history.map((h) => h.score);

  return (
    <div className="min-h-screen bg-[#F7F8F9] text-zinc-900 antialiased">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void runScan("upload", f.name);
          e.target.value = "";
        }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-teal-100/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 rounded-2xl outline-none ring-emerald-500/30 focus-visible:ring-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25">
                <Leaf className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight">Facelab</h1>
                  <Badge tone="emerald">
                    <Sparkles className="h-3 w-3" />
                    Live · Postgres
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500">Diagnostic · Personal care OS</p>
              </div>
            </Link>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Link href="/" className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
              <Home className="h-4 w-4" />
              Home
            </Link>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  if (e.target.value) setTab("ingredients");
                }}
                placeholder="Search ingredients…"
                className="h-10 w-64 rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none ring-emerald-500/30 placeholder:text-zinc-400 focus:ring-2"
              />
            </div>
            <div className="relative">
              <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => void openNotifications()}>
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                )}
              </Button>
              {notifOpen && (
                <Card className="absolute right-0 z-30 mt-2 w-80 p-2 shadow-lg">
                  <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Notifications</p>
                  <ul className="max-h-72 overflow-y-auto">
                    {data.notifications.length === 0 && (
                      <li className="px-2 py-3 text-sm text-zinc-500">No notifications yet.</li>
                    )}
                    {data.notifications.map((n) => (
                      <li key={n.id} className="rounded-xl px-2 py-2 hover:bg-zinc-50">
                        <p className="text-sm font-medium text-zinc-800">{n.title}</p>
                        <p className="text-xs text-zinc-500">{n.body}</p>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
            <div className="relative">
              <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => { setSettingsOpen((v) => !v); setNotifOpen(false); }}>
                <Settings className="h-4 w-4" />
              </Button>
              {settingsOpen && (
                <Card className="absolute right-0 z-30 mt-2 w-80 p-4 shadow-lg">
                  <p className="text-sm font-semibold">Profile settings</p>
                  <p className="mb-3 text-xs text-zinc-500">Saved to PostgreSQL</p>
                  <form onSubmit={saveSettings} className="space-y-3">
                    <label className="block text-xs font-medium text-zinc-600">
                      Name
                      <input
                        className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                        value={settingsForm.name}
                        onChange={(e) => setSettingsForm((s) => ({ ...s, name: e.target.value }))}
                      />
                    </label>
                    <label className="block text-xs font-medium text-zinc-600">
                      Skin type
                      <select
                        className="mt-1 h-9 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
                        value={settingsForm.skinType}
                        onChange={(e) => setSettingsForm((s) => ({ ...s, skinType: e.target.value }))}
                      >
                        {["Combination", "Oily", "Dry", "Normal", "Sensitive"].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <Button type="submit" size="sm" className="w-full" disabled={busy === "settings"}>
                      {busy === "settings" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save to DB"}
                    </Button>
                  </form>
                </Card>
              )}
            </div>
            <div className="ml-1 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white py-1.5 pl-1.5 pr-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-600 text-xs font-semibold text-white">
                {data.user.initials}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-medium">{data.user.name}</p>
                <p className="text-[11px] text-zinc-500">{data.user.skinType} skin</p>
              </div>
            </div>
          </div>

          <Button variant="outline" size="icon" className="md:hidden" onClick={() => setMobileNav((v) => !v)} aria-label="Menu">
            {mobileNav ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </header>

        {mobileNav && (
          <Card className="mb-4 flex items-center justify-between p-3 md:hidden">
            <div>
              <p className="text-sm font-medium">{data.user.name}</p>
              <p className="text-[11px] text-zinc-500">{data.user.skinType} · {scan?.lastScanLabel}</p>
            </div>
            <Button size="sm" onClick={() => void runScan("camera")} disabled={!!busy}>
              <Camera className="h-3.5 w-3.5" />
              Scan
            </Button>
          </Card>
        )}

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="relative overflow-hidden p-5 sm:p-6">
            <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-emerald-100/50 blur-2xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md space-y-3">
                <Badge tone="teal">
                  <BadgeCheck className="h-3 w-3" />
                  {scan ? `Scan · ${scan.lastScanLabel}` : "No scans yet"}
                </Badge>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {score >= 75 ? (
                    <>
                      Your skin is trending{" "}
                      <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">healthier</span>
                    </>
                  ) : (
                    <>Let’s improve your skin score</>
                  )}
                </h2>
                <p className="text-sm leading-relaxed text-zinc-500">
                  {scan?.summary || "Run a face scan to generate biomarker scores stored in PostgreSQL."}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="lg" onClick={() => void runScan("camera")} disabled={!!busy}>
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    {scanning ? "Scanning…" : "New face scan"}
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => fileRef.current?.click()} disabled={!!busy}>
                    <Upload className="h-4 w-4" />
                    Upload photo
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3 pt-1 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    {data.user.streakDays}-day scan streak
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    {historyScores.length} scans in DB
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-3 self-center sm:self-start">
                <ScoreRing score={score} />
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-800">Live from Postgres</p>
                  <div className="mt-1 flex justify-center">
                    <Sparkline points={historyScores.length ? historyScores : [score]} />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">Score history</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Camera mesh</p>
                <p className="text-xs text-zinc-500">Runs scan → writes skin_scans row</p>
              </div>
              <Badge tone={scanning ? "teal" : "emerald"}>{scanning ? "Analyzing" : "Ready"}</Badge>
            </div>
            <FaceScanVisual scanning={scanning} score={score} />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { k: "Zones", v: String(concerns.length || 6) },
                { k: "Flags", v: String(concerns.length) },
                { k: "Score", v: String(score) },
              ].map((s) => (
                <div key={s.k} className="rounded-xl bg-zinc-50 px-2 py-2 text-center ring-1 ring-zinc-100">
                  <p className="text-sm font-semibold tabular-nums text-zinc-900">{s.v}</p>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-400">{s.k}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" className="inline-flex rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-sm font-medium transition-all sm:px-4",
                  tab === t.id ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button variant={chatOpen ? "soft" : "outline"} size="sm" onClick={() => setChatOpen((v) => !v)} className="hidden sm:inline-flex">
            <MessageCircle className="h-3.5 w-3.5" />
            AI Cosmetologist
          </Button>
        </div>

        <div className={cn("grid gap-5", chatOpen ? "xl:grid-cols-[1fr_340px]" : "grid-cols-1")}>
          <div className="space-y-5">
            {tab === "overview" && (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {metrics.map((m) => {
                    const Icon = ICON_MAP[m.id] ?? Activity;
                    return (
                      <Card key={m.id} className="p-2">
                        <MetricBar label={m.label} score={m.score} delta={m.delta} icon={Icon} />
                        <p className="px-3 pb-3 text-xs leading-relaxed text-zinc-500">{m.tip}</p>
                      </Card>
                    );
                  })}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Priority concerns</h3>
                        <p className="text-xs text-zinc-500">From latest scan row</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setTab("concerns")}>
                        View all <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <ul className="space-y-2">
                      {concerns.map((c) => (
                        <li key={c.id}>
                          <button
                            onClick={() => {
                              setSelectedConcern(c.id);
                              setTab("concerns");
                            }}
                            className="flex w-full items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
                          >
                            <div>
                              <p className="text-sm font-medium">{c.title}</p>
                              <p className="text-xs text-zinc-500">
                                {c.zone} · {c.severity}
                              </p>
                            </div>
                            <p className="text-xs font-semibold tabular-nums text-emerald-700">
                              {Math.round(c.confidence * 100)}%
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Top matched ingredients</h3>
                        <p className="text-xs text-zinc-500">Click to favorite in DB</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setTab("ingredients")}>
                        Full list <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ingredients.slice(0, 5).map((ing) => (
                        <button
                          key={ing.name}
                          onClick={() => void toggleFavorite(ing)}
                          className={cn(
                            "group inline-flex items-center gap-2 rounded-full border bg-white py-1.5 pl-1.5 pr-3 transition hover:border-emerald-300 hover:shadow-sm",
                            ing.favorited ? "border-emerald-300 bg-emerald-50/50" : "border-zinc-200"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
                              ing.tone === "emerald" ? "bg-emerald-500" : "bg-teal-500"
                            )}
                          >
                            {ing.match}
                          </span>
                          <span className="text-xs font-medium text-zinc-700">{ing.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 p-4 text-white shadow-lg shadow-emerald-600/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-emerald-100">Tonight’s focus</p>
                          <p className="mt-1 text-sm font-semibold leading-snug">
                            Barrier seal + light brightening — open PM routine from DB prefs.
                          </p>
                        </div>
                        <Target className="h-5 w-5 shrink-0 text-emerald-100" />
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3 bg-white text-emerald-800 hover:bg-emerald-50"
                        onClick={() => {
                          void changeRoutinePhase("pm");
                          setTab("routine");
                        }}
                      >
                        Open PM routine <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                </div>
              </>
            )}

            {tab === "concerns" && activeConcern && (
              <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <Card className="h-fit p-2">
                  {concerns.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConcern(c.id)}
                      className={cn(
                        "flex w-full flex-col rounded-xl px-3 py-3 text-left transition",
                        selectedConcern === c.id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
                      )}
                    >
                      <span className="text-sm font-medium">{c.title}</span>
                      <span className={cn("mt-0.5 text-xs", selectedConcern === c.id ? "text-zinc-400" : "text-zinc-500")}>
                        {c.zone} · {c.severity}
                      </span>
                    </button>
                  ))}
                </Card>
                <Card className="p-5 sm:p-6">
                  <Badge tone={activeConcern.severity === "Moderate" ? "amber" : "emerald"}>
                    <AlertCircle className="h-3 w-3" />
                    {activeConcern.severity} severity
                  </Badge>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">{activeConcern.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Detected on <span className="font-medium text-zinc-700">{activeConcern.zone}</span>. Confidence{" "}
                    <span className="font-medium tabular-nums text-zinc-700">
                      {Math.round(activeConcern.confidence * 100)}%
                    </span>
                    .
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {ingredients.slice(0, 3).map((ing) => (
                      <Badge key={ing.name} tone={ing.tone}>
                        {ing.name}
                      </Badge>
                    ))}
                    <Button
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        void sendMessage(`Help me treat ${activeConcern.title} on my ${activeConcern.zone}`);
                        setChatOpen(true);
                        setTab("overview");
                      }}
                    >
                      Ask AI for plan <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {tab === "routine" && (
              <Card className="p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Personalized routine</h3>
                    <p className="text-xs text-zinc-500">Phase preference stored in user_prefs</p>
                  </div>
                  <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-50 p-1">
                    {(["am", "pm"] as const).map((phase) => (
                      <button
                        key={phase}
                        onClick={() => void changeRoutinePhase(phase)}
                        className={cn(
                          "rounded-lg px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
                          routinePhase === phase ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                        )}
                      >
                        {phase === "am" ? "☀ Morning" : "☾ Night"}
                      </button>
                    ))}
                  </div>
                </div>
                <ol className="space-y-3">
                  {(data.routine[routinePhase] ?? []).map((step, idx) => (
                    <li key={step.step} className="flex gap-4 rounded-2xl border border-zinc-100 bg-white p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-sm font-bold text-white">
                        {step.step}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-zinc-900">{step.name}</p>
                          <Badge tone="zinc">{step.time}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">{step.why}</p>
                      </div>
                      {idx === 0 && <Badge tone="emerald">Start here</Badge>}
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-100">
                  <p className="text-sm text-zinc-600">
                    <span className="font-medium text-zinc-900">Tip:</span> Wait 60s between serum and cream.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => { setChatOpen(true); void sendMessage("Tweak my PM routine for 5 minutes"); }}>
                    <MessageCircle className="h-3.5 w-3.5" />
                    Ask AI to tweak
                  </Button>
                </div>
              </Card>
            )}

            {tab === "ingredients" && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ingredients.map((ing) => (
                  <Card key={ing.name} className="group p-5 transition hover:border-emerald-200">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white",
                          ing.tone === "emerald"
                            ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                            : "bg-gradient-to-br from-teal-500 to-teal-600"
                        )}
                      >
                        {ing.match}
                      </div>
                      <Badge tone={ing.tone}>{ing.role}</Badge>
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-zinc-900">{ing.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      Match score from your latest scan biomarkers.
                    </p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={cn("h-full rounded-full", ing.tone === "emerald" ? "bg-emerald-500" : "bg-teal-500")}
                        style={{ width: `${ing.match}%` }}
                      />
                    </div>
                    <Button
                      variant={ing.favorited ? "soft" : "ghost"}
                      size="sm"
                      className="mt-3 w-full justify-between px-0 hover:bg-transparent"
                      onClick={() => void toggleFavorite(ing)}
                      disabled={busy === `fav-${ing.name}`}
                    >
                      {ing.favorited ? "Saved in DB ★" : "Save to favorites"}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Card>
                ))}
                {ingredients.length === 0 && (
                  <p className="text-sm text-zinc-500">No ingredients match “{searchQ}”.</p>
                )}
              </div>
            )}
          </div>

          {chatOpen && (
            <Card className="flex h-fit flex-col overflow-hidden xl:sticky xl:top-4">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">AI Cosmetologist</p>
                    <p className="text-[11px] text-zinc-500">Messages saved to chat_messages</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChatOpen(false)} aria-label="Close chat">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto p-4">
                {messages.map((msg, i) => (
                  <div
                    key={msg.id ?? i}
                    className={cn(
                      "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "ai"
                        ? "self-start rounded-tl-md bg-zinc-100 text-zinc-700"
                        : "self-end rounded-tr-md bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                    )}
                  >
                    {msg.text}
                  </div>
                ))}
                {busy === "chat" && (
                  <div className="flex items-center gap-2 self-start text-xs text-zinc-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                  </div>
                )}
              </div>
              <div className="border-t border-zinc-100 p-3">
                <div className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
                    placeholder="Ask about routine, SPF, actives…"
                    className="h-10 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-emerald-500/30 focus:bg-white focus:ring-2"
                  />
                  <Button size="icon" onClick={() => void sendMessage()} disabled={busy === "chat"} aria-label="Send">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["Why is hydration low?", "Swap my cleanser", "Travel kit"].map((q) => (
                    <button
                      key={q}
                      onClick={() => void sendMessage(q)}
                      className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600 hover:border-emerald-300 hover:text-emerald-700"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-20 flex h-14 items-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white shadow-xl"
          >
            <MessageCircle className="h-4 w-4 text-emerald-400" />
            Chat with AI
          </button>
        )}
      </div>
    </div>
  );
}
