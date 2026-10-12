const DISCLAIMER = "Informational only, not a medical diagnosis.";

const CONCERNS = new Set([
  "acne",
  "blackheads_pores",
  "pigmentation",
  "redness",
  "dark_circles",
  "texture",
  "fine_lines",
  "dehydration",
]);

const SEVERITIES = new Set(["none", "mild", "moderate", "severe"]);

const REASONS = new Set([
  "no_face",
  "multiple_faces",
  "too_dark",
  "too_bright",
  "blurry",
  "off_center",
  "face_too_small",
  "clipped",
]);

const SKIN_TYPES = new Set([
  "oily",
  "dry",
  "combination",
  "normal",
  "sensitive",
  "unknown",
]);

export type QualityReason =
  | "no_face"
  | "multiple_faces"
  | "too_dark"
  | "too_bright"
  | "blurry"
  | "off_center"
  | "face_too_small"
  | "clipped";

export type FindingBox = { x: number; y: number; w: number; h: number };

export type AnalysisFinding = {
  concern: string;
  severity: string;
  confidence: number;
  explanation: string;
  escalate: boolean;
  region: {
    zone: string;
    space: "image";
    box: FindingBox | null;
  };
};

export type FaceAnalysis = {
  status: "succeeded" | "rejected_quality";
  modelVersion: "baseline_cv_v1";
  quality: { accepted: boolean; reasons: QualityReason[] };
  skinType: string | null;
  skinTypeConfidence: number | null;
  findings: AnalysisFinding[];
  summary: string;
  escalation: string | null;
  disclaimer: typeof DISCLAIMER;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

function parseBox(value: unknown): FindingBox | null | undefined {
  if (value == null) return null;
  if (!isRecord(value)) return undefined;
  const x = unit(value.x);
  const y = unit(value.y);
  const w = unit(value.w);
  const h = unit(value.h);
  if (x == null || y == null || w == null || h == null || w <= 0 || h <= 0) return undefined;
  return { x, y, w, h };
}

function parseFinding(value: unknown): AnalysisFinding | null {
  if (!isRecord(value)) return null;
  if (typeof value.concern !== "string" || !CONCERNS.has(value.concern)) return null;
  if (typeof value.severity !== "string" || !SEVERITIES.has(value.severity)) return null;
  const confidence = unit(value.confidence);
  if (confidence == null || confidence > 0.55) return null;
  if (typeof value.explanation !== "string" || value.explanation.length === 0) return null;
  if (value.explanation.length > 800) return null;
  if (typeof value.escalate !== "boolean") return null;
  if (!isRecord(value.region)) return null;
  if (typeof value.region.zone !== "string" || value.region.zone.length === 0) return null;
  if (value.region.space !== "image") return null;
  const box = parseBox(value.region.box);
  if (box === undefined) return null;
  return {
    concern: value.concern,
    severity: value.severity,
    confidence,
    explanation: value.explanation,
    escalate: value.escalate || value.severity === "severe",
    region: { zone: value.region.zone, space: "image", box },
  };
}

/** Reject a model payload that does not match baseline_cv_v1. Never fill gaps. */
export function parseAnalysis(input: unknown): { ok: true; value: FaceAnalysis } | { ok: false } {
  if (!isRecord(input)) return { ok: false };
  if (input.status !== "succeeded" && input.status !== "rejected_quality") return { ok: false };
  if (input.modelVersion !== "baseline_cv_v1") return { ok: false };
  if (input.disclaimer !== DISCLAIMER) return { ok: false };
  if (typeof input.summary !== "string" || input.summary.length === 0 || input.summary.length > 2000) {
    return { ok: false };
  }
  if (!isRecord(input.quality) || typeof input.quality.accepted !== "boolean") return { ok: false };
  if (!Array.isArray(input.quality.reasons)) return { ok: false };
  const reasons: QualityReason[] = [];
  for (const reason of input.quality.reasons) {
    if (typeof reason !== "string" || !REASONS.has(reason)) return { ok: false };
    reasons.push(reason as QualityReason);
  }
  if (!Array.isArray(input.findings)) return { ok: false };
  const findings: AnalysisFinding[] = [];
  for (const item of input.findings) {
    const finding = parseFinding(item);
    if (!finding) return { ok: false };
    findings.push(finding);
  }

  if (input.status === "rejected_quality") {
    if (input.quality.accepted !== false || findings.length !== 0) return { ok: false };
    return {
      ok: true,
      value: {
        status: "rejected_quality",
        modelVersion: "baseline_cv_v1",
        quality: { accepted: false, reasons },
        skinType: null,
        skinTypeConfidence: null,
        findings,
        summary: input.summary,
        escalation: null,
        disclaimer: DISCLAIMER,
      },
    };
  }

  if (input.quality.accepted !== true || findings.length === 0) return { ok: false };
  if (typeof input.skinType !== "string" || !SKIN_TYPES.has(input.skinType)) return { ok: false };
  const skinTypeConfidence = unit(input.skinTypeConfidence);
  if (skinTypeConfidence == null || skinTypeConfidence > 0.55) return { ok: false };
  if (input.escalation != null && typeof input.escalation !== "string") return { ok: false };
  return {
    ok: true,
    value: {
      status: "succeeded",
      modelVersion: "baseline_cv_v1",
      quality: { accepted: true, reasons },
      skinType: input.skinType,
      skinTypeConfidence,
      findings,
      summary: input.summary,
      escalation: typeof input.escalation === "string" ? input.escalation : null,
      disclaimer: DISCLAIMER,
    },
  };
}
