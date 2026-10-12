import { cookies } from "next/headers";
import { DEMO_USER_ID, query } from "./db";
import { hashSessionToken, isDemoMode, SESSION_COOKIE, sessionPepper } from "./session-token";

export { isDemoMode };

export async function getActorId(): Promise<string | null> {
  if (isDemoMode()) return DEMO_USER_ID;

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let hash: string;
  try {
    hash = hashSessionToken(token, sessionPepper());
  } catch {
    return null;
  }

  const found = await query<{ id: string }>(
    `SELECT id FROM users
     WHERE guest_token_hash = $1 AND deleted_at IS NULL AND auth_provider = 'guest'`,
    [hash]
  );
  const id = found.rows[0]?.id;
  if (!id) return null;

  await query(
    `UPDATE users SET updated_at = NOW() WHERE id = $1 AND auth_provider = 'guest'`,
    [id]
  );
  return id;
}

/** Legacy routes keep `{ error: string }` so the current UI can show it. */
export async function requireActor(): Promise<{ userId: string } | Response> {
  const userId = await getActorId();
  if (!userId) {
    return Response.json({ error: "Session required." }, { status: 401 });
  }
  return { userId };
}

/** `/api/v1` routes use `{ error: { code, message } }`. */
export async function requireActorV1(): Promise<{ userId: string } | Response> {
  const userId = await getActorId();
  if (!userId) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Session required." } },
      { status: 401 }
    );
  }
  return { userId };
}
