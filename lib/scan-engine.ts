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

/** Deterministic-ish scan with light randomness so each run feels live. */
export function generateScan(
  source: ScanPayload["source"] = "camera",
  previous?: Partial<Record<string, number>>
): ScanPayload {
  const base: Record<string, number> = {
    hydration: previous?.hydration ?? 72,
    barrier: previous?.barrier ?? 81,
    texture: previous?.texture ?? 68,
    clarity: previous?.clarity ?? 74,
    elasticity: previous?.elasticity ?? 85,
    pigment: previous?.pigment ?? 63,
  };

  const jitter = () => Math.floor(Math.random() * 7) - 2; // -2..+4-ish

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
    const score = clamp(prev + jitter() + (source === "upload" ? 1 : 0));
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

  const ingredients: Ingredient[] = [
    { name: "Niacinamide 5%", role: "Brighten", match: clamp(overallScore + 12, 70, 99), tone: "emerald" },
    { name: "Hyaluronic Acid", role: "Hydrate", match: clamp(metrics[0].score + 18, 70, 99), tone: "teal" },
    { name: "Ceramide NP", role: "Barrier", match: clamp(metrics[1].score + 10, 70, 99), tone: "emerald" },
    { name: "Azelaic Acid 10%", role: "Calm", match: clamp(metrics[3].score + 12, 70, 99), tone: "teal" },
    { name: "Vitamin C 15%", role: "Antioxidant", match: clamp(metrics[5].score + 20, 70, 99), tone: "emerald" },
    { name: "Peptide Complex", role: "Firm", match: clamp(metrics[4].score + 5, 70, 99), tone: "teal" },
  ];

  const weak = [...metrics].sort((a, b) => a.score - b.score)[0];
  const strong = [...metrics].sort((a, b) => b.score - a.score)[0];

  return {
    overallScore,
    metrics,
    concerns,
    ingredients,
    streakDays: 12 + Math.floor(Math.random() * 3),
    source,
    summary: `${strong.label} is strongest at ${strong.score}. Focus next on ${weak.label.toLowerCase()} (${weak.score}) via targeted actives.`,
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
