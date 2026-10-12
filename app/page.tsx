import Link from "next/link";
import {
  ArrowRight,
  Camera,
  History,
  LayoutDashboard,
  MessageCircle,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge, Button, Card, ScoreRing } from "@/components/ui";
import { getActorId } from "@/lib/actor";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getHomeStats() {
  const empty = {
    score: null as number | null,
    summary: null as string | null,
    analysisKind: null as string | null,
    scans: 0,
    name: "there",
    streak: 0,
    skinType: "unknown",
  };
  try {
    const userId = await getActorId();
    if (!userId) return empty;

    const scan = await query<{
      overall_score: number | null;
      summary: string;
      analysis_kind: string;
    }>(
      `SELECT overall_score, summary, analysis_kind FROM skin_scans
       WHERE user_id = $1 AND status = 'succeeded'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const count = await query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM skin_scans WHERE user_id = $1`,
      [userId]
    );
    const user = await query<{ name: string; streak_days: number; skin_type: string }>(
      `SELECT name, streak_days, skin_type FROM users WHERE id = $1`,
      [userId]
    );
    return {
      score: scan.rows[0]?.overall_score ?? null,
      summary: scan.rows[0]?.summary ?? null,
      analysisKind: scan.rows[0]?.analysis_kind ?? null,
      scans: count.rows[0]?.c ?? 0,
      name: user.rows[0]?.name ?? "there",
      streak: user.rows[0]?.streak_days ?? 0,
      skinType: user.rows[0]?.skin_type ?? "Combination",
    };
  } catch {
    return empty;
  }
}

export default async function HomePage() {
  const stats = await getHomeStats();

  return (
    <div className="space-y-8">
      <section className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <Badge tone="emerald">
            <Sparkles className="h-3 w-3" />
            AI skin lab · live on Zerops
          </Badge>
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl sm:leading-[1.12]">
            Hi {stats.name.split(" ")[0]} —{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              your skin has a plan
            </span>
          </h1>
          <p className="max-w-lg text-[15px] leading-relaxed text-zinc-500">
            Scan in under a minute, see biomarker scores, follow a short AM/PM
            routine, and ask the cosmetologist anything. Progress is saved to
            your lab history.
          </p>
          <p className="max-w-lg text-xs leading-relaxed text-zinc-400">
            {stats.analysisKind === "baseline_cv_v1"
              ? "The latest result is a baseline visual estimate from the photo. It is not a measurement and not a diagnosis. Informational only, not a medical diagnosis."
              : stats.analysisKind === "heuristic_v0"
                ? "Scores on older scans are sample estimates, not a measurement of your skin. Informational only, not a medical diagnosis."
                : "No completed scan yet. A new scan checks the photo, then saves a baseline visual estimate. Informational only, not a medical diagnosis."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/scan">
              <Button size="lg">
                <Camera className="h-4 w-4" />
                Start face scan
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                Open skin lab
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-5 pt-1 text-sm text-zinc-500">
            <div>
              <p className="text-xl font-semibold tabular-nums text-zinc-900">
                {stats.score ?? "—"}
              </p>
              <p className="text-xs">latest score</p>
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums text-zinc-900">
                {stats.scans}
              </p>
              <p className="text-xs">scans saved</p>
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums text-zinc-900">
                {stats.streak}
              </p>
              <p className="text-xs">day streak</p>
            </div>
          </div>
        </div>

        <Card elevated className="relative overflow-hidden p-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-100/60 blur-2xl" />
          <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Today
              </p>
              <p className="text-lg font-semibold tracking-tight">
                {stats.score != null ? "Stay consistent" : "First scan awaits"}
              </p>
              <p className="max-w-xs text-sm text-zinc-500">
                {stats.summary ??
                  "Run a scan to unlock scores, concerns, and a tailored routine."}
              </p>
              <p className="text-xs text-zinc-400">
                {stats.skinType === "unknown" ? "Skin type not set" : `${stats.skinType} skin`}
              </p>
            </div>
            {typeof stats.score === "number" ? (
              <ScoreRing
                score={stats.score}
                label={stats.analysisKind === "heuristic_v0" ? "Sample" : "Estimate"}
              />
            ) : (
              <p className="text-4xl font-semibold text-zinc-300">—</p>
            )}
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { href: "/scan", label: "Scan", icon: Camera },
              { href: "/dashboard", label: "Lab", icon: LayoutDashboard },
              { href: "/history", label: "History", icon: History },
              { href: "/chat", label: "Chat", icon: MessageCircle },
            ].map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-100 bg-zinc-50/80 px-2 py-3 text-center transition hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <q.icon className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-medium text-zinc-700">{q.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            t: "Guided scan",
            d: "Camera or photo. A bad frame is rejected. The result is a visual estimate.",
            href: "/scan",
          },
          {
            t: "Ingredient label",
            d: "Type a list or photograph a label. You confirm the text. The check is a rule, not a diagnosis.",
            href: "/ingredients",
          },
          {
            t: "Daily routine",
            d: "Short AM/PM steps you can check off as you go, or build a list from your latest scan.",
            href: "/routine",
          },
          {
            t: "AI cosmetologist",
            d: "Answers grounded in your latest scores — not generic tips.",
            href: "/chat",
          },
        ].map((c) => (
          <Link key={c.t} href={c.href}>
            <Card className="h-full p-5 transition hover:border-emerald-200 hover:shadow-md">
              <Target className="mb-3 h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-zinc-900">{c.t}</h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">{c.d}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
