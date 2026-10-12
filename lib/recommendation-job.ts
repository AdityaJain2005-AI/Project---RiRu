import {
  DISCLAIMER,
  EMPTY_PROFILE,
  buildRoutine,
  listAlternatives,
  type BuiltRoutine,
  type FindingInput,
  type Period,
  type PublicProduct,
  type RecommendProfile,
  type StepKind,
} from "@riru/shared";
import type { PoolClient } from "pg";
import { getPool, query } from "./db";
import { upsertCatalogProduct } from "./product-rows";
import { openRecommendData, type RecommendData } from "./recommend-catalog";

const CONCERNS = new Set<FindingInput["concern"]>([
  "acne",
  "blackheads_pores",
  "pigmentation",
  "redness",
  "dark_circles",
  "texture",
  "fine_lines",
  "dehydration",
]);

const NO_SCAN = {
  ok: false as const,
  status: 409,
  code: "NO_SUCCEEDED_SCAN",
  message:
    "Save a face scan that succeeds before building a routine. A rejected photo does not count.",
};

const SCAN_MISSING = {
  ok: false as const,
  status: 404,
  code: "NOT_FOUND",
  message: "Scan not found.",
};

type Failure = { ok: false; status: number; code: string; message: string };

export type PublicRoutine = {
  id: string;
  rulesetVersion: string;
  summary: string;
  recoveryActive: boolean;
  clinicianOverridesApp: string | null;
  steps: BuiltRoutine["steps"];
  lifestyle: string[];
  disclaimer: typeof DISCLAIMER;
};

type ScanRow = {
  id: string;
  status: string;
  analysis_kind: string;
  concerns: unknown;
};

function logRecommend(code: string, err?: unknown) {
  const name = err instanceof Error ? err.name : undefined;
  const pgCode =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      route: "/api/v1/recommendations",
      code,
      name,
      pgCode,
    })
  );
}

function asSeverity(value: unknown): FindingInput["severity"] | null {
  if (typeof value !== "string") return null;
  const lowered = value.toLowerCase();
  if (lowered === "mild" || lowered === "moderate" || lowered === "severe" || lowered === "none") {
    return lowered;
  }
  return null;
}

function findingFrom(concern: unknown, severity: unknown): FindingInput | null {
  if (typeof concern !== "string" || !CONCERNS.has(concern as FindingInput["concern"])) return null;
  const parsed = asSeverity(severity);
  if (!parsed) return null;
  return { concern: concern as FindingInput["concern"], severity: parsed };
}

function findingsFromJson(value: unknown): FindingInput[] {
  if (!Array.isArray(value)) return [];
  const out: FindingInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as { concern?: unknown; id?: unknown; severity?: unknown };
    const found = findingFrom(record.concern ?? record.id, record.severity);
    if (found) out.push(found);
  }
  return out;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asBudget(value: unknown): RecommendProfile["budget"] {
  if (value === "low" || value === "mid" || value === "high" || value === "any") return value;
  return "any";
}

function asPeriod(value: string): Period | null {
  if (value === "am" || value === "pm" || value === "weekly") return value;
  return null;
}

function asKind(value: string): StepKind | null {
  if (
    value === "cleanser" ||
    value === "treatment" ||
    value === "moisturizer" ||
    value === "spf" ||
    value === "extra"
  ) {
    return value;
  }
  return null;
}

