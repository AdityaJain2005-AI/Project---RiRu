import { requireActorV1 } from "@/lib/actor";
import { analyzeIngredientText, analyzeOwnedIngredientScan } from "@/lib/ingredient-job";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function v1Error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return v1Error(400, "VALIDATION", "Send the check as JSON.");
    }
    if (!body || typeof body !== "object") {
      return v1Error(400, "VALIDATION", "Send the check as JSON.");
    }
    const record = body as { disclaimerAck?: unknown; inciNames?: unknown; ingredientScanId?: unknown };
    if (record.disclaimerAck !== true) {
      return v1Error(
        400,
        "VALIDATION",
        "Confirm that this is informational only, not a medical diagnosis."
      );
    }

    const hasNames = Array.isArray(record.inciNames);
    const hasScan = typeof record.ingredientScanId === "string" && record.ingredientScanId.length > 0;
    if (hasNames && hasScan) {
      return v1Error(400, "VALIDATION", "Send inciNames or an ingredient scan id, not both.");
    }
    if (!hasNames && !hasScan) {
      return v1Error(400, "VALIDATION", "Send inciNames or an ingredient scan id.");
    }

    if (hasScan) {
      const id = record.ingredientScanId as string;
      if (!UUID.test(id)) return v1Error(404, "NOT_FOUND", "Ingredient scan not found.");
      const result = await analyzeOwnedIngredientScan(actor.userId, id);
      if (!result.ok) return v1Error(result.status, result.code, result.message);
      return Response.json(result.verdict);
    }

    const names = record.inciNames as unknown[];
    if (names.some((name) => typeof name !== "string")) {
      return v1Error(400, "VALIDATION", "inciNames must be a list of strings.");
    }
    const result = await analyzeIngredientText(actor.userId, (names as string[]).join(", "));
    if (!result.ok) return v1Error(result.status, result.code, result.message);
    return Response.json(result.verdict);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/ingredients/analyze",
        code: "ingredient_analyze_failed",
        name: err instanceof Error ? err.name : "Error",
      })
    );
    return v1Error(500, "SCAN_FAILED", "Could not check the ingredient list.");
  }
}
