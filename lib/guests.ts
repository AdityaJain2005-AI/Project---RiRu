import { getPool, query } from "./db";
import {
  hashIp,
  hashSessionToken,
  newSessionToken,
  sessionPepper,
  SessionSecretError,
} from "./session-token";

const GUEST_IP_DAILY = 20;

export type GuestCreateResult =
  | { ok: true; token: string; userId: string }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      retryAfter?: number;
    };

export async function createGuestUser(ip: string | null): Promise<GuestCreateResult> {
  let pepper: string;
  try {
    pepper = sessionPepper();
  } catch (err) {
    if (err instanceof SessionSecretError) {
      return {
        ok: false,
        status: 503,
        code: "SESSION_SECRET_MISSING",
        message: "Session secret is not configured.",
      };
    }
    throw err;
  }

  if (ip) {
    const ipHash = hashIp(ip, pepper);
    const bucket = await query<{ created_count: number }>(
      `INSERT INTO guest_signup_windows (ip_hash, window_start, created_count)
       VALUES ($1, date_trunc('day', NOW()), 1)
       ON CONFLICT (ip_hash, window_start)
       DO UPDATE SET created_count = guest_signup_windows.created_count + 1
       RETURNING created_count`,
      [ipHash]
    );
    if ((bucket.rows[0]?.created_count ?? 1) > GUEST_IP_DAILY) {
      return {
        ok: false,
        status: 429,
        code: "RATE_LIMITED",
        message: "Too many new sessions from this network today.",
        retryAfter: secondsUntilNextUtcDay(),
      };
    }
  }

  const token = newSessionToken();
  const hash = hashSessionToken(token, pepper);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO users (name, initials, skin_type, streak_days, auth_provider, guest_token_hash)
       VALUES ('Guest', 'G', 'unknown', 0, 'guest', $1)
       RETURNING id`,
      [hash]
    );
    const userId = inserted.rows[0]?.id;
    if (!userId) throw new Error("Guest insert returned no id");
    await client.query(`INSERT INTO profiles (user_id) VALUES ($1)`, [userId]);
    await client.query(`INSERT INTO user_prefs (user_id) VALUES ($1)`, [userId]);
    await client.query("COMMIT");
    return { ok: true, token, userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function secondsUntilNextUtcDay(): number {
  const now = Date.now();
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next.getTime() - now) / 1000));
}