async function loadProfile(userId: string): Promise<{
  profile: RecommendProfile;
  recoveryId: string | null;
}> {
  const found = await query<{
    pregnant_or_feeding: boolean;
    fragrance_sensitive: boolean;
    self_described_sensitive: boolean;
    allergies: unknown;
    budget: string;
  }>(
    `SELECT pregnant_or_feeding, fragrance_sensitive, self_described_sensitive, allergies, budget
     FROM profiles WHERE user_id = $1`,
    [userId]
  );
  const recovery = await query<{ id: string }>(
    `SELECT id FROM procedure_recoveries
     WHERE user_id = $1 AND active = true
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  const recoveryId = recovery.rows[0]?.id ?? null;
  const row = found.rows[0];
  if (!row) {
    return {
      profile: { ...EMPTY_PROFILE, budget: "any", recoveryActive: recoveryId !== null },
      recoveryId,
    };
  }
  return {
    profile: {
      pregnantOrFeeding: row.pregnant_or_feeding,
      fragranceSensitive: row.fragrance_sensitive,
      selfDescribedSensitive: row.self_described_sensitive,
      recoveryActive: recoveryId !== null,
      allergies: stringList(row.allergies),
      budget: asBudget(row.budget),
    },
    recoveryId,
  };
}

async function findingsFor(scan: ScanRow): Promise<FindingInput[]> {
  const rows = await query<{ concern: string; severity: string }>(
    `SELECT concern, severity FROM scan_findings WHERE scan_id = $1 ORDER BY created_at ASC`,
    [scan.id]
  );
  if (rows.rows.length > 0) {
    const out: FindingInput[] = [];
    for (const row of rows.rows) {
      const found = findingFrom(row.concern, row.severity);
      if (found) out.push(found);
    }
    return out;
  }
  return findingsFromJson(scan.concerns);
}

function toCreated(id: string, built: BuiltRoutine): PublicRoutine {
  return {
    id,
    rulesetVersion: built.rulesetVersion,
    summary: built.summary,
    recoveryActive: built.recoveryActive,
    clinicianOverridesApp: built.clinicianOverridesApp,
    steps: built.steps,
    lifestyle: built.lifestyle,
    disclaimer: DISCLAIMER,
  };
}

function shorterProduct(record: RecommendData["products"][number]): PublicProduct {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    brand: record.brand,
    stepKind: record.stepKind,
    budget: record.budget,
    fragranceFree: record.fragranceFree,
    minimalIngredient: record.minimalIngredient,
    description: record.description,
    source: record.source,
    why: `Example formula, not a shop listing. Budget tier: ${record.budget}.`,
  };
}

function tierAlternatives(
  productId: string,
  data: RecommendData,
  profile: RecommendProfile
): PublicProduct[] {
  const record = data.byId.get(productId);
  if (!record) return [];
  const listed = listAlternatives(
    productId,
    data.products,
    profile,
    data.pack,
    data.irritancyAtLeast4
  );
  if (!listed) return [];
  const alternatives: PublicProduct[] = [];
  const tiers: Array<"low" | "mid" | "high"> = ["low", "mid", "high"];
  for (const tier of tiers) {
    if (tier === record.budget) continue;
    const hit = listed.alternatives.find((item) => item.product.budget === tier);
    if (!hit) continue;
    alternatives.push(hit.product);
    if (alternatives.length >= 2) break;
  }
  return alternatives;
}

export async function createRecommendation(
  userId: string,
  scanId: string | null
): Promise<{ ok: true; routine: PublicRoutine } | Failure> {
  const loaded = openRecommendData();
  if (!loaded.ok) return loaded;

  const scan = scanId
    ? await query<ScanRow>(
        `SELECT id, status, analysis_kind, concerns
         FROM skin_scans WHERE id = $1 AND user_id = $2`,
        [scanId, userId]
      )
    : await query<ScanRow>(
        `SELECT id, status, analysis_kind, concerns
         FROM skin_scans WHERE user_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [userId]
      );
  const row = scan.rows[0];
  if (!row) return scanId ? SCAN_MISSING : NO_SCAN;
  if (row.status !== "succeeded") return NO_SCAN;

  const { profile, recoveryId } = await loadProfile(userId);
  const findings = await findingsFor(row);
  const built = buildRoutine({
    products: loaded.data.products,
    pack: loaded.data.pack,
    profile,
    findings,
    analysisKind: row.analysis_kind,
    irritancyAtLeast4: loaded.data.irritancyAtLeast4,
  });

  const client: PoolClient = await getPool().connect();
  try {
    await client.query("BEGIN");
    const seen = new Set<string>();
    for (const step of built.steps) {
      const productId = step.product?.id;
      if (!productId || seen.has(productId)) continue;
      seen.add(productId);
      const record = loaded.data.byId.get(productId);
      if (!record) throw new Error("product_missing");
      await upsertCatalogProduct(client, record);
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO routines (user_id, scan_id, recovery_id, ruleset_version, summary, lifestyle)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id`,
      [
        userId,
        row.id,
        recoveryId,
        built.rulesetVersion,
        built.summary,
        JSON.stringify(built.lifestyle),
      ]
    );
    const routineId = inserted.rows[0]?.id;
    if (!routineId) throw new Error("routine_insert");
    for (const step of built.steps) {
      await client.query(
        `INSERT INTO routine_steps
           (routine_id, period, position, kind, title, instructions, why, product_id, caution)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          routineId,
          step.period,
          step.position,
          step.kind,
          step.title,
          step.instructions,
          step.why,
          step.product?.id ?? null,
          step.caution,
        ]
      );
    }
    await client.query("COMMIT");
    return { ok: true, routine: toCreated(routineId, built) };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Report the original failure.
    }
    logRecommend("routine_insert_failed", err);
    return {
      ok: false,
      status: 500,
      code: "ROUTINE_FAILED",
      message: "Could not save the routine.",
    };
  } finally {
    client.release();
  }
}

