import { requireActorV1 } from "@/lib/actor";
import { exportMyData } from "@/lib/privacy";
import { consumeRateLimit } from "@/lib/rate-limit";
import { v1Error } from "@/lib/v1";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const limited = await consumeRateLimit(actor.userId, "export", 10, 3_600);
    if (!limited.ok) {
      return v1Error(429, "RATE_LIMITED", "Too many exports this hour.", {
        "Retry-After": String(limited.retryAfter),
      });
    }
    const bundle = await exportMyData(actor.userId);
    return Response.json(bundle, {
      headers: { "content-disposition": "attachment; filename=\"riru-export.json\"" },
    });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", route: "/api/v1/me/export", name: err instanceof Error ? err.name : "Error" }));
    return v1Error(500, "EXPORT_FAILED", "Could not export this account.");
  }
}
