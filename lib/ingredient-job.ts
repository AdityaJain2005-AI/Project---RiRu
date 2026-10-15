import {
  DISCLAIMER,
  EMPTY_PROFILE,
  evaluateVerdict,
  explainMatched,
  matchTokens,
  type IngredientNote,
  type IngredientProfile,
  type ParsedToken,
  type VerdictName,
  type VerdictReason,
} from "@riru/shared";
import { getPool, query } from "./db";
import { discardLabelImage } from "./privacy";
import { CatalogMissingError, loadIngredientData } from "./ingredient-catalog";
import { consumeRateLimit, type RateDecision } from "./rate-limit";
import { getStorage } from "./storage";

export const MAX_LABEL_CHARS = 8000;
export const MAX_LABEL_TOKENS = 200;
const POLICY_VERSION = "2026-10-12";
const MIN_OCR_LETTERS = 3;

export type PublicIngredientScan = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "rejected_quality";
  ocrText: string | null;
  parsed: ParsedToken[];
  confirmedText: string | null;
  imageStored: boolean;
  disclaimer: typeof DISCLAIMER;
};

export type PublicVerdict = {
  verdict: VerdictName;
  reasons: VerdictReason[];
  unparsed: string[];
  ingredients: IngredientNote[];
  rulesetVersion: string;
  disclaimer: typeof DISCLAIMER;
};

type ScanRow = {
  id: string;
  status: PublicIngredientScan["status"];
  ocr_text: string | null;
  parsed: unknown;
  confirmed_text: string | null;
  store_image: boolean;
  image_ref: string | null;
};

export type IngredientWork = {
  scanId: string;
  userId: string;
  bytes: Uint8Array;
  contentType: string;
  storeRequested: boolean;
};

export type CreateIngredientScanInput = {
  userId: string;
  text: string | null;
  bytes: Uint8Array | null;
  contentType: string | null;
  storeRequested: boolean;
  idempotencyKey: string | null;
};

export type IngredientFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  limit?: RateDecision;
};

export type CreateIngredientScanResult =
  | { ok: true; fresh: boolean; scan: PublicIngredientScan; work?: IngredientWork }
  | IngredientFailure;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

function logIngredient(code: string, err?: unknown) {
  const name = err instanceof Error ? err.name : undefined;
  const pgCode =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : undefined;
  console.error(
    JSON.stringify({ level: "error", route: "/api/v1/ingredients", code, name, pgCode })
  );
}

function asTokens(value: unknown): ParsedToken[] {
  if (!Array.isArray(value)) return [];
  const tokens: ParsedToken[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = (item as { raw?: unknown }).raw;
    const status = (item as { status?: unknown }).status;
    const inci = (item as { inci?: unknown }).inci;
    if (typeof raw !== "string") continue;
    if (status !== "matched" && status !== "fuzzy" && status !== "unparsed") continue;
    tokens.push({ raw, status, inci: typeof inci === "string" ? inci : null });
  }
  return tokens;
}

function toPublic(row: ScanRow): PublicIngredientScan {
  return {
    id: row.id,
    status: row.status,
    ocrText: row.ocr_text,
    parsed: asTokens(row.parsed),
    confirmedText: row.confirmed_text,
    imageStored: Boolean(row.store_image && row.image_ref),
    disclaimer: DISCLAIMER,
  };
}