export async function getRecommendation(
  userId: string,
  id: string
): Promise<{ ok: true; routine: PublicRoutine } | Failure | { ok: false; status: 404; code: "NOT_FOUND"; message: string }> {
  const found = await query<{
    id: string;
    ruleset_version: string;
    summary: string;
    lifestyle: unknown;
    recovery_id: string | null;
  }>(
    `SELECT id, ruleset_version, summary, lifestyle, recovery_id
     FROM routines WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = found.rows[0];
  if (!row) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Routine not found." };
  }
  const loaded = openRecommendData();
  if (!loaded.ok) return loaded;
  const steps = await query<{
    period: string;
    position: number;
    kind: string;
    title: string;
    instructions: string;
    why: string;
    caution: string | null;
    product_id: string | null;
  }>(
    `SELECT period, position, kind, title, instructions, why, caution, product_id
     FROM routine_steps WHERE routine_id = $1
     ORDER BY CASE period WHEN 'am' THEN 0 WHEN 'pm' THEN 1 ELSE 2 END, position ASC`,
    [id]
  );
  const { profile } = await loadProfile(userId);
  const filterProfile: RecommendProfile = {
    ...profile,
    recoveryActive: profile.recoveryActive || row.recovery_id !== null,
  };
  const builtSteps: BuiltRoutine["steps"] = [];
  for (const step of steps.rows) {
    const period = asPeriod(step.period);
    const kind = asKind(step.kind);
    if (!period || !kind) continue;
    const record = step.product_id ? loaded.data.byId.get(step.product_id) : undefined;
    builtSteps.push({
      period,
      position: step.position,
      kind,
      title: step.title,
      instructions: step.instructions,
      why: step.why,
      caution: step.caution,
      product: record ? shorterProduct(record) : null,
      alternatives: step.product_id
        ? tierAlternatives(step.product_id, loaded.data, filterProfile)
        : [],
    });
  }
  return {
    ok: true,
    routine: {
      id: row.id,
      rulesetVersion: row.ruleset_version,
      summary: row.summary,
      recoveryActive: row.recovery_id !== null,
      clinicianOverridesApp:
        row.recovery_id !== null ? loaded.data.pack.recoveryMessage : null,
      steps: builtSteps,
      lifestyle: stringList(row.lifestyle),
      disclaimer: DISCLAIMER,
    },
  };
}

export async function listProductAlternatives(
  userId: string,
  productId: string
): Promise<
  | { ok: true; method: "jaccard_v1"; alternatives: { product: PublicProduct; score: number; why: string }[] }
  | Failure
> {
  const loaded = openRecommendData();
  if (!loaded.ok) return loaded;
  if (!loaded.data.byId.has(productId)) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Product not found." };
  }
  const { profile } = await loadProfile(userId);
  const listed = listAlternatives(
    productId,
    loaded.data.products,
    profile,
    loaded.data.pack,
    loaded.data.irritancyAtLeast4
  );
  if (!listed) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Product not found." };
  }
  return { ok: true, method: listed.method, alternatives: listed.alternatives };
}
