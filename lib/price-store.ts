import type { PoolClient } from "pg";
import { parseManualPrice } from "@riru/shared";
import { getPool, query } from "./db";
import { upsertCatalogProduct } from "./product-rows";
import { openRecommendData } from "./recommend-catalog";

export type StoredPrice = {
  id: string;
  provider: "manual" | "official";
  priceCents: number;
  currency: string;
  url: string;
  fetchedAt: string;
};

type Failure = { ok: false; status: number; code: string; message: string };

const NOT_FOUND: Failure = {
  ok: false,
  status: 404,
  code: "NOT_FOUND",
  message: "Product not found.",
};

function logPrice(code: string, err?: unknown, durationMs?: number) {
  const name = err instanceof Error ? err.name : undefined;
  const pgCode =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      route: "/api/v1/products/:id/prices",
      code,
      name,
      pgCode,
      durationMs,
    })
  );
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asProvider(value: string): StoredPrice["provider"] | null {
  if (value === "manual" || value === "official") return value;
  return null;
}

/**
 * Stored rows only. The pasted link is written to price_listings and is never requested.
 */
export async function listManualPrices(
  userId: string,
  productId: string
): Promise<{ ok: true; prices: StoredPrice[] } | Failure> {
  const loaded = openRecommendData();
  if (!loaded.ok) return loaded;
  if (!loaded.data.byId.has(productId)) return NOT_FOUND;
  const found = await query<{
    id: string;
    provider: string;
    price_cents: number;
    currency: string;
    url: string;
    fetched_at: Date | string;
  }>(
    `SELECT id, provider, price_cents, currency, url, fetched_at
     FROM price_listings
     WHERE product_id = $1 AND submitted_by = $2
     ORDER BY fetched_at DESC
     LIMIT 50`,
    [productId, userId]
  );
  const prices: StoredPrice[] = [];
  for (const row of found.rows) {
    const provider = asProvider(row.provider);
    if (!provider) continue;
    prices.push({
      id: row.id,
      provider,
      priceCents: row.price_cents,
      currency: row.currency,
      url: row.url,
      fetchedAt: iso(row.fetched_at),
    });
  }
  return { ok: true, prices };
}

export async function saveManualPrice(
  userId: string,
  productId: string,
  input: { priceCents: unknown; currency: unknown; url: unknown }
): Promise<{ ok: true; price: StoredPrice } | Failure> {
  const parsed = parseManualPrice(input);
  if (!parsed.ok) {
    return { ok: false, status: 400, code: "VALIDATION", message: parsed.message };
  }
  const loaded = openRecommendData();
  if (!loaded.ok) return loaded;
  const product = loaded.data.byId.get(productId);
  if (!product) return NOT_FOUND;

  const client: PoolClient = await getPool().connect();
  try {
    await client.query("BEGIN");
    await upsertCatalogProduct(client, product);
    const inserted = await client.query<{
      id: string;
      provider: string;
      price_cents: number;
      currency: string;
      url: string;
      fetched_at: Date | string;
    }>(
      `INSERT INTO price_listings (product_id, provider, price_cents, currency, url, submitted_by)
       VALUES ($1, 'manual', $2, $3, $4, $5)
       RETURNING id, provider, price_cents, currency, url, fetched_at`,
      [product.id, parsed.priceCents, parsed.currency, parsed.url, userId]
    );
    await client.query("COMMIT");
    const row = inserted.rows[0];
    const provider = row ? asProvider(row.provider) : null;
    if (!row || !provider) {
      return {
        ok: false,
        status: 500,
        code: "PRICE_FAILED",
        message: "Could not save the price.",
      };
    }
    return {
      ok: true,
      price: {
        id: row.id,
        provider,
        priceCents: row.price_cents,
        currency: row.currency,
        url: row.url,
        fetchedAt: iso(row.fetched_at),
      },
    };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Report the original failure.
    }
    logPrice("price_insert_failed", err);
    return {
      ok: false,
      status: 500,
      code: "PRICE_FAILED",
      message: "Could not save the price.",
    };
  } finally {
    client.release();
  }
}
