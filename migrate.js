#!/usr/bin/env node
// Idempotent database migration. Run via `zsc execOnce` in
// initCommands — executes once per deploy version, not once
// per container, preventing race conditions in multi-container
// production setups.
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

async function migrate() {
  const client = await pool.connect();
  try {
    // IF NOT EXISTS + ON CONFLICT DO NOTHING make this script safe
    // to run multiple times — defense-in-depth alongside execOnce.
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
    console.log('Migration complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
