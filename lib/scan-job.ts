import { getPool, query } from "./db";
import { getStorage } from "./storage";
import { consumeRateLimit, type RateDecision } from "./rate-limit";
import {
  parseAnalysis,
  type AnalysisFinding,
  type FaceAnalysis,
  type QualityReason,
} from "./scan-analysis";

const DISCLAIMER = "Informational only, not a medical diagnosis.";
const POLICY_VERSION = "2026-10-12";
const ESCALATION =
  "See a dermatologist if this worries you. This app cannot assess skin cancer.";

const TITLES: Record<string, string> = {
  acne: "Acne",
  blackheads_pores: "Pores",
  pigmentation: "Dark spots",
  redness: "Redness",
  dark_circles: "Under-eye darkness",
  texture: "Texture",
  fine_lines: "Fine lines",
  dehydration: "Dehydration",
};

export type PublicFinding = AnalysisFinding;

export type PublicScan = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "rejected_quality";
  analysisKind: "heuristic_v0" | "baseline_cv_v1" | "pending";
  source: string;
  modelVersion: string | null;
  overallScore: number | null;
  skinType: string | null;
  skinTypeConfidence: number | null;
  quality: { accepted: boolean; reasons: string[] } | null;
  findings: PublicFinding[];
  summary: string;
  imageStored: boolean;
  createdAt: string;
  disclaimer: typeof DISCLAIMER;
  escalation: string | null;
};

type ScanRow = {
  id: string;
  status: PublicScan["status"];
  analysis_kind: PublicScan["analysisKind"];
  source: string;
  model_version: string | null;
  overall_score: number | null;
  skin_type: string | null;
  skin_type_confidence: number | null;
  quality: { accepted?: boolean; reasons?: string[] } | null;
  summary: string;
  store_image: boolean;
  image_ref: string | null;
  created_at: Date | string;
};

type FindingRow = {
  scan_id: string;
  concern: string;
  severity: string;
  confidence: number;
  explanation: string;
  escalate: boolean;
  region: {
    zone?: string;
    space?: string;
    box?: { x: number; y: number; w: number; h: number } | null;
  } | null;
};

export type CreateFaceScanInput = {
  userId: string;
  bytes: Uint8Array;
  contentType: string;
  source: "camera" | "upload";
  storeRequested: boolean;
  idempotencyKey: string | null;
};

export type CreateFaceScanResult =
  | {
      ok: true;
      fresh: boolean;
      scan: { id: string; status: string; imageStored: boolean };
      work?: {
        scanId: string;
        userId: string;
        bytes: Uint8Array;
        contentType: string;
        storeRequested: boolean;
      };
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      limit?: RateDecision;
    };

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function withDisclaimer(summary: string): string {
  if (summary.includes(DISCLAIMER)) return summary;
  return `${summary} ${DISCLAIMER}`;
}

function legacySeverity(severity: string): string {
  if (severity === "mild") return "Mild";
  if (severity === "moderate") return "Moderate";
  if (severity === "severe") return "Severe";
  return "None";
}

function logScan(code: string, err?: unknown) {
  const name = err instanceof Error ? err.name : undefined;
  const pgCode =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : undefined;
  console.error(JSON.stringify({ level: "error", route: "/api/v1/scans", code, name, pgCode }));
}

