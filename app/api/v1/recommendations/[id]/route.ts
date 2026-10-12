import { requireActorV1 } from "@/lib/actor";
import { getRecommendation } from "@/lib/recommendation-job";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function v1Error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const started = Date.now();
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const { id } = await ctx.params;
    if (!UUID.test(id)) return v1Error(404, "NOT_FOUND", "Routine not found.");
    const result = await getRecommendation(actor.userId, id);
    if (!result.ok) return v1Error(result.status, result.code, result.message);
    return Response.json(result.routine);
  } catch (err) {
    const pgCode =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code)
        : undefined;
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/recommendations/:id",
        code: "recommendation_get_failed",
        name: err instanceof Error ? err.name : "Error",
        pgCode,
        durationMs: Date.now() - started,
      })
    );
    return v1Error(500, "ROUTINE_FAILED", "Could not load the routine.");
  }
}
