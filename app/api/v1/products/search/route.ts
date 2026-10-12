import { searchProducts } from "@riru/shared";
import { requireActorV1 } from "@/lib/actor";
import { openRecommendData } from "@/lib/recommend-catalog";

export const dynamic = "force-dynamic";

const KINDS = ["cleanser", "treatment", "moisturizer", "spf", "extra"];
const BUDGETS = ["low", "mid", "high"];

function v1Error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(req: Request) {
  const started = Date.now();
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;

    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? undefined;
    const stepKind = url.searchParams.get("stepKind") ?? undefined;
    const budget = url.searchParams.get("budget") ?? undefined;
    if (q && q.length > 200) {
      return v1Error(400, "VALIDATION", "q is too long.");
    }
    if (stepKind && !KINDS.includes(stepKind)) {
      return v1Error(
        400,
        "VALIDATION",
        "stepKind must be cleanser, treatment, moisturizer, spf, or extra."
      );
    }
    if (budget && !BUDGETS.includes(budget)) {
      return v1Error(400, "VALIDATION", "budget must be low, mid, or high.");
    }

    const loaded = openRecommendData();
    if (!loaded.ok) return v1Error(loaded.status, loaded.code, loaded.message);
    return Response.json({
      products: searchProducts(loaded.data.products, { q, stepKind, budget }),
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/products/search",
        code: "product_search_failed",
        name: err instanceof Error ? err.name : "Error",
        durationMs: Date.now() - started,
      })
    );
    return v1Error(500, "CATALOG_UNAVAILABLE", "Could not search the catalog.");
  }
}
