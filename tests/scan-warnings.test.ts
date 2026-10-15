import assert from "node:assert/strict";
import test from "node:test";
import {
  FAILED_ANALYSIS_WARNING,
  LOW_CONFIDENCE_WARNING,
  POOR_PHOTO_WARNING,
  SAMPLE_SCORE_WARNING,
  scanWarnings,
} from "../lib/scan-warnings.ts";

test("a rejected photo asks for a retake and does not invent a score", () => {
  const warnings = scanWarnings({ status: "rejected_quality", analysisKind: "baseline_cv_v1" });
  assert.deepEqual(warnings, [POOR_PHOTO_WARNING]);
  assert.equal(warnings.join(" ").includes("Fitzpatrick"), false);
});

test("a baseline estimate warns that confidence is capped and unmeasured", () => {
  const warnings = scanWarnings({
    status: "succeeded",
    analysisKind: "baseline_cv_v1",
    findings: [{ concern: "redness", severity: "mild", confidence: 0.55 }],
  });
  assert.deepEqual(warnings, [LOW_CONFIDENCE_WARNING]);
});

test("heuristic_v0 is labeled as a sample and is not a photo result", () => {
  const warnings = scanWarnings({ status: "succeeded", analysisKind: "heuristic_v0" });
  assert.deepEqual(warnings, [SAMPLE_SCORE_WARNING]);
});

test("a failed analysis does not fill a warning with a score", () => {
  const warnings = scanWarnings({ status: "failed", analysisKind: "pending" });
  assert.deepEqual(warnings, [FAILED_ANALYSIS_WARNING]);
});
