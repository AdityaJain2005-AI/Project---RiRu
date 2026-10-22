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
        skin_type   TEXT NOT NULL DEFAULT 'Not set',
        streak_days INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(
      `
      INSERT INTO users (id, name, initials, skin_type, streak_days)
      VALUES ($1, 'Anonymous', 'AN', 'Not set', 0)
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