async function findingsFor(scanIds: string[]): Promise<Map<string, PublicFinding[]>> {
  const grouped = new Map<string, PublicFinding[]>();
  if (scanIds.length === 0) return grouped;
  const res = await query<FindingRow>(
    `SELECT scan_id, concern, severity, confidence, explanation, escalate, region
     FROM scan_findings WHERE scan_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [scanIds]
  );
  for (const row of res.rows) {
    const region = row.region ?? {};
    const finding: PublicFinding = {
      concern: row.concern,
      severity: row.severity,
      confidence: Number(row.confidence),
      explanation: row.explanation,
      escalate: row.escalate,
      region: {
        zone: region.zone ?? "face",
        space: "image",
        box: region.box ?? null,
      },
    };
    const list = grouped.get(row.scan_id) ?? [];
    list.push(finding);
    grouped.set(row.scan_id, list);
  }
  return grouped;
}

function toPublic(row: ScanRow, findings: PublicFinding[]): PublicScan {
  const reasons = Array.isArray(row.quality?.reasons) ? row.quality.reasons : [];
  const quality =
    row.quality && typeof row.quality.accepted === "boolean"
      ? { accepted: row.quality.accepted, reasons }
      : null;
  const escalation =
    row.status === "succeeded" && findings.some((item) => item.escalate || item.severity === "severe")
      ? ESCALATION
      : null;
  return {
    id: row.id,
    status: row.status,
    analysisKind: row.analysis_kind,
    source: row.source,
    modelVersion: row.model_version,
    overallScore: row.overall_score == null ? null : Number(row.overall_score),
    skinType: row.skin_type,
    skinTypeConfidence:
      row.skin_type_confidence == null ? null : Number(row.skin_type_confidence),
    quality,
    findings,
    summary: row.summary ?? "",
    imageStored: Boolean(row.store_image) && Boolean(row.image_ref),
    createdAt: iso(row.created_at),
    disclaimer: DISCLAIMER,
    escalation,
  };
}

const SCAN_COLUMNS = `id, status, analysis_kind, source, model_version, overall_score,
  skin_type, skin_type_confidence, quality, summary, store_image, image_ref, created_at`;

async function loadOwned(userId: string, id: string): Promise<PublicScan | null> {
  const res = await query<ScanRow>(
    `SELECT ${SCAN_COLUMNS} FROM skin_scans WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = res.rows[0];
  if (!row) return null;
  const findings = await findingsFor([row.id]);
  return toPublic(row, findings.get(row.id) ?? []);
}

export async function getOwnedScan(userId: string, id: string): Promise<PublicScan | null> {
  return loadOwned(userId, id);
}

export async function listOwnedScans(
  userId: string,
  cursor: string | null,
  limit: number
): Promise<{ ok: true; scans: PublicScan[]; nextCursor: string | null } | { ok: false; message: string }> {
  const size = Math.min(50, Math.max(1, limit));
  let createdAt: string | null = null;
  let cursorId: string | null = null;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) return { ok: false, message: "That page cursor is not valid." };
    createdAt = decoded.createdAt;
    cursorId = decoded.id;
  }
  const res = await query<ScanRow>(
    `SELECT ${SCAN_COLUMNS} FROM skin_scans
     WHERE user_id = $1
       AND (
         $2::timestamptz IS NULL
         OR (created_at, id) < ($2::timestamptz, $3::uuid)
       )
     ORDER BY created_at DESC, id DESC
     LIMIT $4`,
    [userId, createdAt, cursorId, size + 1]
  );
  const page = res.rows.slice(0, size);
  const findings = await findingsFor(page.map((row) => row.id));
  const scans = page.map((row) => toPublic(row, findings.get(row.id) ?? []));
  const extra = res.rows.length > size ? page[page.length - 1] : null;
  return {
    ok: true,
    scans,
    nextCursor: extra ? encodeCursor(iso(extra.created_at), extra.id) : null,
  };
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = raw.lastIndexOf("|");
    if (sep <= 0) return null;
    const createdAt = raw.slice(0, sep);
    const id = raw.slice(sep + 1);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return null;
    }
    if (Number.isNaN(Date.parse(createdAt))) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