async function loadOwned(userId: string, id: string): Promise<PublicIngredientScan | null> {
  const found = await query<ScanRow>(
    `SELECT id, status, ocr_text, parsed, confirmed_text, store_image, image_ref
     FROM ingredient_scans WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = found.rows[0];
  return row ? toPublic(row) : null;
}

export async function getOwnedIngredientScan(
  userId: string,
  id: string
): Promise<PublicIngredientScan | null> {
  return loadOwned(userId, id);
}

function readCatalog() {
  try {
    return { ok: true as const, data: loadIngredientData() };
  } catch (err) {
    logIngredient(err instanceof CatalogMissingError ? "catalog_missing" : "catalog_invalid", err);
    return {
      ok: false as const,
      failure: {
        ok: false as const,
        status: 500,
        code: "CATALOG_UNAVAILABLE",
        message: "The ingredient catalog is not available.",
      },
    };
  }
}

function tokensFromText(text: string): { ok: true; tokens: ParsedToken[] } | IngredientFailure {
  const loaded = readCatalog();
  if (!loaded.ok) return loaded.failure;
  const tokens = matchTokens(text, loaded.data.catalog);
  if (tokens.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "The ingredient list is empty.",
    };
  }
  if (tokens.length > MAX_LABEL_TOKENS) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "The ingredient list is too long.",
    };
  }
  return { ok: true, tokens };
}

export async function createIngredientScan(
  input: CreateIngredientScanInput
): Promise<CreateIngredientScanResult> {
  const typed = input.text?.trim() ? input.text.trim() : null;
  if (input.idempotencyKey) {
    const existing = await query<{ id: string }>(
      `SELECT id FROM ingredient_scans WHERE user_id = $1 AND idempotency_key = $2`,
      [input.userId, input.idempotencyKey]
    );
    if (existing.rows[0]) {
      const scan = await loadOwned(input.userId, existing.rows[0].id);
      if (scan) return { ok: true, fresh: false, scan };
    }
  }

  if (!typed && (!input.bytes || !input.contentType)) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "Type an ingredient list or choose a JPEG, PNG, or WebP photo.",
    };
  }

  let parsed: ParsedToken[] | null = null;
  if (typed) {
    if (typed.length > MAX_LABEL_CHARS) {
      return {
        ok: false,
        status: 400,
        code: "VALIDATION",
        message: "The ingredient list is too long.",
      };
    }
    const tokens = tokensFromText(typed);
    if (!tokens.ok) return tokens;
    parsed = tokens.tokens;
  }

  const limited = await consumeRateLimit(input.userId, "ingredient_scan", 20, 86_400);
  if (!limited.ok) {
    return {
      ok: false,
      status: 429,
      code: "RATE_LIMITED",
      message: "Too many ingredient checks today.",
      limit: limited,
    };
  }

  try {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO ingredient_scans (
           user_id, status, ocr_text, parsed, confirmed_text, store_image, image_ref, idempotency_key
         ) VALUES (
           $1, $2, $3, $4::jsonb, NULL, false, NULL, $5
         ) RETURNING id`,
        [
          input.userId,
          typed ? "succeeded" : "queued",
          typed,
          parsed ? JSON.stringify(parsed) : null,
          input.idempotencyKey,
        ]
      );
      const id = inserted.rows[0].id;
      if (!typed) {
        await client.query(
          `INSERT INTO analysis_jobs (user_id, kind, status, idempotency_key, ingredient_scan_id)
           VALUES ($1, 'ingredient_ocr', 'queued', $2, $3)`,
          [input.userId, input.idempotencyKey, id]
        );
        if (input.storeRequested) {
          await client.query(
            `INSERT INTO consent_log (user_id, purpose, granted, policy_version)
             VALUES ($1, 'store_image', true, $2)`,
            [input.userId, POLICY_VERSION]
          );
        }
      }
      await client.query("COMMIT");
      const scan = await loadOwned(input.userId, id);
      if (!scan) {
        return {
          ok: false,
          status: 500,
          code: "SCAN_FAILED",
          message: "Could not start the ingredient check.",
        };
      }
      if (typed || !input.bytes || !input.contentType) {
        return { ok: true, fresh: true, scan };
      }
      return {
        ok: true,
        fresh: true,
        scan,
        work: {
          scanId: id,
          userId: input.userId,
          bytes: input.bytes,
          contentType: input.contentType,
          storeRequested: input.storeRequested,
        },
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (isUniqueViolation(err) && input.idempotencyKey) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM ingredient_scans WHERE user_id = $1 AND idempotency_key = $2`,
        [input.userId, input.idempotencyKey]
      );
      if (existing.rows[0]) {
        const scan = await loadOwned(input.userId, existing.rows[0].id);
        if (scan) return { ok: true, fresh: false, scan };
      }
      return {
        ok: false,
        status: 409,
        code: "IDEMPOTENCY_CONFLICT",
        message: "This idempotency key was already used.",
      };
    }
    logIngredient("ingredient_insert_failed", err);
    return {
      ok: false,
      status: 500,
      code: "SCAN_FAILED",
      message: "Could not start the ingredient check.",
    };
  }
}

type OcrCall =
  | { ok: true; status: "succeeded"; ocrText: string }
  | { ok: true; status: "rejected_quality" }
  | { ok: false; code: string; message: string };

function letterCount(text: string): number {
  return (text.match(/[A-Za-z]/g) ?? []).length;
}

function parseOcrPayload(input: unknown): OcrCall | null {
  if (!input || typeof input !== "object") return null;
  const status = (input as { status?: unknown }).status;
  const ocrText = (input as { ocrText?: unknown }).ocrText;
  if (status === "rejected_quality") return { ok: true, status: "rejected_quality" };
  if (status === "succeeded" && typeof ocrText === "string") {
    if (letterCount(ocrText) < MIN_OCR_LETTERS) return { ok: true, status: "rejected_quality" };
    return { ok: true, status: "succeeded", ocrText };
  }
  return null;
}

async function callOcr(bytes: Uint8Array, contentType: string): Promise<OcrCall> {
  const base = process.env.ML_SERVICE_URL?.replace(/\/$/, "");
  const token = process.env.ML_SERVICE_TOKEN;
  if (!base || !token) {
    return {
      ok: false,
      code: "ML_UNAVAILABLE",
      message: "The label service is not configured. No ingredient list was invented.",
    };
  }
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${base}/internal/v1/ingredient-scans`, {
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
      message: "The label service could not be reached. No ingredient list was invented.",
    };
  }
  const durationMs = Date.now() - started;
  if (res.status === 503) {
    const json: unknown = await res.json().catch(() => null);
    const detail =
      json && typeof json === "object" ? (json as { detail?: { code?: unknown } }).detail : undefined;
    const code = detail && typeof detail.code === "string" ? detail.code : "OCR_UNAVAILABLE";
    console.log(
      JSON.stringify({
        level: "info",
        route: "ingredient_ocr",
        code,
        durationMs,
      })
    );
    return {
      ok: false,
      code,
      message: "The label could not be read. No ingredient list was invented.",
    };
  }
  if (!res.ok) {
    console.log(
      JSON.stringify({
        level: "info",
        route: "ingredient_ocr",
        code: "ML_UNAVAILABLE",
        durationMs,
      })
    );
    return {
      ok: false,
      code: "ML_UNAVAILABLE",
      message: "The label service rejected the photo. No ingredient list was invented.",
    };
  }
  const json: unknown = await res.json().catch(() => null);
  const parsed = parseOcrPayload(json);
  console.log(
    JSON.stringify({
      level: "info",
      route: "ingredient_ocr",
      code: parsed?.ok ? parsed.status : "ML_UNAVAILABLE",
      durationMs,
    })
  );
  if (!parsed) {
    return {
      ok: false,
      code: "ML_UNAVAILABLE",
      message: "The label service returned an unusable result. No ingredient list was invented.",
    };
  }
  return parsed;
}

