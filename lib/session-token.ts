import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "riru_session";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export class SessionSecretError extends Error {
  constructor() {
    super("SESSION_SECRET_MISSING");
    this.name = "SessionSecretError";
  }
}

/** Pepper for cookie hashes. Production refuses to run without a real secret. */
export function sessionPepper(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length >= 16) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "riru-dev-session-pepper-not-for-production";
  }
  throw new SessionSecretError();
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

export function hashIp(ip: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:ip:${ip}`).digest("hex");
}

export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  return real || null;
}
