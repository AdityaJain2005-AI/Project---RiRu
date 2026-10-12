import { lookupIngredient, toIngredientRecord } from "@riru/shared";
import { CatalogMissingError, loadIngredientData } from "@/lib/ingredient-catalog";

export const dynamic = "force-dynamic";

function v1Error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(_req: Request, ctx: { params: Promise<{ inci: string }> }) {
  try {
    const { inci } = await ctx.params;
    let data: ReturnType<typeof loadIngredientData>;
    try {
      data = loadIngredientData();
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          route: "/api/v1/ingredients/:inci",
          code: err instanceof CatalogMissingError ? "catalog_missing" : "catalog_invalid",
          name: err instanceof Error ? err.name : "Error",
        })
      );
      return v1Error(500, "CATALOG_UNAVAILABLE", "The ingredient catalog is not available.");
    }
    const entry = lookupIngredient(data.catalog, inci);
    if (!entry) return v1Error(404, "NOT_FOUND", "Ingredient not found.");
    return Response.json(toIngredientRecord(entry));
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/ingredients/:inci",
        code: "ingredient_lookup_failed",
        name: err instanceof Error ? err.name : "Error",
      })
    );
    return v1Error(500, "SCAN_FAILED", "Could not load the ingredient.");
  }
}