async function insertQueued(input: CreateFaceScanInput): Promise<{ id: string }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO skin_scans (
         user_id, overall_score, metrics, concerns, ingredients, summary, source,
         status, analysis_kind, store_image, disclaimer_ack, idempotency_key
       ) VALUES (
         $1, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '', $2,
         'queued', 'pending', false, true, $3
       )
       RETURNING id`,
      [input.userId, input.source, input.idempotencyKey]
    );
    const id = inserted.rows[0].id;
    await client.query(
      `INSERT INTO analysis_jobs (user_id, kind, status, idempotency_key, scan_id)
       VALUES ($1, 'face_scan', 'queued', $2, $3)`,
      [input.userId, input.idempotencyKey, id]
    );
    await client.query(
      `INSERT INTO consent_log (user_id, purpose, granted, policy_version)
       VALUES ($1, 'camera_analysis', true, $2)`,
      [input.userId, POLICY_VERSION]
    );
    if (input.storeRequested) {
      await client.query(
        `INSERT INTO consent_log (user_id, purpose, granted, policy_version)
         VALUES ($1, 'store_image', true, $2)`,
        [input.userId, POLICY_VERSION]
      );
    }
    await client.query("COMMIT");
    return { id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function createFaceScan(input: CreateFaceScanInput): Promise<CreateFaceScanResult> {
  if (input.idempotencyKey) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM skin_scans WHERE user_id = $1 AND idempotency_key = $2`,
      [input.userId, input.idempotencyKey]
    );
    if (existing.rows[0]) {
      const scan = await loadOwned(input.userId, existing.rows[0].id);
      if (scan) {
        return {
          ok: true,
          fresh: false,
          scan: { id: scan.id, status: scan.status, imageStored: scan.imageStored },
        };
      }
    }
  }

  const limited = await consumeRateLimit(input.userId, "face_scan", 8, 86_400);
  if (!limited.ok) {
    return {
      ok: false,
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many scans today.",
      limit: limited,
    };
  }

  try {
    const inserted = await insertQueued(input);
    return {
      ok: true,
      fresh: true,
      scan: { id: inserted.id, status: "queued", imageStored: false },
      work: {
        scanId: inserted.id,
        userId: input.userId,
        bytes: input.bytes,
        contentType: input.contentType,
        storeRequested: input.storeRequested,
      },
    };
  } catch (err) {
    if (isUniqueViolation(err) && input.idempotencyKey) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM skin_scans WHERE user_id = $1 AND idempotency_key = $2`,
        [input.userId, input.idempotencyKey]
      );
      if (existing.rows[0]) {
        const scan = await loadOwned(input.userId, existing.rows[0].id);
        if (scan) {
          return {
            ok: true,
            fresh: false,
            scan: { id: scan.id, status: scan.status, imageStored: scan.imageStored },
          };
        }
      }
    }
    logScan("scan_insert_failed", err);
    return {
      ok: false,
      status: 500,
      code: "SCAN_FAILED",
      message: "Could not start the scan.",
    };
  }
}

async function callFaceModel(
  bytes: Uint8Array,
  contentType: string
): Promise<{ ok: true; analysis: FaceAnalysis } | { ok: false; code: string; message: string }> {
  const base = process.env.ML_SERVICE_URL?.replace(/\/$/, "");
  const token = process.env.ML_SERVICE_TOKEN;
  if (!base || !token) {
    return {
      ok: false,
      code: "ML_UNAVAILABLE",
      message: "The analysis service is not configured. No scores were invented.",
    };
  }
  let res: Response;
  try {
    res = await fetch(`${base}/internal/v1/face-scans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: Buffer.from(bytes),
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      code: "ML_UNAVAILABLE",
      message: "The analysis service could not be reached. No scores were invented.",
    };
  }
  if (res.status === 503) {
    return {
      ok: false,
      code: "ML_UNAVAILABLE",
      message: "The face model is not installed. No scores were invented.",
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      code: "ML_UNAVAILABLE",
      message: "The analysis service rejected the request. No scores were invented.",
    };
  }
  const json: unknown = await res.json().catch(() => null);
  const parsed = parseAnalysis(json);
  if (!parsed.ok) {
    return {
      ok: false,
      code: "ML_UNAVAILABLE",
      message: "The analysis service returned an unusable result. No scores were invented.",
    };
  }
  return { ok: true, analysis: parsed.value };
}

async function markFailed(scanId: string, userId: string, code: string, message: string) {
  const summary = withDisclaimer(message);
  await query(
    `UPDATE skin_scans
     SET status = 'failed', summary = $2, analysis_kind = 'pending',
         overall_score = NULL, updated_at = NOW()
     WHERE id = $1 AND user_id = $3 AND status IN ('queued', 'running')`,
    [scanId, summary, userId]
  );
  await query(
    `UPDATE analysis_jobs
     SET status = 'failed', error_code = $2, updated_at = NOW()
     WHERE scan_id = $1 AND status IN ('queued', 'running')`,
    [scanId, code]
  );
  await query(`INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`, [
    userId,
    "Face scan did not finish",
    summary,
  ]);
}

