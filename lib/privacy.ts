import { DISCLAIMER } from "@riru/shared";
import { getPool, query } from "./db.ts";
import { getStorage } from "./storage.ts";
import { loadRecovery } from "./recovery.ts";

export const POLICY_VERSION = "2026-10-13";

const CONSENT_PURPOSES = [
  "camera_analysis",
  "store_image",
  "training_opt_in",
  "chat_context",
  "delete_image_after",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export function isConsentPurpose(value: string): value is ConsentPurpose {
  return (CONSENT_PURPOSES as readonly string[]).includes(value);
}

export async function recordConsent(input: {
  userId: string;
  purpose: ConsentPurpose;
  granted: boolean;
  policyVersion: string;
}): Promise<{ id: string; purpose: ConsentPurpose; granted: boolean }> {
  const saved = await query<{ id: string }>(
    `INSERT INTO consent_log (user_id, purpose, granted, policy_version)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.userId, input.purpose, input.granted, input.policyVersion]
  );
  return { id: saved.rows[0].id, purpose: input.purpose, granted: input.granted };
}

export async function imageRetention(userId: string): Promise<boolean> {
  const found = await query<{ delete_image_after_analysis: boolean }>(
    `SELECT delete_image_after_analysis FROM profiles WHERE user_id = $1`,
    [userId]
  );
  return found.rows[0]?.delete_image_after_analysis !== false;
}

export async function setImageRetention(userId: string, deleteAfterAnalysis: boolean): Promise<boolean> {
  await query(
    `UPDATE profiles SET delete_image_after_analysis = $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, deleteAfterAnalysis]
  );
  await recordConsent({
    userId,
    purpose: "delete_image_after",
    granted: deleteAfterAnalysis,
    policyVersion: POLICY_VERSION,
  });
  return deleteAfterAnalysis;
}

export async function discardFaceImage(userId: string, scanId: string): Promise<void> {
  await discardStoredImage(userId, "skin_scans", scanId);
}

export async function discardLabelImage(userId: string, scanId: string): Promise<void> {
  await discardStoredImage(userId, "ingredient_scans", scanId);
}

