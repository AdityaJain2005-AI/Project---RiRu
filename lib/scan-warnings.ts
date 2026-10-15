export const LOW_CONFIDENCE_MAX = 0.55;

export const POOR_PHOTO_WARNING =
  "This photo is not clear enough for an estimate. Retake it with one face, even light, and a steady camera.";

export const LOW_CONFIDENCE_WARNING =
  "Low confidence. This is a rough visual estimate, capped at 55%, and it has not been measured across skin tones.";

export const SAMPLE_SCORE_WARNING =
  "This row is a sample score. The photo was not read.";

export const FAILED_ANALYSIS_WARNING =
  "The analysis did not finish. No score was invented.";

export function scanWarnings(input: {
  status: string;
  analysisKind: string;
  findings?: { confidence: number; severity: string }[];
}): string[] {
  if (input.status === "rejected_quality") return [POOR_PHOTO_WARNING];
  if (input.status === "failed") return [FAILED_ANALYSIS_WARNING];
  if (input.status !== "succeeded") return [];
  if (input.analysisKind === "heuristic_v0") return [SAMPLE_SCORE_WARNING];
  const findings = input.findings ?? [];
  const visible = findings.filter((item) => item.severity !== "none");
  const low =
    visible.length === 0 ||
    visible.some((item) => item.confidence <= LOW_CONFIDENCE_MAX);
  if (input.analysisKind === "baseline_cv_v1" && low) return [LOW_CONFIDENCE_WARNING];
  return [];
}
