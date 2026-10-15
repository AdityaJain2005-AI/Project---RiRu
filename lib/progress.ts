export const SEVERITY_RANK = {
  none: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
} as const;

export type SeverityName = keyof typeof SEVERITY_RANK;

export type ConcernPoint = {
  concern: string;
  severity: string;
  confidence: number | null;
};

export type ScanPoint = {
  id: string;
  createdAt: string;
  analysisKind: string;
  overallScore: number | null;
  summary: string;
  concerns: ConcernPoint[];
};

export type TrendPoint = {
  scanId: string;
  createdAt: string;
  analysisKind: string;
  sampleScore: boolean;
  severity: SeverityName;
  rank: number;
  confidence: number | null;
};

export type ConcernTrend = {
  concern: string;
  points: TrendPoint[];
  direction: "lower" | "higher" | "same";
  measured: boolean;
};

const LEGACY_SEVERITY: Record<string, SeverityName> = {
  none: "none",
  mild: "mild",
  moderate: "moderate",
  severe: "severe",
};

export function normalizeSeverity(value: string): SeverityName | null {
  return LEGACY_SEVERITY[value.trim().toLowerCase()] ?? null;
}

export function isSampleScore(analysisKind: string): boolean {
  return analysisKind === "heuristic_v0";
}

export function concernsFromLegacy(raw: unknown): ConcernPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: ConcernPoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; severity?: unknown; confidence?: unknown };
    const concern = typeof row.id === "string" ? row.id : "";
    const severity = typeof row.severity === "string" ? normalizeSeverity(row.severity) : null;
    if (!concern || !severity) continue;
    const confidence = typeof row.confidence === "number" ? row.confidence : null;
    out.push({ concern, severity, confidence });
  }
  return out;
}

export function buildConcernTrends(scans: ScanPoint[]): ConcernTrend[] {
  const ordered = [...scans].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const grouped = new Map<string, TrendPoint[]>();
  for (const scan of ordered) {
    for (const concern of scan.concerns) {
      const severity = normalizeSeverity(concern.severity);
      if (!severity) continue;
      const points = grouped.get(concern.concern) ?? [];
      points.push({
        scanId: scan.id,
        createdAt: scan.createdAt,
        analysisKind: scan.analysisKind,
        sampleScore: isSampleScore(scan.analysisKind),
        severity,
        rank: SEVERITY_RANK[severity],
        confidence: concern.confidence,
      });
      grouped.set(concern.concern, points);
    }
  }
  return [...grouped.entries()].map(([concern, points]) => {
    const first = points[0];
    const last = points[points.length - 1];
    const direction =
      last.rank < first.rank ? "lower" : last.rank > first.rank ? "higher" : "same";
    return {
      concern,
      points,
      direction,
      measured: points.some((point) => !point.sampleScore),
    };
  });
}

export type ScanSnapshot = {
  id: string;
  createdAt: string;
  analysisKind: string;
  sampleScore: boolean;
  overallScore: number | null;
  summary: string;
};

export type BeforeAfter = {
  before: ScanSnapshot;
  after: ScanSnapshot;
  sameScan: boolean;
  sampleScoreDelta: number | null;
};

function snapshot(scan: ScanPoint): ScanSnapshot {
  return {
    id: scan.id,
    createdAt: scan.createdAt,
    analysisKind: scan.analysisKind,
    sampleScore: isSampleScore(scan.analysisKind),
    overallScore: scan.overallScore,
    summary: scan.summary,
  };
}

export function beforeAfter(scans: ScanPoint[]): BeforeAfter | null {
  const ordered = [...scans].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (ordered.length === 0) return null;
  const before = ordered[0];
  const after = ordered[ordered.length - 1];
  const bothSample = isSampleScore(before.analysisKind) && isSampleScore(after.analysisKind);
  const sampleScoreDelta =
    bothSample && before.overallScore != null && after.overallScore != null
      ? after.overallScore - before.overallScore
      : null;
  return {
    before: snapshot(before),
    after: snapshot(after),
    sameScan: before.id === after.id,
    sampleScoreDelta,
  };
}
