import { requireActorV1 } from "@/lib/actor";
import { createRecommendation } from "@/lib/recommendation-job";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function v1Error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function logRoute(code: string, err: unknown, durationMs: number) {
  const pgCode =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      route: "/api/v1/recommendations",
      code,
      name: err instanceof Error ? err.name : "Error",
      pgCode,
      durationMs,
    })
  );
}

export async function POST(req: Request) {
  const started = Date.now();
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return v1Error(400, "VALIDATION", "Send the request as JSON.");
    }
    if (!body || typeof body !== "object") {
      return v1Error(400, "VALIDATION", "Send the request as JSON.");
    }
    const record = body as { disclaimerAck?: unknown; scanId?: unknown };
    if (record.disclaimerAck !== true) {
      return v1Error(
        400,
        "VALIDATION",
        "Confirm that this is informational only, not a medical diagnosis."
      );
    }
    let scanId: string | null = null;
    if (record.scanId !== undefined && record.scanId !== null) {
      if (typeof record.scanId !== "string" || !UUID.test(record.scanId)) {
        return v1Error(404, "NOT_FOUND", "Scan not found.");
      }
      scanId = record.scanId;
    }

    const result = await createRecommendation(actor.userId, scanId);
    if (!result.ok) return v1Error(result.status, result.code, result.message);
    return Response.json(result.routine, { status: 201 });
  } catch (err) {
    logRoute("recommendation_create_failed", err, Date.now() - started);
    return v1Error(500, "ROUTINE_FAILED", "Could not build the routine.");
  }
}
