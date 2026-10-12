import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { EMPTY_PROFILE, parseCatalog } from "../packages/shared/src/ingredients.ts";
import {
  ESCALATION,
  JACCARD_METHOD,
  type ProductRecord,
  type RecommendProfile,
  buildRoutine,
  jaccard,
  listAlternatives,
  parseManualPrice,
  parseProducts,
  parseRoutinePack,
  searchProducts,
} from "../packages/shared/src/recommend.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadReal() {
  const ingredientCatalog = parseCatalog(
    parse(readFileSync(join(root, "data", "ingredients", "catalog.yaml"), "utf8"))
  );
  const known = new Set(ingredientCatalog.byKey.keys());
  const products = parseProducts(
    parse(readFileSync(join(root, "data", "products", "catalog.yaml"), "utf8")),
    known
  );
  const pack = parseRoutinePack(parse(readFileSync(join(root, "data", "routines", "v1", "pack.yaml"), "utf8")));
  const irritancy = ingredientCatalog.entries
    .filter((entry) => entry.irritancy !== null && entry.irritancy >= 4)
    .map((entry) => entry.key);
  return { products, pack, irritancy };
}

function profile(extra: Partial<RecommendProfile> = {}): RecommendProfile {
  return { ...EMPTY_PROFILE, budget: "any", recoveryActive: false, ...extra };
}

function names(steps: { kind: string; product: { name: string } | null }[]) {
  return steps.map((step) => `${step.kind}:${step.product?.name ?? "none"}`);
}

test("jaccard is overlap, and empty sets score zero", () => {
  assert.equal(jaccard(["A", "B"], ["A", "B"]), 1);
  assert.equal(jaccard(["A"], ["B"]), 0);
  assert.equal(jaccard(["A", "B"], ["B", "C"]), 1 / 3);
  assert.equal(jaccard([], ["A"]), 0);
});

test("real product and routine files load, and every INCI is in the ingredient catalog", () => {
  const { products, pack } = loadReal();
  assert.equal(pack.version, "routines_v1");
  assert.ok(products.length >= 12);
  assert.ok(products.every((product) => product.source.includes("Not copied from a retailer")));
  assert.ok(pack.recoveryAvoid.includes("RETINOL"));
  assert.ok(pack.pregnancyAvoid.includes("SALICYLIC ACID"));
  assert.equal(pack.steps.some((step) => step.kind === "spf"), true);
});

test("a baseline scan with no concerns stays a short list", () => {
  const { products, pack, irritancy } = loadReal();
  const built = buildRoutine({
    products,
    pack,
    profile: profile(),
    findings: [],
    analysisKind: "baseline_cv_v1",
    irritancyAtLeast4: irritancy,
  });
  const am = built.steps.filter((step) => step.period === "am").map((step) => step.kind);
  const pm = built.steps.filter((step) => step.period === "pm").map((step) => step.kind);
  assert.deepEqual(am, ["cleanser", "moisturizer", "spf"]);
  assert.deepEqual(pm, ["cleanser", "moisturizer"]);
  assert.equal(built.steps.some((step) => step.period === "weekly"), false);
  assert.equal(built.clinicianOverridesApp, null);
  assert.match(built.summary, /not shop listings/);
});

test("sample scores do not add a leave-on", () => {
  const { products, pack, irritancy } = loadReal();
  const built = buildRoutine({
    products,
    pack,
    profile: profile(),
    findings: [{ concern: "acne", severity: "moderate" }],
    analysisKind: "heuristic_v0",
    irritancyAtLeast4: irritancy,
  });
  assert.equal(built.steps.some((step) => step.kind === "treatment"), false);
  assert.match(built.summary, /sample score/);
});

test("filters drop allergy, fragrance, pregnancy, recovery, and high irritancy", () => {
  const { products, pack, irritancy } = loadReal();
  const allergic = buildRoutine({
    products,
    pack,
    profile: profile({ allergies: ["panthenol"], budget: "low" }),
    findings: [],
    analysisKind: "baseline_cv_v1",
    irritancyAtLeast4: irritancy,
  });
  const cleanser = allergic.steps.find((step) => step.period === "am" && step.kind === "cleanser");
  assert.notEqual(cleanser?.product?.name, "Example Gentle Gel");

  const scented = buildRoutine({
    products,
    pack,
    profile: profile({ fragranceSensitive: true, budget: "high" }),
    findings: [],
    analysisKind: "baseline_cv_v1",
    irritancyAtLeast4: irritancy,
  });
  const highCleanse = scented.steps.find((step) => step.kind === "cleanser" && step.period === "am");
  assert.notEqual(highCleanse?.product?.name, "Example Scented Gel");
  assert.match(highCleanse?.product?.why ?? "", /requested budget tier/);

  const pregnant = buildRoutine({
    products,
    pack,
    profile: profile({ pregnantOrFeeding: true, budget: "high" }),
    findings: [{ concern: "fine_lines", severity: "moderate" }],
    analysisKind: "baseline_cv_v1",
    irritancyAtLeast4: irritancy,
  });
  const night = pregnant.steps.find((step) => step.id === undefined && step.period === "pm" && step.kind === "treatment");
  assert.notEqual(night?.product?.name, "Example Retinol");
  assert.equal(pregnant.steps.some((step) => step.period === "weekly"), false);

  const recovery = buildRoutine({
    products,
    pack,
    profile: profile({ recoveryActive: true }),
    findings: [
      { concern: "acne", severity: "moderate" },
      { concern: "texture", severity: "mild" },
    ],
    analysisKind: "baseline_cv_v1",
    irritancyAtLeast4: irritancy,
  });
  assert.equal(recovery.recoveryActive, true);
  assert.match(recovery.clinicianOverridesApp ?? "", /Follow your clinician/);
  assert.equal(
    recovery.steps.some((step) => step.product?.name === "Example Retinol"),
    false
  );
  assert.equal(
    recovery.steps.some((step) => step.product?.name === "Example Glycolic"),
    false
  );
  assert.equal(recovery.steps.some((step) => step.period === "weekly"), false);
  const morning = recovery.steps.find((step) => step.kind === "treatment");
  assert.equal(morning?.product?.name, "Example Soothing");
});

