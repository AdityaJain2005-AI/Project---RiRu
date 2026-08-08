#!/usr/bin/env node
// Idempotent database migration. Run via `zsc execOnce` in
// initCommands — executes once per deploy version.
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS greetings (
        id      INTEGER PRIMARY KEY,
        message TEXT NOT NULL
      );
    `);
    await client.query(`
      INSERT INTO greetings (id, message)
      VALUES (1, 'Facelab is live on Zerops!')
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL,
        initials    TEXT NOT NULL,
        skin_type   TEXT NOT NULL DEFAULT 'Combination',
        streak_days INTEGER NOT NULL DEFAULT 1,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `
      INSERT INTO users (id, name, initials, skin_type, streak_days)
      VALUES ($1, 'Maya Chen', 'MC', 'Combination', 12)
      ON CONFLICT (id) DO NOTHING;
    `,
      [DEMO_USER_ID]
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS skin_scans (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        overall_score INTEGER NOT NULL,
        metrics       JSONB NOT NULL,
        concerns      JSONB NOT NULL,
        ingredients   JSONB NOT NULL,
        summary       TEXT NOT NULL DEFAULT '',
        source        TEXT NOT NULL DEFAULT 'camera',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS skin_scans_user_created_idx
      ON skin_scans (user_id, created_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role       TEXT NOT NULL CHECK (role IN ('user', 'ai')),
        content    TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx
      ON chat_messages (user_id, created_at ASC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_prefs (
        user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        routine_phase    TEXT NOT NULL DEFAULT 'am' CHECK (routine_phase IN ('am', 'pm')),
        favorite_ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
        settings         JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(
      `
      INSERT INTO user_prefs (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING;
    `,
      [DEMO_USER_ID]
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        body       TEXT NOT NULL,
        read       BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Seed first scan if none
    const { rows: scanCount } = await client.query(
      `SELECT COUNT(*)::int AS c FROM skin_scans WHERE user_id = $1`,
      [DEMO_USER_ID]
    );
    if (scanCount[0].c === 0) {
      const metrics = [
        { id: "hydration", label: "Hydration", score: 72, delta: 4, status: "good", tip: "Slightly below optimal. Layer a humectant serum AM/PM." },
        { id: "barrier", label: "Barrier", score: 81, delta: 6, status: "excellent", tip: "Ceramide levels look strong. Keep your current moisturizer." },
        { id: "texture", label: "Texture", score: 68, delta: -2, status: "fair", tip: "Mild roughness on cheeks. Gentle exfoliation 2×/week." },
        { id: "clarity", label: "Clarity", score: 74, delta: 8, status: "good", tip: "Post-inflammatory marks fading. Stay consistent with niacinamide." },
        { id: "elasticity", label: "Elasticity", score: 85, delta: 3, status: "excellent", tip: "Firmness is excellent for your age group. Maintain SPF daily." },
        { id: "pigment", label: "Even Tone", score: 63, delta: 1, status: "fair", tip: "UV-related unevenness on T-zone. Boost antioxidant serum." },
      ];
      const concerns = [
        { id: "pores", title: "Enlarged pores", severity: "Mild", zone: "T-zone", confidence: 0.91 },
        { id: "dryness", title: "Dehydration lines", severity: "Moderate", zone: "Cheeks", confidence: 0.86 },
        { id: "spots", title: "Post-acne marks", severity: "Mild", zone: "Jawline", confidence: 0.78 },
      ];
      const ingredients = [
        { name: "Niacinamide 5%", role: "Brighten", match: 96, tone: "emerald" },
        { name: "Hyaluronic Acid", role: "Hydrate", match: 94, tone: "teal" },
        { name: "Ceramide NP", role: "Barrier", match: 91, tone: "emerald" },
        { name: "Azelaic Acid 10%", role: "Calm", match: 88, tone: "teal" },
        { name: "Vitamin C 15%", role: "Antioxidant", match: 85, tone: "emerald" },
        { name: "Peptide Complex", role: "Firm", match: 82, tone: "teal" },
      ];
      await client.query(
        `
        INSERT INTO skin_scans (user_id, overall_score, metrics, concerns, ingredients, summary, source)
        VALUES ($1, 78, $2::jsonb, $3::jsonb, $4::jsonb, $5, 'seed')
      `,
        [
          DEMO_USER_ID,
          JSON.stringify(metrics),
          JSON.stringify(concerns),
          JSON.stringify(ingredients),
          "Barrier and clarity improved; hydration and even tone still have room to grow this cycle.",
        ]
      );

      await client.query(
        `
        INSERT INTO chat_messages (user_id, role, content) VALUES
        ($1, 'ai', 'Your barrier score jumped this week — great recovery. Want me to tweak tonight''s routine for your humidity drop?'),
        ($1, 'user', 'Yes, keep it simple. I only have 5 minutes PM.'),
        ($1, 'ai', 'Done. Single gel cleanse, azelaic 3×/week, 2-min mask Sundays. Hydration should hit 80+ in ~10 days.')
      `,
        [DEMO_USER_ID]
      );

      await client.query(
        `
        INSERT INTO notifications (user_id, title, body) VALUES
        ($1, 'Scan streak', 'You are on a 12-day scan streak — keep it going.'),
        ($1, 'Routine tip', 'Wait 60s between serum and cream for better absorption.')
      `,
        [DEMO_USER_ID]
      );
    }

    console.log("Migration complete (Facelab schema).");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