async function markFailed(scanId: string, userId: string, code: string) {
  await query(
    `UPDATE ingredient_scans
     SET status = 'failed', ocr_text = NULL, parsed = NULL, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status IN ('queued', 'running')`,
    [scanId, userId]
  );
  await query(
    `UPDATE analysis_jobs
     SET status = 'failed', error_code = $2, updated_at = NOW()
     WHERE ingredient_scan_id = $1 AND status IN ('queued', 'running')`,
    [scanId, code]
  );
  await query(`INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`, [
    userId,
    "Label could not be read",
    "No ingredient list was invented.",
  ]);
}

/**
 * Next.js is the only database writer. The photo is not written to disk here.
 * A missing OCR service fails the row. It does not invent ingredient text.
 */
export async function completeIngredientScan(input: IngredientWork): Promise<void> {
  try {
    const locked = await query(
      `UPDATE ingredient_scans SET status = 'running', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'queued'
       RETURNING id`,
      [input.scanId, input.userId]
    );
    if (!locked.rowCount) return;
    await query(
      `UPDATE analysis_jobs SET status = 'running', updated_at = NOW()
       WHERE ingredient_scan_id = $1 AND status = 'queued'`,
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
          `UPDATE ingredient_scans SET store_image = true, image_ref = $2, updated_at = NOW()
           WHERE id = $1 AND user_id = $3`,
          [input.scanId, stored.ref, input.userId]
        );
      }
    }

    const result = await callOcr(input.bytes, input.contentType);
    if (!result.ok) {
      await markFailed(input.scanId, input.userId, result.code);
      return;
    }
    if (result.status === "rejected_quality") {
      await finishQuality(input.scanId, input.userId);
      return;
    }
    if (result.ocrText.length > MAX_LABEL_CHARS) {
      await markFailed(input.scanId, input.userId, "OCR_TOO_LONG");
      return;
    }
    const loaded = readCatalog();
    if (!loaded.ok) {
      await query(
        `UPDATE ingredient_scans
         SET status = 'failed', ocr_text = $2, parsed = NULL, updated_at = NOW()
         WHERE id = $1 AND user_id = $3 AND status = 'running'`,
        [input.scanId, result.ocrText, input.userId]
      );
      await query(
        `UPDATE analysis_jobs
         SET status = 'failed', error_code = 'CATALOG_UNAVAILABLE', updated_at = NOW()
         WHERE ingredient_scan_id = $1 AND status IN ('queued', 'running')`,
        [input.scanId]
      );
      return;
    }
    const tokens = matchTokens(result.ocrText, loaded.data.catalog);
    if (tokens.length > MAX_LABEL_TOKENS) {
      await markFailed(input.scanId, input.userId, "OCR_TOO_LONG");
      return;
    }
    await finishRead(input.scanId, input.userId, result.ocrText, tokens);
  } catch (err) {
    logIngredient("ingredient_complete_failed", err);
    await markFailed(input.scanId, input.userId, "ML_UNAVAILABLE").catch((inner) =>
      logIngredient("ingredient_fail_update_failed", inner)
    );
  } finally {
    await discardLabelImage(input.userId, input.scanId).catch((inner) =>
      logIngredient("ingredient_image_discard_failed", inner)
    );
  }
}

