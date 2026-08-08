"use client";

/**
 * Facelab — Skin Diagnostic Dashboard
 * Single-file, copy-pasteable client component.
 *
 * Stack: Next.js App Router · Tailwind CSS · shadcn/ui (Nova) · Lucide · TypeScript
 * Vibe: Zinc neutrals · Emerald/Teal accents · clean health-tech AI dashboard
 *
 * Drop into: app/dashboard/page.tsx  →  <FacelabSkinDiagnosticDashboard />
 * Requires: lucide-react, clsx, tailwind-merge (or swap cn for a simple join)
 */

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

// ─── utils ───────────────────────────────────────────────────────────────────

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// ─── mock data ───────────────────────────────────────────────────────────────

const USER = {
  name: "Maya Chen",
  initials: "MC",
  skinType: "Combination",
  lastScan: "Today · 9:42 AM",
  streakDays: 12,
};

const OVERALL_SCORE = 78;

const METRICS = [
  {
    id: "hydration",
    label: "Hydration",
    score: 72,
    delta: +4,
    status: "good" as const,
    icon: Droplets,
    tip: "Slightly below optimal. Layer a humectant serum AM/PM.",
  },
  {
    id: "barrier",
    label: "Barrier",
    score: 81,
    delta: +6,
    status: "excellent" as const,
    icon: Shield,
    tip: "Ceramide levels look strong. Keep your current moisturizer.",
  },
  {
    id: "texture",
    label: "Texture",
    score: 68,
    delta: -2,
    status: "fair" as const,
    icon: Waves,
    tip: "Mild roughness on cheeks. Gentle exfoliation 2×/week.",
  },
  {
    id: "clarity",
    label: "Clarity",
    score: 74,
    delta: +8,
    status: "good" as const,
    icon: Sparkles,
    tip: "Post-inflammatory marks fading. Stay consistent with niacinamide.",
  },
  {
    id: "elasticity",
    label: "Elasticity",
    score: 85,
    delta: +3,
    status: "excellent" as const,
    icon: Activity,
    tip: "Firmness is excellent for your age group. Maintain SPF daily.",
  },
  {
    id: "pigment",
    label: "Even Tone",
    score: 63,
    delta: +1,
    status: "fair" as const,
    icon: Sun,
    tip: "UV-related unevenness on T-zone. Boost antioxidant serum.",
  },
];

const CONCERNS = [
  {
    id: "pores",
    title: "Enlarged pores",
    severity: "Mild",
    zone: "T-zone",
    confidence: 0.91,
    color: "emerald",
  },
  {
    id: "dryness",
    title: "Dehydration lines",
    severity: "Moderate",
    zone: "Cheeks",
    confidence: 0.86,
    color: "teal",
  },
  {
    id: "spots",
    title: "Post-acne marks",
    severity: "Mild",
    zone: "Jawline",
    confidence: 0.78,
    color: "amber",
  },
];

const INGREDIENTS = [
  { name: "Niacinamide 5%", role: "Brighten", match: 96, tone: "emerald" as const },
  { name: "Hyaluronic Acid", role: "Hydrate", match: 94, tone: "teal" as const },
  { name: "Ceramide NP", role: "Barrier", match: 91, tone: "emerald" as const },
  { name: "Azelaic Acid 10%", role: "Calm", match: 88, tone: "teal" as const },
  { name: "Vitamin C 15%", role: "Antioxidant", match: 85, tone: "emerald" as const },
  { name: "Peptide Complex", role: "Firm", match: 82, tone: "teal" as const },
];

const ROUTINE = {
  am: [
    { step: 1, name: "Gentle Gel Cleanser", time: "30s", why: "pH-balanced, non-stripping" },
    { step: 2, name: "Niacinamide Serum", time: "2 drops", why: "Pores + barrier support" },
    { step: 3, name: "Lightweight Moisturizer", time: "pea size", why: "Lock hydration" },
    { step: 4, name: "SPF 50 Mineral", time: "2 fingers", why: "UV + pigmentation defense" },
  ],
  pm: [
    { step: 1, name: "Oil Cleanser", time: "60s", why: "Remove SPF & sebum" },
    { step: 2, name: "Hydrating Toner", time: "pat in", why: "Prep for actives" },
    { step: 3, name: "Azelaic Treatment", time: "thin layer", why: "Marks + calm redness" },
    { step: 4, name: "Ceramide Cream", time: "pea size", why: "Overnight barrier repair" },
  ],
};

