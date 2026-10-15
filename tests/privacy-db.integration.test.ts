import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { deleteMyData, discardFaceImage, exportMyData } from "../lib/privacy.ts";
import { setRecoveryMode } from "../lib/recovery.ts";

const live = process.env.RIRU_INTEGRATION === "1";

function pool() {
  return new pg.Pool({
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER ?? "riru",
    password: process.env.DB_PASS ?? "riru",
    database: process.env.DB_NAME ?? "riru",
  });
}

test(
  "export keeps a clinician note and delete removes the throwaway account",
  { skip: live ? false : "set RIRU_INTEGRATION=1 with Postgres" },
  async () => {
    const db = pool();
    const userId = randomUUID();
    const scanId = randomUUID();
    try {
      await db.query(
        `INSERT INTO users (id, name, initials, auth_provider)
         VALUES ($1, 'Phase6', 'P6', 'guest')`,
        [userId]
      );
      await db.query(`INSERT INTO profiles (user_id) VALUES ($1)`, [userId]);
      await db.query(
        `INSERT INTO skin_scans (id, user_id, overall_score, metrics, concerns, ingredients, summary, status, analysis_kind, image_ref, store_image)
         VALUES ($1, $2, NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'throwaway', 'succeeded', 'baseline_cv_v1', 'guest/photo', true)`,
        [scanId, userId]
      );

      const recovery = await setRecoveryMode({
        userId,
        active: true,
        procedureType: "laser",
        procedureOn: "2026-10-01",
        clinicianNote: "secret clinician note",
      });
      assert.equal(recovery.active, true);
      assert.equal(JSON.stringify(recovery).includes("secret clinician note"), false);

      await discardFaceImage(userId, scanId);
      const image = await db.query<{ image_ref: string | null }>(
        `SELECT image_ref FROM skin_scans WHERE id = $1`,
        [scanId]
      );
      assert.equal(image.rows[0]?.image_ref, null);

      const exported = await exportMyData(userId);
      const bundle = exported as { profile: { recovery: { clinicianNote?: string } } };
      assert.equal(bundle.profile.recovery.clinicianNote, "secret clinician note");

      const requestId = `phase6-${randomUUID()}`;
      const first = await deleteMyData(userId, requestId);
      const second = await deleteMyData(userId, requestId);
      assert.equal(first.replayed, false);
      assert.equal(second.replayed, true);
      assert.equal(second.requestId, first.requestId);
      const gone = await db.query(`SELECT id FROM users WHERE id = $1`, [userId]);
      assert.equal(gone.rowCount, 0);
      const note = await db.query(`SELECT id FROM procedure_recoveries WHERE user_id = $1`, [userId]);
      assert.equal(note.rowCount, 0);
    } finally {
      await db.query(`DELETE FROM deletion_receipts WHERE request_id LIKE 'phase6-%'`).catch(() => undefined);
      await db.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
      await db.end();
    }
  }
);
