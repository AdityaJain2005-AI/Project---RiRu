export type Metric = {
  id: string;
  label: string;
  score: number;
  delta: number;
  status: "excellent" | "good" | "fair";
  tip: string;
};

export type Concern = {
  id: string;
  title: string;
  severity: "Mild" | "Moderate";
  zone: string;
  confidence: number;
};

export type Ingredient = {
  name: string;
  role: string;
  match: number;
  tone: "emerald" | "teal";
  favorited?: boolean;
};

export type SkinSignals = {
  meanLuma: number;
  lumaVariance: number;
  redness: number;
  saturation: number;
  darkRatio: number;
  brightRatio: number;
  sampleCount: number;
};

export type ScanCvInput = {
  quality?: number;
  views?: string[];
  signals?: SkinSignals[];
};

export type ScanPayload = {
  overallScore: number;
  metrics: Metric[];
  concerns: Concern[];
  ingredients: Ingredient[];
  streakDays: number;
  source: "camera" | "upload" | "seed";
  summary: string;
};

function clamp(n: number, min = 45, max = 96) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function statusFor(score: number): Metric["status"] {
  if (score >= 80) return "excellent";
  if (score >= 70) return "good";
  return "fair";
}

function tipFor(id: string, score: number): string {
  const tips: Record<string, [string, string]> = {
    hydration: [
      "Hydration is solid — keep humectants AM/PM.",
      "Slightly below optimal. Layer a humectant serum AM/PM.",
    ],
    barrier: [
      "Ceramide levels look strong. Keep your current moisturizer.",
      "Barrier is recovering — pause strong acids for a few days.",
    ],
    texture: [
      "Texture looks even. Maintain gentle exfoliation weekly.",
      "Mild roughness detected. Gentle exfoliation 2×/week.",
    ],
    clarity: [
      "Clarity is trending up. Stay consistent with niacinamide.",
      "Post-inflammatory marks fading slowly — keep brightening actives.",
    ],
    elasticity: [
      "Firmness is excellent. Maintain daily SPF.",
      "Elasticity fair — peptides and sleep will help most.",
    ],
    pigment: [
      "Even tone is holding. Antioxidant serum still useful.",
      "UV-related unevenness on T-zone. Boost antioxidant + SPF.",
    ],
  };
  const pair = tips[id] ?? ["Looking good.", "Room to improve — stay consistent."];
  return score >= 75 ? pair[0] : pair[1];
}

function averageSignals(signals: SkinSignals[]) {
  const valid = signals.filter((s) => s && s.sampleCount > 0);
  if (!valid.length) return null;
  const keys: (keyof SkinSignals)[] = [
    "meanLuma",
    "lumaVariance",
    "redness",
    "saturation",
    "darkRatio",
    "brightRatio",
  ];
  return Object.fromEntries(
    keys.map((key) => [key, valid.reduce((sum, item) => sum + Number(item[key]), 0) / valid.length])
  ) as Omit<SkinSignals, "sampleCount">;
}

function visualProxyScores(signals: Omit<SkinSignals, "sampleCount">) {
  const evenLight = 1 - Math.min(1, signals.darkRatio + signals.brightRatio);
  const uniformity = Math.max(0, 1 - Math.min(1, Math.sqrt(signals.lumaVariance) / 90));
  const rednessPenalty = Math.max(0, signals.redness) * 0.8;
  const brightness = (signals.meanLuma - 105) * 0.12;
  const base = 64 + brightness + evenLight * 8 + uniformity * 8 - rednessPenalty;
  return {
    hydration: clamp(base + (1 - signals.saturation) * 8),
    barrier: clamp(base + uniformity * 7 - rednessPenalty * 0.3),
    texture: clamp(base + uniformity * 10 - Math.sqrt(signals.lumaVariance) * 0.08),
    clarity: clamp(base + evenLight * 5 - rednessPenalty * 0.7),
    elasticity: clamp(base + uniformity * 6),
    pigment: clamp(base + evenLight * 4 - rednessPenalty * 0.5),
  };
}

