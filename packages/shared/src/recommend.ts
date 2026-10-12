import { z } from "zod";
import { normalizeInciKey, type IngredientProfile } from "./ingredients.ts";

/**
 * Routine builder and Jaccard alternatives.
 * Products are example formulas. This module does not fetch prices or retailer pages.
 * Similarity is ingredient overlap. It is not a measurement.
 */

export const ESCALATION =
  "See a dermatologist if this worries you. This app cannot assess skin cancer.";

export const JACCARD_METHOD = "jaccard_v1" as const;

const CONCERNS = [
  "acne",
  "blackheads_pores",
  "pigmentation",
  "redness",
  "dark_circles",
  "texture",
  "fine_lines",
  "dehydration",
] as const;

const SEVERITIES = ["none", "mild", "moderate", "severe"] as const;

export type Concern = (typeof CONCERNS)[number];
export type Severity = (typeof SEVERITIES)[number];
export type StepKind = "cleanser" | "treatment" | "moisturizer" | "spf" | "extra";
export type Period = "am" | "pm" | "weekly";
export type Budget = "low" | "mid" | "high";

const SEVERITY_RANK: Record<Severity, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  severe: 3,
};

const uuidSchema = z.string().uuid();
const inciList = z.array(z.string().trim().min(1));

const concernMap = z
  .object({
    acne: z.enum(SEVERITIES).optional(),
    blackheads_pores: z.enum(SEVERITIES).optional(),
    pigmentation: z.enum(SEVERITIES).optional(),
    redness: z.enum(SEVERITIES).optional(),
    dark_circles: z.enum(SEVERITIES).optional(),
    texture: z.enum(SEVERITIES).optional(),
    fine_lines: z.enum(SEVERITIES).optional(),
    dehydration: z.enum(SEVERITIES).optional(),
  })
  .strict();

const preferMap = z
  .object({
    acne: inciList.optional(),
    blackheads_pores: inciList.optional(),
    pigmentation: inciList.optional(),
    redness: inciList.optional(),
    dark_circles: inciList.optional(),
    texture: inciList.optional(),
    fine_lines: inciList.optional(),
    dehydration: inciList.optional(),
  })
  .strict();

