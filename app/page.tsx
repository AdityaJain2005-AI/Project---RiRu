import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Leaf,
  MessageCircle,
  ScanFace,
  Sparkles,
  Target,
} from "lucide-react";

const FEATURES = [
  {
    icon: ScanFace,
    title: "AI face mesh",
    body: "128 landmark scan maps pores, tone, barrier, and texture in seconds.",
  },
  {
    icon: Target,
    title: "Biomarker scores",
    body: "Hydration, clarity, elasticity, and more — tracked over every session.",
  },
  {
    icon: MessageCircle,
    title: "AI cosmetologist",
    body: "Chat that knows your last scan and rewrites AM/PM routines on the fly.",
  },
  {
    icon: Sparkles,
    title: "Ingredient match",
    body: "Niacinamide, ceramides, azelaic — ranked to your unique profile.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-[28rem] w-[28rem] rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute -right-20 top-32 h-80 w-80 rounded-full bg-teal-100/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-100/40 blur-3xl" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Facelab</p>
            <p className="text-[11px] text-zinc-500">AI Skin Lab</p>
          </div>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className="hidden text-sm font-medium text-zinc-600 transition hover:text-zinc-900 sm:inline"
          >
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
          >
            Open lab
            <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
              <BadgeCheck className="h-3.5 w-3.5" />
              Health-tech AI · dermatologist-grade maps
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl sm:leading-[1.1]">
              Your skin, decoded by an{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                AI cosmetologist
              </span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-zinc-500 sm:text-lg">
              Facelab turns a quick camera scan into a living diagnostic
              dashboard — scores, concerns, ingredient matches, and a routine
              that adapts as your barrier heals.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-emerald-600 px-6 text-base font-medium text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
              >
                <Camera className="h-4 w-4" />
                Start skin diagnostic
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-6 text-base font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              >
                View demo dashboard
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 pt-2 text-sm text-zinc-500">
              <div>
                <p className="text-2xl font-semibold tabular-nums text-zinc-900">78</p>
                <p className="text-xs">avg. skin score</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-zinc-900">6</p>
                <p className="text-xs">biomarker tracks</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-zinc-900">94%</p>
                <p className="text-xs">scan confidence</p>
              </div>
            </div>
          </div>

          {/* Preview card */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-emerald-200/40 to-teal-100/30 blur-xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScanFace className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold">Live diagnostic</span>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                  Demo ready
                </span>
              </div>
              <div className="relative mx-auto aspect-[4/5] max-w-[240px] overflow-hidden rounded-[1.5rem] bg-gradient-to-b from-zinc-100 via-zinc-50 to-emerald-50/50 ring-1 ring-zinc-200">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[78%] w-[68%] rounded-[45%] bg-gradient-to-b from-stone-200/90 via-stone-100 to-stone-200/70 shadow-inner">
                    <div className="absolute left-[28%] top-[38%] h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    <div className="absolute right-[28%] top-[38%] h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    <div className="absolute left-1/2 top-[52%] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-teal-400/70" />
                    <div className="absolute inset-[8%] rounded-[42%] border border-dashed border-emerald-400/30" />
                  </div>
                </div>
                <div className="absolute left-3 top-1/3 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                  Barrier 81
                </div>
                <div className="absolute bottom-[28%] right-3 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-teal-700 shadow-sm ring-1 ring-teal-100">
                  Hydration 72
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { k: "Score", v: "78" },
                  { k: "Flags", v: "3" },
                  { k: "Match", v: "96%" },
                ].map((s) => (
                  <div
                    key={s.k}
                    className="rounded-xl bg-zinc-50 px-2 py-2 text-center ring-1 ring-zinc-100"
                  >
                    <p className="text-sm font-semibold tabular-nums">{s.v}</p>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                      {s.k}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.03] transition hover:border-emerald-200 hover:shadow-md"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h2 className="text-sm font-semibold text-zinc-900">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950 px-6 py-10 text-center sm:px-12">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-300/80">
            Built for Zerops
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Open the diagnostic dashboard
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-400">
            Explore interactive score meters, concern deep-dives, AM/PM routines,
            ingredient badges, and the AI cosmetologist chat — all with realistic
            mock data.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-zinc-900 transition hover:bg-emerald-50"
          >
            Launch Facelab
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="relative border-t border-zinc-200/80 py-6 text-center text-xs text-zinc-400">
        Facelab · AI skincare demo on Zerops · Next.js App Router
      </footer>
    </div>
  );
}