async function finishQuality(scanId: string, userId: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE ingredient_scans
       SET status = 'rejected_quality', ocr_text = '', parsed = '[]'::jsonb, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'running'`,
      [scanId, userId]
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return;
    }
    await client.query(
      `UPDATE analysis_jobs
       SET status = 'succeeded', error_code = NULL, updated_at = NOW()
       WHERE ingredient_scan_id = $1`,
      [scanId]
    );
    await client.query(`INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`, [
      userId,
      "Label photo was not readable",
      "No ingredient list was invented. You can type the list instead.",
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function finishRead(scanId: string, userId: string, ocrText: string, tokens: ParsedToken[]) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE ingredient_scans
       SET status = 'succeeded', ocr_text = $2, parsed = $3::jsonb, updated_at = NOW()
       WHERE id = $1 AND user_id = $4 AND status = 'running'`,
      [scanId, ocrText, JSON.stringify(tokens), userId]
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return;
    }
    await client.query(
      `UPDATE analysis_jobs
       SET status = 'succeeded', error_code = NULL, updated_at = NOW()
       WHERE ingredient_scan_id = $1`,
      [scanId]
    );
    await client.query(`INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`, [
      userId,
      "Ingredient label read",
      "Check the text before a verdict.",
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function confirmIngredientScan(
  userId: string,
  id: string,
  confirmedText: string
): Promise<{ ok: true; scan: PublicIngredientScan } | IngredientFailure> {
  const trimmed = confirmedText.trim();
  if (!trimmed || trimmed.length > MAX_LABEL_CHARS) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: trimmed ? "The ingredient list is too long." : "The ingredient list is empty.",
    };
  }
  const tokens = tokensFromText(trimmed);
  if (!tokens.ok) return tokens;
  const updated = await query<ScanRow>(
    `UPDATE ingredient_scans
     SET confirmed_text = $3, parsed = $4::jsonb, updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status IN ('succeeded', 'failed', 'rejected_quality')
     RETURNING id, status, ocr_text, parsed, confirmed_text, store_image, image_ref`,
    [id, userId, trimmed, JSON.stringify(tokens.tokens)]
  );
  const row = updated.rows[0];
  if (row) return { ok: true, scan: toPublic(row) };
  const existing = await loadOwned(userId, id);
  if (!existing) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Ingredient scan not found." };
  }
  return {
    ok: false,
    status: 409,
    code: "SCAN_NOT_READY",
    message: "The label is still being read.",
  };
}