async function discardStoredImage(
  userId: string,
  table: "skin_scans" | "ingredient_scans",
  scanId: string
): Promise<void> {
  if (!(await imageRetention(userId))) return;
  const found = await query<{ image_ref: string | null }>(
    `SELECT image_ref FROM ${table} WHERE id = $1 AND user_id = $2`,
    [scanId, userId]
  );
  const ref = found.rows[0]?.image_ref;
  if (!ref) return;
  await getStorage().deleteObject(ref);
  await query(
    `UPDATE ${table} SET store_image = false, image_ref = NULL, updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [scanId, userId]
  );
}

export async function exportMyData(userId: string) {
  const profile = await query(
    `SELECT age_range, skin_goals, allergies, budget, currency, locale,
            pregnant_or_feeding, fragrance_sensitive, self_described_sensitive,
            allow_scan_in_chat, delete_image_after_analysis
     FROM profiles WHERE user_id = $1`,
    [userId]
  );
  const recoveryNote = await query<{ clinician_note: string }>(
    `SELECT clinician_note FROM procedure_recoveries
     WHERE user_id = $1 AND active = true
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const recovery = await loadRecovery(userId);
  const scans = await query(
    `SELECT id, status, analysis_kind, overall_score, summary, store_image,
            (image_ref IS NOT NULL) AS image_stored, created_at
     FROM skin_scans WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  const routines = await query(
    `SELECT id, summary, ruleset_version, created_at FROM routines
     WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  const ingredientScans = await query(
    `SELECT id, status, ocr_text, parsed, store_image,
            (image_ref IS NOT NULL) AS image_stored, created_at
     FROM ingredient_scans WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  const chat = await query(
    `SELECT id, role, content, citations, created_at FROM chat_messages
     WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  const feedback = await query(
    `SELECT id, topic, target_ref, message, page_url, created_at
     FROM feedback_reports WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  const consents = await query(
    `SELECT id, purpose, granted, policy_version, created_at
     FROM consent_log WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  const checkIns = await query(
    `SELECT id, to_char(day, 'YYYY-MM-DD') AS day, routine_id, completed_step_ids, note, created_at
     FROM check_ins WHERE user_id = $1 ORDER BY day ASC`,
    [userId]
  );
  const prefs = await query(
    `SELECT routine_phase, favorite_ingredients, settings FROM user_prefs WHERE user_id = $1`,
    [userId]
  );
  return {
    exportedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    profile: {
      ...(profile.rows[0] ?? {}),
      recovery: {
        ...recovery,
        clinicianNote: recoveryNote.rows[0]?.clinician_note ?? "",
      },
    },
    scans: scans.rows,
    routines: routines.rows,
    ingredientScans: ingredientScans.rows,
    chat: chat.rows,
    feedback: feedback.rows,
    consents: consents.rows,
    checkIns: checkIns.rows,
    prefs: prefs.rows[0] ?? null,
  };
}

export async function deleteMyData(userId: string, requestId: string) {
  const existing = await query<{ request_id: string; completed_at: Date }>(
    `SELECT request_id, completed_at FROM deletion_receipts WHERE request_id = $1`,
    [requestId]
  );
  if (existing.rows[0]) {
    return {
      requestId: existing.rows[0].request_id,
      completedAt: existing.rows[0].completed_at.toISOString(),
      replayed: true,
    };
  }

  const images = await query<{ image_ref: string }>(
    `SELECT image_ref FROM skin_scans WHERE user_id = $1 AND image_ref IS NOT NULL
     UNION ALL
     SELECT image_ref FROM ingredient_scans WHERE user_id = $1 AND image_ref IS NOT NULL`,
    [userId]
  );
  const storage = getStorage();
  for (const row of images.rows) {
    await storage.deleteObject(row.image_ref).catch(() => undefined);
  }

  const owner = await query<{ auth_provider: string }>(
    `SELECT auth_provider FROM users WHERE id = $1`,
    [userId]
  );
  const demo = owner.rows[0]?.auth_provider === "demo";
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM check_ins WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM routines WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM skin_scans WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM ingredient_scans WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM analysis_jobs WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM procedure_recoveries WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM chat_messages WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM chat_sessions WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM notifications WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM consent_log WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM feedback_reports WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM price_listings WHERE submitted_by = $1`, [userId]);
    await client.query(`DELETE FROM rate_limit_buckets WHERE user_id = $1`, [userId]);
    if (demo) {
      await client.query(
        `UPDATE profiles SET
           age_range = 'undisclosed',
           skin_goals = '[]'::jsonb,
           allergies = '[]'::jsonb,
           budget = 'any',
           pregnant_or_feeding = false,
           fragrance_sensitive = false,
           self_described_sensitive = false,
           allow_scan_in_chat = false,
           delete_image_after_analysis = true,
           updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );
      await client.query(
        `UPDATE user_prefs SET routine_phase = 'am', favorite_ingredients = '[]'::jsonb,
           settings = '{}'::jsonb, updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );
    } else {
      await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    }
    const receipt = await client.query<{ request_id: string; completed_at: Date }>(
      `INSERT INTO deletion_receipts (request_id) VALUES ($1)
       RETURNING request_id, completed_at`,
      [requestId]
    );
    await client.query("COMMIT");
    return {
      requestId: receipt.rows[0].request_id,
      completedAt: receipt.rows[0].completed_at.toISOString(),
      replayed: false,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    const again = await query<{ request_id: string; completed_at: Date }>(
      `SELECT request_id, completed_at FROM deletion_receipts WHERE request_id = $1`,
      [requestId]
    );
    if (again.rows[0]) {
      return {
        requestId: again.rows[0].request_id,
        completedAt: again.rows[0].completed_at.toISOString(),
        replayed: true,
      };
    }
    throw err;
  } finally {
    client.release();
  }
}
