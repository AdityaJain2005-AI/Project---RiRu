import assert from "node:assert/strict";
import test from "node:test";
import { parseAnalysis } from "../lib/scan-analysis.ts";

const disclaimer = "Informational only, not a medical diagnosis.";

function finding(confidence = 0.4) {
  return {
    concern: "acne",
    severity: "none",
    confidence,
    explanation: "This baseline does not detect acne.",
    escalate: false,
    region: { zone: "face", space: "image", box: { x: 0.2, y: 0.2, w: 0.4, h: 0.5 } },
  };
}

test("rejects a payload that is not the baseline contract", () => {
  assert.equal(parseAnalysis(null).ok, false);
  assert.equal(
    parseAnalysis({
      status: "succeeded",
      modelVersion: "baseline_cv_v1",
      disclaimer: "maybe",
      summary: "no",
      quality: { accepted: true, reasons: [] },
      findings: [finding()],
      skinType: "normal",
      skinTypeConfidence: 0.3,
    }).ok,
    false
  );
  assert.equal(
    parseAnalysis({
      status: "succeeded",
      modelVersion: "baseline_cv_v1",
      disclaimer,
      summary: "Baseline visual estimate only.",
      quality: { accepted: true, reasons: [] },
      findings: [finding(0.9)],
      skinType: "normal",
      skinTypeConfidence: 0.3,
    }).ok,
    false
  );
});

test("accepts a quality rejection with no findings", () => {
  const parsed = parseAnalysis({
    status: "rejected_quality",
    modelVersion: "baseline_cv_v1",
    disclaimer,
    summary: "No face was detected. Informational only, not a medical diagnosis.",
    quality: { accepted: false, reasons: ["no_face"] },
    findings: [],
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.findings.length, 0);
    assert.equal(parsed.value.skinType, null);
  }
});

test("accepts a capped successful finding", () => {
  const parsed = parseAnalysis({
    status: "succeeded",
    modelVersion: "baseline_cv_v1",
    disclaimer,
    summary: "Baseline visual estimate only.",
    quality: { accepted: true, reasons: [] },
    findings: [finding(0.55)],
    skinType: "combination",
    skinTypeConfidence: 0.36,
    escalation: null,
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.findings[0]?.severity, "none");
    assert.equal(parsed.value.skinTypeConfidence, 0.36);
  }
});