export const productFileSchema = z
  .object({
    version: z.union([z.string().min(1), z.number().int()]),
    products: z
      .array(
        z
          .object({
            id: uuidSchema,
            slug: z.string().trim().min(1),
            name: z.string().trim().min(1),
            brand: z.string().trim().min(1),
            step_kind: z.enum(["cleanser", "treatment", "moisturizer", "spf", "extra"]),
            budget: z.enum(["low", "mid", "high"]),
            fragrance_free: z.boolean(),
            minimal_ingredient: z.boolean(),
            description: z.string().min(1),
            inci: inciList.min(1),
            source: z.string().min(1),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

export const routineFileSchema = z
  .object({
    version: z.string().min(1),
    lifestyle: z.array(z.string().min(1)).min(1),
    recovery_message: z.string().min(1),
    recovery_avoid: inciList.min(1),
    pregnancy_avoid: inciList.min(1),
    fragrance_inci: inciList.min(1),
    steps: z
      .array(
        z
          .object({
            id: z.string().trim().min(1),
            period: z.enum(["am", "pm", "weekly"]),
            kind: z.enum(["cleanser", "treatment", "moisturizer", "spf", "extra"]),
            title: z.string().min(1),
            instructions: z.string().min(1),
            why: z.string().min(1),
            prefer_inci: inciList.min(1),
            prefer_when_recovery: inciList.optional(),
            prefer_when_pregnant: inciList.optional(),
            prefer_by_concern: preferMap.optional(),
            min_severity: concernMap.optional(),
            skip_when_recovery: z.boolean().optional(),
            skip_when_pregnant: z.boolean().optional(),
            skip_if_selected_inci: inciList.optional(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

export type ProductRecord = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  stepKind: StepKind;
  budget: Budget;
  fragranceFree: boolean;
  minimalIngredient: boolean;
  description: string;
  inci: string[];
  source: string;
};

export type RoutineTemplate = {
  id: string;
  period: Period;
  kind: StepKind;
  title: string;
  instructions: string;
  why: string;
  preferInci: string[];
  preferWhenRecovery: string[];
  preferWhenPregnant: string[];
  preferByConcern: Partial<Record<Concern, string[]>>;
  minSeverity: Partial<Record<Concern, Severity>>;
  skipWhenRecovery: boolean;
  skipWhenPregnant: boolean;
  skipIfSelectedInci: string[];
};

export type RoutinePack = {
  version: string;
  lifestyle: string[];
  recoveryMessage: string;
  recoveryAvoid: string[];
  pregnancyAvoid: string[];
  fragranceInci: string[];
  steps: RoutineTemplate[];
};

export type FindingInput = {
  concern: Concern;
  severity: Severity;
};

export type RecommendProfile = IngredientProfile & {
  budget: Budget | "any";
};

export type PublicProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  stepKind: StepKind;
  budget: Budget;
  fragranceFree: boolean;
  minimalIngredient: boolean;
  description: string;
  source: string;
  why: string;
};

export type BuiltStep = {
  period: Period;
  position: number;
  kind: StepKind;
  title: string;
  instructions: string;
  why: string;
  caution: string | null;
  product: PublicProduct | null;
  alternatives: PublicProduct[];
};

export type BuiltRoutine = {
  rulesetVersion: string;
  summary: string;
  recoveryActive: boolean;
  clinicianOverridesApp: string | null;
  lifestyle: string[];
  steps: BuiltStep[];
};

export type AlternativeHit = {
  product: PublicProduct;
  score: number;
  why: string;
};

const BASE_SUMMARY =
  "This is a short list based on your latest succeeded scan and your profile. Example products are formulas written for this catalog, not shop listings.";

const SAMPLE_NOTE =
  "The latest saved scan is a sample score, not a measurement, so this list does not follow those sample concerns.";

function keys(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = normalizeInciKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function parseProducts(input: unknown, knownInci: ReadonlySet<string>): ProductRecord[] {
  const parsed = productFileSchema.safeParse(input);
  if (!parsed.success) throw new Error("Product catalog YAML is invalid.");
  const products: ProductRecord[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const row of parsed.data.products) {
    if (ids.has(row.id) || slugs.has(row.slug)) {
      throw new Error(`Product catalog name collides: ${row.slug}`);
    }
    ids.add(row.id);
    slugs.add(row.slug);
    const inci = keys(row.inci);
    if (inci.length === 0) throw new Error("Product catalog YAML is invalid.");
    for (const name of inci) {
      if (!knownInci.has(name)) throw new Error(`Product uses an unknown INCI: ${name}`);
    }
    products.push({
      id: row.id,
      slug: row.slug,
      name: row.name.trim(),
      brand: row.brand.trim(),
      stepKind: row.step_kind,
      budget: row.budget,
      fragranceFree: row.fragrance_free,
      minimalIngredient: row.minimal_ingredient,
      description: row.description,
      inci,
      source: row.source,
    });
  }
  return products;
}

export function parseRoutinePack(input: unknown): RoutinePack {
  const parsed = routineFileSchema.safeParse(input);
  if (!parsed.success) throw new Error("Routine pack YAML is invalid.");
  const seen = new Set<string>();
  const steps: RoutineTemplate[] = [];
  for (const row of parsed.data.steps) {
    if (seen.has(row.id)) throw new Error(`Routine step collides: ${row.id}`);
    seen.add(row.id);
    const preferByConcern: Partial<Record<Concern, string[]>> = {};
    for (const concern of CONCERNS) {
      const list = row.prefer_by_concern?.[concern];
      if (list) preferByConcern[concern] = keys(list);
    }
    const minSeverity: Partial<Record<Concern, Severity>> = {};
    for (const concern of CONCERNS) {
      const severity = row.min_severity?.[concern];
      if (severity) minSeverity[concern] = severity;
    }
    steps.push({
      id: row.id,
      period: row.period,
      kind: row.kind,
      title: row.title,
      instructions: row.instructions,
      why: row.why,
      preferInci: keys(row.prefer_inci),
      preferWhenRecovery: keys(row.prefer_when_recovery ?? []),
      preferWhenPregnant: keys(row.prefer_when_pregnant ?? []),
      preferByConcern,
      minSeverity,
      skipWhenRecovery: row.skip_when_recovery === true,
      skipWhenPregnant: row.skip_when_pregnant === true,
      skipIfSelectedInci: keys(row.skip_if_selected_inci ?? []),
    });
  }
  return {
    version: parsed.data.version,
    lifestyle: parsed.data.lifestyle,
    recoveryMessage: parsed.data.recovery_message,
    recoveryAvoid: keys(parsed.data.recovery_avoid),
    pregnancyAvoid: keys(parsed.data.pregnancy_avoid),
    fragranceInci: keys(parsed.data.fragrance_inci),
    steps,
  };
}

export function jaccard(left: readonly string[], right: readonly string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const item of a) {
    if (b.has(item)) shared += 1;
  }
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

function hasAny(list: readonly string[], blocked: ReadonlySet<string>): boolean {
  return list.some((item) => blocked.has(item));
}

export function blockReason(
  product: ProductRecord,
  profile: RecommendProfile,
  pack: RoutinePack,
  irritancyAtLeast4: ReadonlySet<string>
): string | null {
  const allergies = new Set(
    profile.allergies.map((name) => normalizeInciKey(name)).filter((name) => name.length > 0)
  );
  if (hasAny(product.inci, allergies)) return "allergy";
  if (profile.pregnantOrFeeding && hasAny(product.inci, new Set(pack.pregnancyAvoid))) {
    return "pregnancy";
  }
  if (profile.recoveryActive && hasAny(product.inci, new Set(pack.recoveryAvoid))) {
    return "recovery";
  }
  if (
    profile.fragranceSensitive &&
    (!product.fragranceFree || hasAny(product.inci, new Set(pack.fragranceInci)))
  ) {
    return "fragrance";
  }
  if (profile.selfDescribedSensitive && hasAny(product.inci, irritancyAtLeast4)) {
    return "irritancy";
  }
  return null;
}

function severityOf(findings: FindingInput[], concern: Concern): Severity {
  let rank = 0;
  let severity: Severity = "none";
  for (const finding of findings) {
    if (finding.concern !== concern) continue;
    if (SEVERITY_RANK[finding.severity] > rank) {
      rank = SEVERITY_RANK[finding.severity];
      severity = finding.severity;
    }
  }
  return severity;
}

function triggers(step: RoutineTemplate, findings: FindingInput[]): Concern[] {
  const keys = Object.keys(step.minSeverity) as Concern[];
  if (keys.length === 0) return [];
  return keys.filter(
    (concern) => SEVERITY_RANK[severityOf(findings, concern)] >= SEVERITY_RANK[step.minSeverity[concern] ?? "severe"]
  );
}

function preferFor(
  step: RoutineTemplate,
  profile: RecommendProfile,
  triggered: Concern[],
  findings: FindingInput[]
): string[] {
  if (profile.recoveryActive && step.preferWhenRecovery.length > 0) return step.preferWhenRecovery;
  if (profile.pregnantOrFeeding && step.preferWhenPregnant.length > 0) return step.preferWhenPregnant;
  const ranked = [...triggered].sort(
    (a, b) => SEVERITY_RANK[severityOf(findings, b)] - SEVERITY_RANK[severityOf(findings, a)]
  );
  for (const concern of ranked) {
    const list = step.preferByConcern[concern];
    if (list && list.length > 0) return list;
  }
  return step.preferInci;
}

function overlapWhy(product: ProductRecord, score: number, fallbackBudget: boolean): string {
  const tier = fallbackBudget
    ? ` No example in the requested budget tier passed the filters, so this is the ${product.budget} tier.`
    : ` Budget tier: ${product.budget}.`;
  return `Example formula, not a shop listing. Ingredient overlap ${score.toFixed(2)}.${tier}`;
}

function toPublic(product: ProductRecord, why: string): PublicProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    stepKind: product.stepKind,
    budget: product.budget,
    fragranceFree: product.fragranceFree,
    minimalIngredient: product.minimalIngredient,
    description: product.description,
    source: product.source,
    why,
  };
}

function eligible(
  products: ProductRecord[],
  kind: StepKind,
  profile: RecommendProfile,
  pack: RoutinePack,
  irritancyAtLeast4: ReadonlySet<string>
): ProductRecord[] {
  return products.filter(
    (product) =>
      product.stepKind === kind && blockReason(product, profile, pack, irritancyAtLeast4) === null
  );
}

function best(pool: ProductRecord[], prefer: string[]): ProductRecord | null {
  let winner: ProductRecord | null = null;
  let winnerScore = -1;
  for (const product of pool) {
    const score = jaccard(product.inci, prefer);
    if (
      !winner ||
      score > winnerScore ||
      (score === winnerScore && product.minimalIngredient && !winner.minimalIngredient) ||
      (score === winnerScore &&
        product.minimalIngredient === winner.minimalIngredient &&
        product.name < winner.name)
    ) {
      winner = product;
      winnerScore = score;
    }
  }
  return winner;
}

function otherTiers(chosen: ProductRecord, pool: ProductRecord[]): PublicProduct[] {
  const tiers: Budget[] = ["low", "mid", "high"].filter((tier) => tier !== chosen.budget) as Budget[];
  const alternatives: PublicProduct[] = [];
  for (const tier of tiers) {
    const inTier = pool.filter((product) => product.budget === tier && product.id !== chosen.id);
    const pick = best(inTier, chosen.inci);
    if (!pick) continue;
    const score = jaccard(pick.inci, chosen.inci);
    alternatives.push(
      toPublic(
        pick,
        `Example formula, not a shop listing. Ingredient overlap with the suggested example is ${score.toFixed(2)}. Budget tier: ${pick.budget}.`
      )
    );
  }
  return alternatives.slice(0, 2);
}

export function listAlternatives(
  productId: string,
  products: ProductRecord[],
  profile: RecommendProfile,
  pack: RoutinePack,
  irritancyAtLeast4: readonly string[]
): { method: typeof JACCARD_METHOD; alternatives: AlternativeHit[] } | null {
  const source = products.find((product) => product.id === productId);
  if (!source) return null;
  const blocked = new Set(keys(irritancyAtLeast4));
  const pool = eligible(products, source.stepKind, profile, pack, blocked).filter(
    (product) => product.id !== source.id
  );
  const alternatives = pool
    .map((product) => {
      const score = jaccard(product.inci, source.inci);
      const shared = product.inci.filter((name) => source.inci.includes(name)).length;
      return {
        product: toPublic(
          product,
          `Example formula, not a shop listing. Budget tier: ${product.budget}.`
        ),
        score,
        why: `Shares ${shared} example ingredient${shared === 1 ? "" : "s"}. Budget tier: ${product.budget}.`,
      };
    })
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, 8);
  return { method: JACCARD_METHOD, alternatives };
}

function chooseProduct(
  step: RoutineTemplate,
  prefer: string[],
  products: ProductRecord[],
  profile: RecommendProfile,
  pack: RoutinePack,
  irritancyAtLeast4: ReadonlySet<string>
): { product: PublicProduct | null; alternatives: PublicProduct[] } {
  const pool = eligible(products, step.kind, profile, pack, irritancyAtLeast4);
  const inBudget =
    profile.budget === "any" ? pool : pool.filter((product) => product.budget === profile.budget);
  const fallback = profile.budget !== "any" && inBudget.length === 0;
  const chosen = best(inBudget.length > 0 ? inBudget : pool, prefer);
  if (!chosen) return { product: null, alternatives: [] };
  const score = jaccard(chosen.inci, prefer);
  return {
    product: toPublic(chosen, overlapWhy(chosen, score, fallback)),
    alternatives: otherTiers(chosen, pool),
  };
}

/**
 * Build a routine from confirmed findings. heuristic_v0 scans do not contribute concerns.
 * A severe finding keeps the step and attaches no product.
 */
export function buildRoutine(input: {
  products: ProductRecord[];
  pack: RoutinePack;
  profile: RecommendProfile;
  findings: FindingInput[];
  analysisKind: string;
  irritancyAtLeast4?: readonly string[];
}): BuiltRoutine {
  const findings = input.analysisKind === "heuristic_v0" ? [] : input.findings;
  const irritancy = new Set(keys(input.irritancyAtLeast4 ?? []));
  const selected: Array<{
    step: RoutineTemplate;
    triggered: Concern[];
    severe: boolean;
    choice: { product: PublicProduct | null; alternatives: PublicProduct[] };
  }> = [];

  for (const step of input.pack.steps) {
    if (step.skipWhenRecovery && input.profile.recoveryActive) continue;
    if (step.skipWhenPregnant && input.profile.pregnantOrFeeding) continue;
    const triggered = triggers(step, findings);
    const always = Object.keys(step.minSeverity).length === 0;
    if (!always && triggered.length === 0) continue;
    const severe = triggered.some((concern) => severityOf(findings, concern) === "severe");
    const prefer = preferFor(step, input.profile, triggered, findings);
    const choice = severe
      ? { product: null, alternatives: [] }
      : chooseProduct(step, prefer, input.products, input.profile, input.pack, irritancy);
    selected.push({ step, triggered, severe, choice });
  }

  const selectedInci = new Set(
    selected.flatMap((item) => {
      const product = input.products.find((row) => row.id === item.choice.product?.id);
      return product?.inci ?? [];
    })
  );
  const kept = selected.filter(
    (item) =>
      item.step.skipIfSelectedInci.length === 0 ||
      !item.step.skipIfSelectedInci.some((name) => selectedInci.has(name))
  );

  const counters: Record<Period, number> = { am: 0, pm: 0, weekly: 0 };
  const steps: BuiltStep[] = kept.map((item) => {
    counters[item.step.period] += 1;
    return {
      period: item.step.period,
      position: counters[item.step.period],
      kind: item.step.kind,
      title: item.step.title,
      instructions: item.step.instructions,
      why: item.step.why,
      caution: item.severe ? ESCALATION : null,
      product: item.choice.product,
      alternatives: item.choice.alternatives,
    };
  });

  const anySevere = findings.some((finding) => finding.severity === "severe");
  let summary = input.analysisKind === "heuristic_v0" ? `${SAMPLE_NOTE} ${BASE_SUMMARY}` : BASE_SUMMARY;
  if (anySevere) summary = `${summary} ${ESCALATION}`;

  return {
    rulesetVersion: input.pack.version,
    summary,
    recoveryActive: input.profile.recoveryActive,
    clinicianOverridesApp: input.profile.recoveryActive ? input.pack.recoveryMessage : null,
    lifestyle: input.pack.lifestyle,
    steps,
  };
}

export function parseManualPrice(input: {
  priceCents: unknown;
  currency: unknown;
  url: unknown;
}):
  | { ok: true; priceCents: number; currency: string; url: string }
  | { ok: false; message: string } {
  const priceCents = input.priceCents;
  if (typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents < 0) {
    return { ok: false, message: "priceCents must be a whole number of cents, zero or more." };
  }
  if (priceCents > 2_000_000_000) {
    return { ok: false, message: "priceCents is too large." };
  }
  if (typeof input.currency !== "string" || !/^[A-Za-z]{3}$/.test(input.currency)) {
    return { ok: false, message: "currency must be three letters." };
  }
  if (typeof input.url !== "string" || input.url.length < 1 || input.url.length > 2000) {
    return { ok: false, message: "url must be an http or https link." };
  }
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return { ok: false, message: "url must be an http or https link." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, message: "url must be an http or https link." };
  }
  return { ok: true, priceCents, currency: input.currency.toUpperCase(), url: parsed.toString() };
}

export function searchProducts(
  products: ProductRecord[],
  query: { q?: string; stepKind?: string; budget?: string }
): PublicProduct[] {
  const q = query.q?.trim().toUpperCase() ?? "";
  return products
    .filter((product) => {
      if (query.stepKind && product.stepKind !== query.stepKind) return false;
      if (query.budget && product.budget !== query.budget) return false;
      if (!q) return true;
      const hay = [product.name, product.brand, product.slug, ...product.inci].join(" ").toUpperCase();
      return hay.includes(q);
    })
    .slice(0, 50)
    .map((product) =>
      toPublic(product, "")
    );
}
