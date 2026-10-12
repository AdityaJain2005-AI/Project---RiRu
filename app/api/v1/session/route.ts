import { cookies } from "next/headers";
import { DISCLAIMER } from "@riru/shared";
import { getActorId, isDemoMode } from "@/lib/actor";
import { DEMO_USER_ID } from "@/lib/db";
import { createGuestUser } from "@/lib/guests";
import { clientIp, SESSION_COOKIE } from "@/lib/session-token";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (isDemoMode()) {
      return Response.json({
        user: { id: DEMO_USER_ID, mode: "demo" },
        disclaimer: DISCLAIMER,
      });
    }

    const existing = await getActorId();
    if (existing) {
      return Response.json({
        user: { id: existing, mode: "guest" },
        disclaimer: DISCLAIMER,
      });
    }

    const created = await createGuestUser(clientIp(req));
    if (!created.ok) {
      return Response.json(
        { error: { code: created.code, message: created.message } },
        {
          status: created.status,
          headers: created.retryAfter
            ? { "Retry-After": String(created.retryAfter) }
            : undefined,
        }
      );
    }

    const jar = await cookies();
    jar.set(SESSION_COOKIE, created.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    console.log(
      JSON.stringify({ level: "info", route: "/api/v1/session", code: "guest_created" })
    );

    return Response.json({
      user: { id: created.userId, mode: "guest" },
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/session",
        code: "guest_create_failed",
        name: err instanceof Error ? err.name : "Error",
      })
    );
    return Response.json(
      {
        error: {
          code: "SESSION_CREATE_FAILED",
          message: "Could not start a session.",
        },
      },
      { status: 500 }
    );
  }
}
