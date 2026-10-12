import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const DISCLAIMER = "Informational only, not a medical diagnosis.";
const live = process.env.RIRU_INTEGRATION === "1";

function dbConfig() {
  return {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER ?? "riru",
    password: process.env.DB_PASS ?? "riru",
    database: process.env.DB_NAME ?? "riru",
  };
}

test(
  "a real scan, routine, and pasted price are stored in Postgres",
  { skip: live ? false : "set RIRU_INTEGRATION=1 with Postgres and the dev server" },
  async () => {
    const base = process.env.RIRU_BASE_URL ?? "http://127.0.0.1:3000";
    const pool = new pg.Pool(dbConfig());
    let scanId = "";
    let routineId = "";
    let priceId = "";
    try {
      const scanRes = await fetch(`${base}/api/scans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: "camera", captured: true }),
      });
      const scanBody = (await scanRes.json()) as {
        ok?: boolean;
        scan?: { id?: string };
        error?: string;
      };
      assert.equal(scanRes.status, 200, JSON.stringify(scanBody));
      assert.equal(scanBody.ok, true);
      scanId = scanBody.scan?.id ?? "";
      assert.match(scanId, /^[0-9a-f-]{36}$/i);

      const routineRes = await fetch(`${base}/api/v1/recommendations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disclaimerAck: true, scanId }),
      });
      const routineBody = (await routineRes.json()) as {
        id?: string;
        disclaimer?: string;
        summary?: string;
        steps?: { product: { id: string } | null }[];
        error?: { code?: string; message?: string };
      };
      assert.equal(routineRes.status, 201, JSON.stringify(routineBody));
      routineId = routineBody.id ?? "";
      assert.match(routineId, /^[0-9a-f-]{36}$/i);
      assert.equal(routineBody.disclaimer, DISCLAIMER);
      assert.match(routineBody.summary ?? "", /sample score/i);
      const productId = routineBody.steps?.find((step) => step.product)?.product?.id;
      assert.ok(productId, "expected an example product on a non-severe step");

      const priceRes = await fetch(`${base}/api/v1/products/${productId}/prices`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          priceCents: 1299,
          currency: "USD",
          url: "https://example.com/riru-pasted-price",
        }),
      });
      const priceBody = (await priceRes.json()) as {
        id?: string;
        provider?: string;
        priceCents?: number;
        error?: { code?: string };
      };
      assert.equal(priceRes.status, 201, JSON.stringify(priceBody));
      priceId = priceBody.id ?? "";
      assert.equal(priceBody.provider, "manual");
      assert.equal(priceBody.priceCents, 1299);

      const scanRow = await pool.query<{
        analysis_kind: string;
        status: string;
        user_id: string;
      }>(
        `SELECT analysis_kind, status, user_id FROM skin_scans WHERE id = $1`,
        [scanId]
      );
      assert.equal(scanRow.rows[0]?.analysis_kind, "heuristic_v0");
      assert.equal(scanRow.rows[0]?.status, "succeeded");
      assert.equal(scanRow.rows[0]?.user_id, DEMO_USER_ID);

      const routineRow = await pool.query<{ scan_id: string; user_id: string }>(
        `SELECT scan_id, user_id FROM routines WHERE id = $1`,
        [routineId]
      );
      assert.equal(routineRow.rows[0]?.scan_id, scanId);
      assert.equal(routineRow.rows[0]?.user_id, DEMO_USER_ID);

      const steps = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM routine_steps WHERE routine_id = $1`,
        [routineId]
      );
      assert.ok(Number(steps.rows[0]?.count) >= 1);

      const priceRow = await pool.query<{
        provider: string;
        price_cents: number;
        url: string;
        submitted_by: string;
      }>(
        `SELECT provider, price_cents, url, submitted_by FROM price_listings WHERE id = $1`,
        [priceId]
      );
      assert.equal(priceRow.rows[0]?.provider, "manual");
      assert.equal(priceRow.rows[0]?.price_cents, 1299);
      assert.equal(priceRow.rows[0]?.url, "https://example.com/riru-pasted-price");
      assert.equal(priceRow.rows[0]?.submitted_by, DEMO_USER_ID);
    } finally {
      await pool.query(`DELETE FROM price_listings WHERE id = $1`, [priceId]).catch(() => undefined);
      await pool.query(`DELETE FROM routines WHERE id = $1`, [routineId]).catch(() => undefined);
      await pool.query(`DELETE FROM skin_scans WHERE id = $1`, [scanId]).catch(() => undefined);
      await pool.end();
    }
  }
);
