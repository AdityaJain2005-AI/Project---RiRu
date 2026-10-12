import { requireActorV1 } from "@/lib/actor";
import { confirmIngredientScan, getOwnedIngredientScan } from "@/lib/ingredient-job";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function v1Error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const { id } = await ctx.params;
    if (!UUID.test(id)) return v1Error(404, "NOT_FOUND", "Ingredient scan not found.");
    const scan = await getOwnedIngredientScan(actor.userId, id);
    if (!scan) return v1Error(404, "NOT_FOUND", "Ingredient scan not found.");
    return Response.json(scan);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/ingredients/scans/:id",
        code: "ingredient_get_failed",
        name: err instanceof Error ? err.name : "Error",
      })
    );
    return v1Error(500, "SCAN_FAILED", "Could not load the ingredient scan.");
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const { id } = await ctx.params;
    if (!UUID.test(id)) return v1Error(404, "NOT_FOUND", "Ingredient scan not found.");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return v1Error(400, "VALIDATION", "Send confirmedText as JSON.");
    }
    const confirmedText =
      body && typeof body === "object" ? (body as { confirmedText?: unknown }).confirmedText : undefined;
    if (typeof confirmedText !== "string") {
      return v1Error(400, "VALIDATION", "Send confirmedText as text.");
    }

    const saved = await confirmIngredientScan(actor.userId, id, confirmedText);
    if (!saved.ok) return v1Error(saved.status, saved.code, saved.message);
    return Response.json(saved.scan);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/ingredients/scans/:id",
        code: "ingredient_patch_failed",
        name: err instanceof Error ? err.name : "Error",
      })
    );
    return v1Error(500, "SCAN_FAILED", "Could not save the ingredient text.");
  }
}
