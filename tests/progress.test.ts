import assert from "node:assert/strict";
import test from "node:test";
import { beforeAfter, buildConcernTrends, type ScanPoint } from "../lib/progress.ts";
import { publicRecovery } from "../lib/recovery.ts";

const scans: ScanPoint[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-10-01T00:00:00.000Z",
    analysisKind: "heuristic_v0",
    overallScore: 70,
    summary: "Sample earlier",
    concerns: [{ concern: "redness", severity: "Moderate", confidence: null }],
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-10-10T00:00:00.000Z",
    analysisKind: "baseline_cv_v1",
    overallScore: null,
    summary: "Later estimate",
    concerns: [{ concern: "redness", severity: "mild", confidence: 0.4 }],
  },
];

test("concern trend drops from moderate to mild and marks a measured point", () => {
  const rows = buildConcernTrends(scans);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.concern, "redness");
  assert.equal(rows[0]?.direction, "lower");
  assert.equal(rows[0]?.measured, true);
  assert.equal(rows[0]?.points[0]?.sampleScore, true);
  assert.equal(rows[0]?.points[1]?.sampleScore, false);
});

test("sample score delta is omitted when one scan is not a sample", () => {
  const compared = beforeAfter(scans);
  assert.equal(compared?.sampleScoreDelta, null);
  assert.equal(compared?.before.sampleScore, true);
  assert.equal(compared?.after.analysisKind, "baseline_cv_v1");
});

test("two sample scores report a sample delta", () => {
  const compared = beforeAfter([
    scans[0],
    { ...scans[0], id: "33333333-3333-4333-8333-333333333333", createdAt: "2026-10-02T00:00:00.000Z", overallScore: 74 },
  ]);
  assert.equal(compared?.sampleScoreDelta, 4);
});

test("public recovery leaves out the clinician note", () => {
  const body = publicRecovery(
    { procedure_type: "laser", procedure_on: "2026-10-01", active: true },
    ["RETINOL"],
    "Follow your clinician."
  );
  assert.equal(body.active, true);
  assert.equal(body.procedureType, "laser");
  assert.equal("clinicianNote" in body, false);
  assert.match(JSON.stringify(body), /Follow your clinician/);
  assert.equal(JSON.stringify(body).includes("secret note"), false);
});
