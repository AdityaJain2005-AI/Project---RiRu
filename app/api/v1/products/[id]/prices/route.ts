import { requireActorV1 } from "@/lib/actor";
import { listManualPrices, saveManualPrice } from "@/lib/price-store";

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
      route: "/api/v1/products/:id/prices",
      code,
      name: err instanceof Error ? err.name : "Error",
      pgCode,
      durationMs,
    })
  );
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
    if (!UUID.test(id)) return v1Error(404, "NOT_FOUND", "Product not found.");
    const result = await listManualPrices(actor.userId, id);
    if (!result.ok) return v1Error(result.status, result.code, result.message);
    return Response.json({ prices: result.prices });
  } catch (err) {
    logRoute("price_list_failed", err, Date.now() - started);
    return v1Error(500, "PRICE_FAILED", "Could not load prices.");
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const started = Date.now();
  try {
    const actor = await requireActorV1();
    if (actor instanceof Response) return actor;
    const { id } = await ctx.params;
    if (!UUID.test(id)) return v1Error(404, "NOT_FOUND", "Product not found.");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return v1Error(400, "VALIDATION", "Send the price as JSON.");
    }
    if (!body || typeof body !== "object") {
      return v1Error(400, "VALIDATION", "Send the price as JSON.");
    }
    const record = body as { priceCents?: unknown; currency?: unknown; url?: unknown };
    const result = await saveManualPrice(actor.userId, id, {
      priceCents: record.priceCents,
      currency: record.currency,
      url: record.url,
    });
    if (!result.ok) return v1Error(result.status, result.code, result.message);
    return Response.json(result.price, { status: 201 });
  } catch (err) {
    logRoute("price_save_failed", err, Date.now() - started);
    return v1Error(500, "PRICE_FAILED", "Could not save the price.");
  }
}
