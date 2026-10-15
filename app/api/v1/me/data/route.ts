import { requireActorV1 } from "@/lib/actor";
import { deleteMyData } from "@/lib/privacy";
import { consumeRateLimit } from "@/lib/rate-limit";
import { v1Error } from "@/lib/v1";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const requestId = req.headers.get("idempotency-key")?.trim() ?? "";
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) {
      return v1Error(400, "VALIDATION", "Idempotency-Key must be 8 to 80 letters, numbers, _ or -.");
    }
    const limited = await consumeRateLimit(actor.userId, "delete_account", 5, 3_600);
    if (!limited.ok) {
      return v1Error(429, "RATE_LIMITED", "Too many delete requests this hour.", {
        "Retry-After": String(limited.retryAfter),
      });
    }
    const receipt = await deleteMyData(actor.userId, requestId);
    return Response.json({ requestId: receipt.requestId, completedAt: receipt.completedAt });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", route: "/api/v1/me/data", name: err instanceof Error ? err.name : "Error" }));
    return v1Error(500, "DELETE_FAILED", "Could not delete this account.");
  }
}
