import { query } from "./db";
import { isDemoMode } from "./session-token";

export type RateDecision = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
};

export async function consumeRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<RateDecision> {
  if (isDemoMode()) {
    return { ok: true, limit, remaining: limit, retryAfter: 0 };
  }

  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const res = await query<{ count: number }>(
    `INSERT INTO rate_limit_buckets (user_id, action, window_start, count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (user_id, action, window_start)
     DO UPDATE SET count = rate_limit_buckets.count + 1
     RETURNING count`,
    [userId, action, windowStart.toISOString()]
  );
  const count = res.rows[0]?.count ?? 1;
  const retryAfter = Math.max(
    1,
    Math.ceil((windowStart.getTime() + windowMs - Date.now()) / 1000)
  );
  if (count > limit) {
    return { ok: false, limit, remaining: 0, retryAfter };
  }
  return { ok: true, limit, remaining: Math.max(0, limit - count), retryAfter: 0 };
}

export function rateLimitResponse(decision: RateDecision, message: string): Response {
  return Response.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(decision.retryAfter),
        "X-RateLimit-Limit": String(decision.limit),
        "X-RateLimit-Remaining": String(decision.remaining),
      },
    }
  );
}