async function saveAnalysis(scanId: string, userId: string, analysis: FaceAnalysis) {
  const summary = withDisclaimer(analysis.summary);
  const concerns = analysis.findings.map((item) => ({
    id: item.concern,
    title: TITLES[item.concern] ?? item.concern,
    severity: legacySeverity(item.severity),
    zone: item.region.zone,
    confidence: item.confidence,
  }));
  const zones = analysis.findings.map((item) => item.region);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE skin_scans SET
         status = $2,
         analysis_kind = 'baseline_cv_v1',
         model_version = $3,
         overall_score = NULL,
         metrics = '[]'::jsonb,
         concerns = $4::jsonb,
         ingredients = '[]'::jsonb,
         summary = $5,
         quality = $6::jsonb,
         skin_type = $7,
         skin_type_confidence = $8,
         zones = $9::jsonb,
         updated_at = NOW()
       WHERE id = $1 AND user_id = $10 AND status = 'running'`,
      [
        scanId,
        analysis.status,
        analysis.modelVersion,
        JSON.stringify(concerns),
        summary,
        JSON.stringify(analysis.quality),
        analysis.skinType,
        analysis.skinTypeConfidence,
        JSON.stringify(zones),
        userId,
      ]
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return;
    }
    await client.query(`DELETE FROM scan_findings WHERE scan_id = $1`, [scanId]);
    for (const item of analysis.findings) {
      await client.query(
        `INSERT INTO scan_findings
           (scan_id, concern, severity, confidence, region, explanation, escalate)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
        [
          scanId,
          item.concern,
          item.severity,
          item.confidence,
          JSON.stringify(item.region),
          item.explanation,
          item.escalate,
        ]
      );
    }
    await client.query(
      `UPDATE analysis_jobs
       SET status = 'succeeded', error_code = NULL, updated_at = NOW()
       WHERE scan_id = $1`,
      [scanId]
    );
    const title =
      analysis.status === "succeeded" ? "Face estimate saved" : "Photo was not clear enough";
    await client.query(
      `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
      [userId, title, summary]
    );
    await client.query(
      `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'ai', $2)`,
      [userId, summary]
    );
    if (analysis.status === "succeeded") {
      await client.query(
        `UPDATE users SET streak_days = streak_days + 1, updated_at = NOW() WHERE id = $1`,
        [userId]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Next.js is the only database writer. FastAPI returns JSON and does not
 * store the photo. Missing ML configuration fails the row. It does not
 * call the heuristic scorer.
 */
export async function completeFaceScan(input: {
  scanId: string;
  userId: string;
  bytes: Uint8Array;
  contentType: string;
  storeRequested: boolean;
}): Promise<void> {
  try {
    const locked = await query(
      `UPDATE skin_scans SET status = 'running', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'queued'
       RETURNING id`,
      [input.scanId, input.userId]
    );
    if (!locked.rowCount) return;
    await query(
      `UPDATE analysis_jobs SET status = 'running', updated_at = NOW()
       WHERE scan_id = $1 AND status = 'queued'`,
      [input.scanId]
    );

    if (input.storeRequested) {
      const stored = await getStorage().putObject({
        userId: input.userId,
        objectId: input.scanId,
        bytes: input.bytes,
        contentType: input.contentType,
      });
      if (stored.ok) {
        await query(
          `UPDATE skin_scans SET store_image = true, image_ref = $2, updated_at = NOW()
           WHERE id = $1 AND user_id = $3`,
          [input.scanId, stored.ref, input.userId]
        );
      }
    }

    const result = await callFaceModel(input.bytes, input.contentType);
    if (!result.ok) {
      await markFailed(input.scanId, input.userId, result.code, result.message);
      return;
    }
    await saveAnalysis(input.scanId, input.userId, result.analysis);
  } catch (err) {
    logScan("scan_complete_failed", err);
    await markFailed(
      input.scanId,
      input.userId,
      "ML_UNAVAILABLE",
      "The analysis service failed. No scores were invented."
    ).catch((inner) => logScan("scan_fail_update_failed", inner));
  }
}

export async function deleteOwnedScan(userId: string, id: string): Promise<boolean> {
  const existing = await query<{ image_ref: string | null }>(
    `SELECT image_ref FROM skin_scans WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = existing.rows[0];
  if (!row) return false;
  if (row.image_ref) {
    await getStorage().deleteObject(row.image_ref);
  }
  const removed = await query(
    `DELETE FROM skin_scans WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return Boolean(removed.rowCount);
}

export type { QualityReason };