function allergyList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function loadProfile(userId: string): Promise<IngredientProfile> {
  const found = await query<{
    pregnant_or_feeding: boolean;
    fragrance_sensitive: boolean;
    self_described_sensitive: boolean;
    allergies: unknown;
  }>(
    `SELECT pregnant_or_feeding, fragrance_sensitive, self_described_sensitive, allergies
     FROM profiles WHERE user_id = $1`,
    [userId]
  );
  const recovery = await query<{ id: string }>(
    `SELECT id FROM procedure_recoveries WHERE user_id = $1 AND active = true LIMIT 1`,
    [userId]
  );
  const row = found.rows[0];
  if (!row) {
    return { ...EMPTY_PROFILE, recoveryActive: Boolean(recovery.rows[0]) };
  }
  return {
    pregnantOrFeeding: row.pregnant_or_feeding,
    fragranceSensitive: row.fragrance_sensitive,
    selfDescribedSensitive: row.self_described_sensitive,
    recoveryActive: Boolean(recovery.rows[0]),
    allergies: allergyList(row.allergies),
  };
}

export async function analyzeIngredientText(
  userId: string,
  text: string
): Promise<{ ok: true; verdict: PublicVerdict } | IngredientFailure> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_LABEL_CHARS) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: trimmed ? "The ingredient list is too long." : "The ingredient list is empty.",
    };
  }
  const loaded = readCatalog();
  if (!loaded.ok) return loaded.failure;
  const tokens = matchTokens(trimmed, loaded.data.catalog);
  if (tokens.length === 0) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "The ingredient list is empty.",
    };
  }
  if (tokens.length > MAX_LABEL_TOKENS) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "The ingredient list is too long.",
    };
  }
  const verdict = evaluateVerdict(
    tokens,
    loaded.data.pack,
    loaded.data.catalog,
    await loadProfile(userId)
  );
  if (!verdict.ok) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION",
      message: "The ingredient list is empty.",
    };
  }
  return {
    ok: true,
    verdict: {
      verdict: verdict.verdict,
      reasons: verdict.reasons,
      unparsed: verdict.unparsed,
      ingredients: explainMatched(tokens, loaded.data.catalog),
      rulesetVersion: verdict.rulesetVersion,
      disclaimer: DISCLAIMER,
    },
  };
}

export async function analyzeOwnedIngredientScan(
  userId: string,
  id: string
): Promise<{ ok: true; verdict: PublicVerdict } | IngredientFailure> {
  const scan = await loadOwned(userId, id);
  if (!scan) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Ingredient scan not found." };
  }
  if (!scan.confirmedText) {
    return {
      ok: false,
      status: 400,
      code: "CONFIRM_REQUIRED",
      message: "Confirm the ingredient text before checking it.",
    };
  }
  return analyzeIngredientText(userId, scan.confirmedText);
}