const CHAT = [
  {
    role: "ai" as const,
    text: "Your barrier score jumped +6 this week — great recovery after that travel dry-out. Want me to tweak tonight’s routine for your humidity drop?",
  },
  {
    role: "user" as const,
    text: "Yes, keep it simple. I only have 5 minutes PM.",
  },
  {
    role: "ai" as const,
    text: "Done. Swapped double-cleanse → single gel cleanse, kept azelaic 3×/week, and added a 2-min mask on Sundays. Hydration should hit 80+ in ~10 days.",
  },
];

const HISTORY = [
  { date: "Aug 1", score: 71 },
  { date: "Aug 3", score: 73 },
  { date: "Aug 5", score: 74 },
  { date: "Aug 6", score: 76 },
  { date: "Aug 7", score: 75 },
  { date: "Aug 8", score: 78 },
];

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "concerns", label: "Concerns" },
  { id: "routine", label: "Routine" },
  { id: "ingredients", label: "Ingredients" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── primitives (Nova-style shadcn) ──────────────────────────────────────────

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
        variant === "secondary" &&
          "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]",
        variant === "outline" &&
          "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 active:scale-[0.98]",
        variant === "ghost" && "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
        variant === "soft" &&
          "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-[0.98]",
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

function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
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

// ─── visual widgets ──────────────────────────────────────────────────────────

function ScoreRing({
  score,
  size = 148,
  stroke = 10,
  label = "Skin Score",
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-zinc-100"
        />
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
        <span className="text-4xl font-semibold tracking-tight text-zinc-900 tabular-nums">
          {score}
        </span>
        <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </span>
      </div>
    </div>
  );
}

function MetricBar({
  label,
  score,
  delta,
  icon: Icon,
}: {
  label: string;
  score: number;
  delta: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tone =
    score >= 80 ? "bg-emerald-500" : score >= 70 ? "bg-teal-500" : "bg-amber-400";

  return (
    <div className="group space-y-2 rounded-xl p-3 transition-colors hover:bg-zinc-50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-white group-hover:text-emerald-600">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium text-zinc-700">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums",
              delta >= 0 ? "text-emerald-600" : "text-rose-500"
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta}
          </span>
          <span className="text-sm font-semibold tabular-nums text-zinc-900">{score}</span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={cn("h-full rounded-full transition-all duration-700", tone)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function FaceScanVisual({ scanning }: { scanning: boolean }) {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-[280px] overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-zinc-100 via-zinc-50 to-emerald-50/40 ring-1 ring-zinc-200/80">
      {/* soft face silhouette */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-[78%] w-[68%]">
          <div className="absolute inset-0 rounded-[45%] bg-gradient-to-b from-stone-200/90 via-stone-100 to-stone-200/70 shadow-inner" />
          {/* facial landmarks */}
          <div className="absolute left-[28%] top-[38%] h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <div className="absolute right-[28%] top-[38%] h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <div className="absolute left-1/2 top-[52%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-teal-400/70" />
          <div className="absolute left-1/2 top-[64%] h-1 w-8 -translate-x-1/2 rounded-full bg-emerald-300/50" />
          {/* grid lines */}
          <div className="absolute inset-[8%] rounded-[42%] border border-dashed border-emerald-400/30" />
          <div className="absolute inset-x-[18%] top-[30%] border-t border-emerald-400/20" />
          <div className="absolute inset-x-[18%] top-[55%] border-t border-emerald-400/20" />
          <div className="absolute inset-y-[22%] left-1/2 border-l border-emerald-400/20" />
        </div>
      </div>

      {/* corner brackets */}
      {[
        "left-4 top-4 border-l-2 border-t-2",
        "right-4 top-4 border-r-2 border-t-2",
        "bottom-4 left-4 border-b-2 border-l-2",
        "bottom-4 right-4 border-b-2 border-r-2",
      ].map((pos) => (
        <div
          key={pos}
          className={cn("absolute h-6 w-6 rounded-sm border-emerald-500/70", pos)}
        />
      ))}

      {/* scan beam */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-6 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.8)]",
          scanning ? "top-[12%] animate-facelab-scan" : "top-[42%] opacity-70"
        )}
      />

      {/* floating tags */}
      <div className="absolute left-3 top-1/3 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-100 backdrop-blur">
        Pores · mild
      </div>
      <div className="absolute bottom-[28%] right-3 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-teal-700 shadow-sm ring-1 ring-teal-100 backdrop-blur">
        Hydration 72
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/90 via-white/40 to-transparent px-4 pb-4 pt-10">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 font-medium text-zinc-600">
            <ScanFace className="h-3.5 w-3.5 text-emerald-600" />
            AI mesh · 128 pts
          </span>
          <Badge tone="emerald">Live map</Badge>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points) - 2;
  const max = Math.max(...points) + 2;
  const w = 120;
  const h = 36;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / (max - min)) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        fill="none"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
      {points.map((p, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - ((p - min) / (max - min)) * h;
        if (i !== points.length - 1) return null;
        return <circle key={i} cx={x} cy={y} r="3" fill="#10b981" className="drop-shadow" />;
      })}
    </svg>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function FacelabSkinDiagnosticDashboard() {
  const [tab, setTab] = React.useState<TabId>("overview");
  const [routinePhase, setRoutinePhase] = React.useState<"am" | "pm">("am");
  const [scanning, setScanning] = React.useState(false);
  const [selectedConcern, setSelectedConcern] = React.useState(CONCERNS[0].id);
  const [chatOpen, setChatOpen] = React.useState(true);
  const [draft, setDraft] = React.useState("");
  const [messages, setMessages] = React.useState(CHAT);
  const [mobileNav, setMobileNav] = React.useState(false);

  const activeConcern = CONCERNS.find((c) => c.id === selectedConcern) ?? CONCERNS[0];

  function startScan() {
    setScanning(true);
    window.setTimeout(() => setScanning(false), 2600);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      {
        role: "ai",
        text: "Noted. I’ll factor that into your next scan comparison and flag any product conflicts in your PM stack.",
      },
    ]);
    setDraft("");
  }

  return (
    <div className="min-h-screen bg-[#F7F8F9] text-zinc-900 antialiased">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -right-24 top-40 h-80 w-80 rounded-full bg-teal-100/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-2xl outline-none ring-emerald-500/30 focus-visible:ring-2"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25">
                <Leaf className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight">Facelab</h1>
                  <Badge tone="emerald">
                    <Sparkles className="h-3 w-3" />
                    AI Skin Lab
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500">Diagnostic · Personal care OS</p>
              </div>
            </Link>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                placeholder="Search ingredients, routines…"
                className="h-10 w-64 rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none ring-emerald-500/30 placeholder:text-zinc-400 focus:ring-2"
              />
            </div>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
            <div className="ml-1 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white py-1.5 pl-1.5 pr-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-600 text-xs font-semibold text-white">
                {USER.initials}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-medium">{USER.name}</p>
                <p className="text-[11px] text-zinc-500">{USER.skinType} skin</p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileNav((v) => !v)}
            aria-label="Menu"
          >
            {mobileNav ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </header>

        {/* mobile strip */}
        {mobileNav && (
          <Card className="mb-4 flex items-center justify-between p-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-xs font-semibold text-white">
                {USER.initials}
              </div>
              <div>
                <p className="text-sm font-medium">{USER.name}</p>
                <p className="text-[11px] text-zinc-500">{USER.skinType} · {USER.lastScan}</p>
              </div>
            </div>
            <Button size="sm" onClick={startScan}>
              <Camera className="h-3.5 w-3.5" />
              Scan
            </Button>
          </Card>
        )}

        {/* ── Hero strip ─────────────────────────────────────────────────── */}
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="relative overflow-hidden p-5 sm:p-6">
            <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-10 rounded-full bg-emerald-100/50 blur-2xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md space-y-3">
                <Badge tone="teal">
                  <BadgeCheck className="h-3 w-3" />
                  Scan complete · {USER.lastScan}
                </Badge>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Your skin is trending{" "}
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                    healthier
                  </span>
                </h2>
                <p className="text-sm leading-relaxed text-zinc-500">
                  AI cosmetologist mapped 128 facial landmarks. Barrier and clarity improved;
                  hydration and even tone still have room to grow this cycle.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="lg" onClick={startScan}>
                    <Camera className="h-4 w-4" />
                    {scanning ? "Scanning…" : "New face scan"}
                  </Button>
                  <Button variant="outline" size="lg">
                    <Upload className="h-4 w-4" />
                    Upload photo
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3 pt-1 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    {USER.streakDays}-day scan streak
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    +7 pts vs last week
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-3 self-center sm:self-start">
                <ScoreRing score={OVERALL_SCORE} />
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-800">Good · Improving</p>
                  <div className="mt-1 flex justify-center">
                    <Sparkline points={HISTORY.map((h) => h.score)} />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">7-day trajectory</p>
                </div>
              </div>
            </div>
          </Card>

          {/* scan preview card */}
          <Card className="flex flex-col p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Camera mesh</p>
                <p className="text-xs text-zinc-500">Real-time diagnostic overlay</p>
              </div>
              <Badge tone={scanning ? "teal" : "emerald"}>
                {scanning ? "Analyzing" : "Ready"}
              </Badge>
            </div>
            <FaceScanVisual scanning={scanning} />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { k: "Zones", v: "6" },
                { k: "Flags", v: "3" },
                { k: "Conf.", v: "94%" },
              ].map((s) => (
                <div
                  key={s.k}
                  className="rounded-xl bg-zinc-50 px-2 py-2 text-center ring-1 ring-zinc-100"
                >
                  <p className="text-sm font-semibold tabular-nums text-zinc-900">{s.v}</p>
                  <p className="text-[10px] uppercase tracking-wide text-zinc-400">{s.k}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            className="inline-flex rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-sm font-medium transition-all sm:px-4",
                  tab === t.id
                    ? "bg-zinc-900 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button
            variant={chatOpen ? "soft" : "outline"}
            size="sm"
            onClick={() => setChatOpen((v) => !v)}
            className="hidden sm:inline-flex"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            AI Cosmetologist
          </Button>
        </div>

        {/* ── Main grid ──────────────────────────────────────────────────── */}
        <div
          className={cn(
            "grid gap-5",
            chatOpen ? "xl:grid-cols-[1fr_340px]" : "grid-cols-1"
          )}
        >
          <div className="space-y-5">
            {/* OVERVIEW */}
            {tab === "overview" && (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {METRICS.map((m) => (
                    <Card key={m.id} className="p-2">
                      <MetricBar
                        label={m.label}
                        score={m.score}
                        delta={m.delta}
                        icon={m.icon}
                      />
                      <p className="px-3 pb-3 text-xs leading-relaxed text-zinc-500">{m.tip}</p>
                    </Card>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Priority concerns</h3>
                        <p className="text-xs text-zinc-500">Ranked by AI confidence</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setTab("concerns")}>
                        View all
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <ul className="space-y-2">
                      {CONCERNS.map((c) => (
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
                            <div className="text-right">
                              <p className="text-xs font-semibold tabular-nums text-emerald-700">
                                {Math.round(c.confidence * 100)}%
                              </p>
                              <p className="text-[10px] text-zinc-400">confidence</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <Card className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Top matched ingredients</h3>
                        <p className="text-xs text-zinc-500">For your biomarker profile</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setTab("ingredients")}>
                        Full list
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {INGREDIENTS.slice(0, 5).map((ing) => (
                        <button
                          key={ing.name}
                          onClick={() => setTab("ingredients")}
                          className="group inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 pl-1.5 pr-3 transition hover:border-emerald-300 hover:shadow-sm"
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
                              ing.tone === "emerald" ? "bg-emerald-500" : "bg-teal-500"
                            )}
                          >
                            {ing.match}
                          </span>
                          <span className="text-xs font-medium text-zinc-700 group-hover:text-zinc-900">
                            {ing.name}
                          </span>
                          <Badge tone="zinc" className="!px-1.5 !py-0">
                            {ing.role}
                          </Badge>
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 p-4 text-white shadow-lg shadow-emerald-600/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-emerald-100">Tonight’s focus</p>
                          <p className="mt-1 text-sm font-semibold leading-snug">
                            Barrier seal + light brightening — skip retinoid (recovery window).
                          </p>
                        </div>
                        <Target className="h-5 w-5 shrink-0 text-emerald-100" />
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3 bg-white text-emerald-800 hover:bg-emerald-50"
                        onClick={() => setTab("routine")}
                      >
                        Open PM routine
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                </div>
              </>
            )}

            {/* CONCERNS */}
            {tab === "concerns" && (
              <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                <Card className="h-fit p-2">
                  {CONCERNS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConcern(c.id)}
                      className={cn(
                        "flex w-full flex-col rounded-xl px-3 py-3 text-left transition",
                        selectedConcern === c.id
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-700 hover:bg-zinc-50"
                      )}
                    >
                      <span className="text-sm font-medium">{c.title}</span>
                      <span
                        className={cn(
                          "mt-0.5 text-xs",
                          selectedConcern === c.id ? "text-zinc-400" : "text-zinc-500"
                        )}
                      >
                        {c.zone} · {c.severity}
                      </span>
                    </button>
                  ))}
                </Card>

                <Card className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge
                        tone={
                          activeConcern.severity === "Moderate" ? "amber" : "emerald"
                        }
                      >
                        <AlertCircle className="h-3 w-3" />
                        {activeConcern.severity} severity
                      </Badge>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight">
                        {activeConcern.title}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        Detected primarily on the{" "}
                        <span className="font-medium text-zinc-700">{activeConcern.zone}</span>
                        . Model confidence{" "}
                        <span className="font-medium tabular-nums text-zinc-700">
                          {Math.round(activeConcern.confidence * 100)}%
                        </span>
                        .
                      </p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-center ring-1 ring-zinc-100">
                      <p className="text-2xl font-semibold tabular-nums text-emerald-600">
                        {Math.round(activeConcern.confidence * 100)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-zinc-400">AI conf.</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        t: "Likely drivers",
                        d: "Humidity swings, incomplete SPF reapply, residual acne inflammation.",
                      },
                      {
                        t: "What to avoid",
                        d: "Harsh scrubs, stacking acids, fragrance-heavy leave-ons on affected zones.",
                      },
                      {
                        t: "Expected progress",
                        d: "Visible calm in 10–14 days with consistent barrier + targeted actives.",
                      },
                    ].map((b) => (
                      <div
                        key={b.t}
                        className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                          {b.t}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{b.d}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {INGREDIENTS.filter((_, i) => i < 3).map((ing) => (
                      <Badge key={ing.name} tone={ing.tone}>
                        {ing.name}
                      </Badge>
                    ))}
                    <Button size="sm" className="ml-auto" onClick={() => setTab("routine")}>
                      Build treatment plan
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {/* ROUTINE */}
            {tab === "routine" && (
              <Card className="p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Personalized routine</h3>
                    <p className="text-xs text-zinc-500">
                      Generated from today’s scan · adjustable anytime
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-50 p-1">
                    {(["am", "pm"] as const).map((phase) => (
                      <button
                        key={phase}
                        onClick={() => setRoutinePhase(phase)}
                        className={cn(
                          "rounded-lg px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition",
                          routinePhase === phase
                            ? "bg-white text-zinc-900 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-800"
                        )}
                      >
                        {phase === "am" ? "☀ Morning" : "☾ Night"}
                      </button>
                    ))}
                  </div>
                </div>

                <ol className="space-y-3">
                  {ROUTINE[routinePhase].map((step, idx) => (
                    <li
                      key={step.step}
                      className="flex gap-4 rounded-2xl border border-zinc-100 bg-white p-4 transition hover:border-emerald-200 hover:shadow-sm"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-sm font-bold text-white shadow-sm shadow-emerald-500/20">
                        {step.step}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-zinc-900">{step.name}</p>
                          <Badge tone="zinc">{step.time}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-zinc-500">{step.why}</p>
                      </div>
                      {idx === 0 && (
                        <Badge tone="emerald" className="self-start">
                          Start here
                        </Badge>
                      )}
                    </li>
                  ))}
                </ol>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-100">
                  <p className="text-sm text-zinc-600">
                    <span className="font-medium text-zinc-900">Tip:</span> Wait 60s between
                    serum and cream for better absorption on combination skin.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setChatOpen(true)}>
                    <MessageCircle className="h-3.5 w-3.5" />
                    Ask AI to tweak
                  </Button>
                </div>
              </Card>
            )}

            {/* INGREDIENTS */}
            {tab === "ingredients" && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {INGREDIENTS.map((ing) => (
                  <Card
                    key={ing.name}
                    className="group p-5 transition hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-500/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm",
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
                      Match score based on your barrier, pigment, and clarity biomarkers from
                      the latest scan.
                    </p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          ing.tone === "emerald" ? "bg-emerald-500" : "bg-teal-500"
                        )}
                        style={{ width: `${ing.match}%` }}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 w-full justify-between px-0 text-zinc-600 hover:bg-transparent hover:text-emerald-700"
                    >
                      Why this fits you
                      <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* ── AI Chat sidebar ──────────────────────────────────────────── */}
          {chatOpen && (
            <Card className="flex h-fit flex-col overflow-hidden xl:sticky xl:top-4">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                    <Sparkles className="h-4 w-4" />
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">AI Cosmetologist</p>
                    <p className="text-[11px] text-zinc-500">Online · knows your scan</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setChatOpen(false)}
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto p-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
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
              </div>

              <div className="border-t border-zinc-100 p-3">
                <div className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Ask about routine, SPF, actives…"
                    className="h-10 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none ring-emerald-500/30 placeholder:text-zinc-400 focus:bg-white focus:ring-2"
                  />
                  <Button size="icon" onClick={sendMessage} aria-label="Send">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["Why is hydration low?", "Swap my cleanser", "Travel kit"].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setDraft(q);
                      }}
                      className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600 transition hover:border-emerald-300 hover:text-emerald-700"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* mobile chat FAB */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-20 flex h-14 items-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white shadow-xl shadow-zinc-900/25 transition hover:bg-zinc-800 sm:bottom-8 sm:right-8"
          >
            <MessageCircle className="h-4 w-4 text-emerald-400" />
            Chat with AI
          </button>
        )}
      </div>
    </div>
  );
}