/** Uses captured visual signals when available; legacy fallback is retained for old clients. */
export function generateScan(
  source: ScanPayload["source"] = "camera",
  previous?: Partial<Record<string, number>>,
  cv?: ScanCvInput
): ScanPayload {
  const base: Record<string, number> = {
    hydration: previous?.hydration ?? 72,
    barrier: previous?.barrier ?? 81,
    texture: previous?.texture ?? 68,
    clarity: previous?.clarity ?? 74,
    elasticity: previous?.elasticity ?? 85,
    pigment: previous?.pigment ?? 63,
  };

  const qualityBoost =
    typeof cv?.quality === "number" ? Math.round((cv.quality - 50) / 20) : 0;
  const viewBoost = (cv?.views?.length ?? 0) >= 3 ? 2 : 0;
  const averagedSignals = averageSignals(cv?.signals ?? []);
  const derivedScores = averagedSignals ? visualProxyScores(averagedSignals) : null;
  const jitter = () => Math.floor(Math.random() * 7) - 2 + qualityBoost + viewBoost;

  const defs = [
    { id: "hydration", label: "Hydration" },
    { id: "barrier", label: "Barrier" },
    { id: "texture", label: "Texture" },
    { id: "clarity", label: "Clarity" },
    { id: "elasticity", label: "Elasticity" },
    { id: "pigment", label: "Even Tone" },
  ];

  const metrics: Metric[] = defs.map((d) => {
    const prev = base[d.id];
    const score = clamp(
      derivedScores
        ? derivedScores[d.id as keyof typeof derivedScores]
        : prev + jitter() + (source === "upload" ? 1 : 0)
    );
    const delta = score - prev;
    return {
      id: d.id,
      label: d.label,
      score,
      delta,
      status: statusFor(score),
      tip: tipFor(d.id, score),
    };
  });

  const overallScore = clamp(
    metrics.reduce((s, m) => s + m.score, 0) / metrics.length,
    50,
    95
  );

  const concerns: Concern[] = (
    [
      {
        id: "pores",
        title: "Enlarged pores",
        severity: (metrics.find((m) => m.id === "texture")!.score < 72
          ? "Moderate"
          : "Mild") as Concern["severity"],
        zone: "T-zone",
        confidence: 0.88 + Math.random() * 0.08,
      },
      {
        id: "dryness",
        title: "Dehydration lines",
        severity: (metrics.find((m) => m.id === "hydration")!.score < 75
          ? "Moderate"
          : "Mild") as Concern["severity"],
        zone: "Cheeks",
        confidence: 0.82 + Math.random() * 0.1,
      },
      {
        id: "spots",
        title: "Post-acne marks",
        severity: (metrics.find((m) => m.id === "clarity")!.score < 70
          ? "Moderate"
          : "Mild") as Concern["severity"],
        zone: "Jawline",
        confidence: 0.75 + Math.random() * 0.12,
      },
    ] as Concern[]
  ).map((c) => ({
    ...c,
    confidence: Math.min(0.98, Math.round(c.confidence * 100) / 100),
  }));

  const ingredients: Ingredient[] = [];

  const weak = [...metrics].sort((a, b) => a.score - b.score)[0];
  const strong = [...metrics].sort((a, b) => b.score - a.score)[0];

  return {
    overallScore,
    metrics,
    concerns,
    ingredients,
    streakDays: 12 + Math.floor(Math.random() * 3),
    source,
    summary: `${derivedScores ? "Visual proxy scan" : "Preliminary scan"}: ${strong.label} is strongest at ${strong.score}. Focus next on ${weak.label.toLowerCase()} (${weak.score}) via targeted actives.${derivedScores ? " Lighting, color, and texture signals influenced this result; this is not a clinical diagnosis." : " Improve capture quality for a more individualized result."}`,
  };
}

export const ROUTINE = {
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