test("fine lines can suggest retinol, and then the weekly acid is left out", () => {
  const { products, pack, irritancy } = loadReal();
  const built = buildRoutine({
    products,
    pack,
    profile: profile({ budget: "high" }),
    findings: [
      { concern: "fine_lines", severity: "mild" },
      { concern: "texture", severity: "moderate" },
    ],
    analysisKind: "baseline_cv_v1",
    irritancyAtLeast4: irritancy,
  });
  const night = built.steps.find((step) => step.period === "pm" && step.kind === "treatment");
  assert.equal(night?.product?.name, "Example Retinol");
  assert.equal(built.steps.some((step) => step.period === "weekly"), false);
});

test("a severe finding keeps the step and attaches no product", () => {
  const { products, pack, irritancy } = loadReal();
  const built = buildRoutine({
    products,
    pack,
    profile: profile(),
    findings: [{ concern: "acne", severity: "severe" }],
    analysisKind: "baseline_cv_v1",
    irritancyAtLeast4: irritancy,
  });
  const treatment = built.steps.find((step) => step.kind === "treatment");
  assert.equal(treatment?.product, null);
  assert.equal(treatment?.caution, ESCALATION);
  assert.match(built.summary, /cannot assess skin cancer/);
  const cleanser = built.steps.find((step) => step.period === "am" && step.kind === "cleanser");
  assert.ok(cleanser?.product);
});

test("alternatives are jaccard_v1 inside the same step and record the other budget tiers", () => {
  const { products, pack, irritancy } = loadReal();
  const built = buildRoutine({
    products,
    pack,
    profile: profile({ budget: "low" }),
    findings: [],
    analysisKind: "baseline_cv_v1",
    irritancyAtLeast4: irritancy,
  });
  const cleanser = built.steps.find((step) => step.period === "am" && step.kind === "cleanser");
  assert.equal(cleanser?.product?.budget, "low");
  const tiers = new Set(cleanser?.alternatives.map((item) => item.budget));
  assert.equal(tiers.has("low"), false);
  assert.ok((cleanser?.alternatives.length ?? 0) >= 1);
  assert.ok(cleanser?.alternatives.every((item) => item.stepKind === "cleanser"));

  const listed = listAlternatives(
    cleanser?.product?.id ?? "",
    products,
    profile({ allergies: ["panthenol"] }),
    pack,
    irritancy
  );
  assert.equal(listed?.method, JACCARD_METHOD);
  assert.equal(
    listed?.alternatives.some((item) => item.product.name === "Example Gentle Gel"),
    false
  );
});

test("search and pasted prices do not accept a non-web URL", () => {
  const { products } = loadReal();
  const found = searchProducts(products, { q: "ceramide", stepKind: "moisturizer" });
  assert.equal(found.length, 1);
  assert.equal(found[0]?.slug, "example-ceramide-cream");
  assert.equal(found[0]?.why, "");

  assert.equal(parseManualPrice({ priceCents: 1250, currency: "usd", url: "https://example.com/item" }).ok, true);
  const bad = parseManualPrice({ priceCents: 1, currency: "USD", url: "javascript:alert(1)" });
  assert.equal(bad.ok, false);
  assert.equal(parseManualPrice({ priceCents: -1, currency: "USD", url: "https://example.com" }).ok, false);
  assert.equal(parseManualPrice({ priceCents: 1.5, currency: "USD", url: "https://example.com" }).ok, false);
});

test("the price store does not fetch the pasted URL", () => {
  const job = readFileSync(join(root, "lib", "price-store.ts"), "utf8");
  const route = readFileSync(join(root, "app", "api", "v1", "products", "[id]", "prices", "route.ts"), "utf8");
  assert.equal(job.includes("fetch("), false);
  assert.equal(route.includes("fetch("), false);
  assert.equal(names([]).length, 0);
});

function unusedProductGuard(product: ProductRecord | null) {
  return product?.id ?? "";
}

test("unknown product id has no alternatives", () => {
  const { products, pack, irritancy } = loadReal();
  assert.equal(listAlternatives(unusedProductGuard(null), products, profile(), pack, irritancy), null);
});
