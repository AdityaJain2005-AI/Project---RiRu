import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import {
  EMPTY_PROFILE,
  type IngredientCatalog,
  type IngredientProfile,
  type RulePack,
  evaluateVerdict,
  explainMatched,
  matchTokens,
  parseCatalog,
  parseRulePack,
} from "../packages/shared/src/ingredients.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadReal(): { catalog: IngredientCatalog; pack: RulePack } {
  const catalog = parseCatalog(parse(readFileSync(join(root, "data", "ingredients", "catalog.yaml"), "utf8")));
  const pack = parseRulePack(parse(readFileSync(join(root, "data", "rules", "v1", "pack.yaml"), "utf8")));
  return { catalog, pack };
}

function tinyCatalog(): IngredientCatalog {
  return parseCatalog({
    version: 1,
    ingredients: [
      {
        inci: "AAAAA",
        functions: ["test"],
        irritancy: 0,
        comedogenicity: null,
        typical_range: null,
        pregnancy_note: "none",
        plain_description: "test",
        source: "test",
      },
      {
        inci: "AAAAB",
        functions: ["test"],
        irritancy: 0,
        comedogenicity: null,
        typical_range: null,
        pregnancy_note: "none",
        plain_description: "test",
        source: "test",
      },
      {
        inci: "GLYCOLIC ACID",
        functions: ["exfoliant"],
        irritancy: 3,
        comedogenicity: null,
        typical_range: null,
        pregnancy_note: "none",
        plain_description: "test",
        source: "test",
      },
    ],
  });
}

function nuancePack(): RulePack {
  return parseRulePack({
    version: "v1",
    rules: [
      {
        rule_key: "fake_nuance",
        kind: "nuance",
        when: { all_present: ["AAAAA"] },
        effect: {
          verdict: "avoid",
          message: "This nuance must not raise the verdict.",
        },
      },
    ],
  });
}

test("real catalog and rule pack load", () => {
  const { catalog, pack } = loadReal();
  assert.equal(pack.version, "v1");
  assert.ok(catalog.byKey.get("AQUA"));
  assert.equal(catalog.byKey.get("WATER")?.inci, "AQUA");
  assert.equal(catalog.byKey.get("NICOTINAMIDE")?.inci, "NIACINAMIDE");
  const keys = pack.rules.map((rule) => rule.id);
  for (const id of [
    "retinol_plus_aha",
    "retinol_plus_salicylic",
    "retinoid_pregnancy",
    "salicylic_pregnancy",
    "benzoyl_peroxide_pregnancy",
    "vitamin_c_niacinamide",
    "fragrance_when_sensitive",
  ]) {
    assert.ok(keys.includes(id), id);
  }
  const nuance = pack.rules.find((rule) => rule.id === "vitamin_c_niacinamide");
  assert.equal(nuance?.kind, "nuance");
  assert.match(nuance?.message ?? "", /never be mixed/);
  assert.match(nuance?.message ?? "", /overstated at cosmetic pH/);
  assert.match(nuance?.message ?? "", /Irritation is still possible/);
  const retinol = catalog.entries.find((entry) => entry.inci === "RETINOL");
  assert.ok(retinol?.avoidIf.includes("pregnant_or_feeding"));
  assert.equal(retinol?.typicalRange, null);
});

test("exact, alias, parentheses, hyphen break, and digits", () => {
  const { catalog } = loadReal();
  const tokens = matchTokens(
    "Aqua (Water), Nicotinamide, Niacina-\nmide, CI 77891, BPO",
    catalog
  );
  assert.deepEqual(
    tokens.map((token) => token.inci),
    ["AQUA", "NIACINAMIDE", "NIACINAMIDE", "TITANIUM DIOXIDE", "BENZOYL PEROXIDE"]
  );
  assert.ok(tokens.every((token) => token.status === "matched"));
});

test("fuzzy match keeps a close spelling and a tie stays unparsed", () => {
  const { catalog } = loadReal();
  const fuzzy = matchTokens("Glycolc Acid", catalog);
  assert.equal(fuzzy[0]?.status, "fuzzy");
  assert.equal(fuzzy[0]?.inci, "GLYCOLIC ACID");
  assert.equal(fuzzy[0]?.raw, "Glycolc Acid");

  const short = matchTokens("AQUX", catalog);
  assert.equal(short[0]?.status, "unparsed");

  const tied = matchTokens("AAAAC", tinyCatalog());
  assert.equal(tied[0]?.status, "unparsed");
  assert.equal(tied[0]?.inci, null);
});

test("empty text is not a verdict", () => {
  const { catalog, pack } = loadReal();
  const empty = evaluateVerdict(matchTokens(" , ; \n ", catalog), pack, catalog);
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.code, "EMPTY");
});

test("unparsed blocks good_fit and fuzzy alone does not", () => {
  const { catalog, pack } = loadReal();
  const unknown = evaluateVerdict(matchTokens("Glycerin, Mystery Wax", catalog), pack, catalog);
  assert.equal(unknown.ok, true);
  if (unknown.ok) {
    assert.equal(unknown.verdict, "caution");
    assert.deepEqual(unknown.unparsed, ["Mystery Wax"]);
    assert.ok(unknown.reasons.some((reason) => reason.ruleKey === "unparsed_names"));
  }

  const notes = explainMatched(matchTokens("Glycerol, Glycolc Acid, Mystery Wax", catalog), catalog);
  assert.deepEqual(
    notes.map((note) => note.inci),
    ["GLYCERIN", "GLYCOLIC ACID"]
  );
  assert.match(notes[0]?.plainDescription ?? "", /humectant/i);

  const fuzzy = evaluateVerdict(matchTokens("Glycolc Acid", catalog), pack, catalog);
  assert.equal(fuzzy.ok, true);
  if (fuzzy.ok) {
    assert.equal(fuzzy.verdict, "good_fit");
    assert.deepEqual(fuzzy.unparsed, []);
  }
});

test("conflicts, pregnancy avoid, and nuance that does not raise", () => {
  const { catalog, pack } = loadReal();
  const together = evaluateVerdict(
    matchTokens("Retinol, Glycolic Acid", catalog),
    pack,
    catalog
  );
  assert.equal(together.ok, true);
  if (together.ok) {
    assert.equal(together.verdict, "caution");
    assert.ok(together.reasons.some((reason) => reason.ruleKey === "retinol_plus_aha"));
  }

  const pregnant: IngredientProfile = { ...EMPTY_PROFILE, pregnantOrFeeding: true };
  const flagged = evaluateVerdict(
    matchTokens("Retinol, Glycolic Acid", catalog),
    pack,
    catalog,
    pregnant
  );
  assert.equal(flagged.ok, true);
  if (flagged.ok) {
    assert.equal(flagged.verdict, "avoid");
    assert.ok(flagged.reasons.some((reason) => reason.ruleKey === "retinoid_pregnancy"));
    assert.match(
      flagged.reasons.find((reason) => reason.ruleKey === "retinoid_pregnancy")?.message ?? "",
      /clinician/i
    );
    assert.doesNotMatch(
      flagged.reasons.map((reason) => reason.message).join(" "),
      /\d+\s*(%|mg|ml)/i
    );
  }

  for (const line of ["Salicylic Acid", "Benzoyl Peroxide"]) {
    const result = evaluateVerdict(matchTokens(line, catalog), pack, catalog, pregnant);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.verdict, "avoid");
  }

  const calm = evaluateVerdict(
    matchTokens("Ascorbic Acid, Niacinamide, Glycerin", catalog),
    pack,
    catalog
  );
  assert.equal(calm.ok, true);
  if (calm.ok) {
    assert.equal(calm.verdict, "good_fit");
    assert.ok(calm.reasons.some((reason) => reason.ruleKey === "vitamin_c_niacinamide"));
  }

  const nuanceOnly = evaluateVerdict(
    matchTokens("AAAAA", tinyCatalog()),
    nuancePack(),
    tinyCatalog()
  );
  assert.equal(nuanceOnly.ok, true);
  if (nuanceOnly.ok) {
    assert.equal(nuanceOnly.verdict, "good_fit");
    assert.equal(nuanceOnly.reasons[0]?.ruleKey, "fake_nuance");
  }
});

test("fragrance, irritancy, allergy, and recovery skip", () => {
  const { catalog, pack } = loadReal();
  const sensitive: IngredientProfile = {
    ...EMPTY_PROFILE,
    fragranceSensitive: true,
    selfDescribedSensitive: true,
  };
  const scent = evaluateVerdict(matchTokens("Limonene, Glycerin", catalog), pack, catalog, sensitive);
  assert.equal(scent.ok, true);
  if (scent.ok) {
    assert.equal(scent.verdict, "caution");
    assert.ok(scent.reasons.some((reason) => reason.ruleKey === "fragrance_when_sensitive"));
  }

  const plain = evaluateVerdict(matchTokens("Limonene", catalog), pack, catalog);
  assert.equal(plain.ok, true);
  if (plain.ok) assert.equal(plain.verdict, "good_fit");

  const sting = evaluateVerdict(matchTokens("Alcohol Denat., Panthenol", catalog), pack, catalog, sensitive);
  assert.equal(sting.ok, true);
  if (sting.ok) {
    assert.equal(sting.verdict, "caution");
    assert.ok(sting.reasons.some((reason) => reason.ruleKey === "high_irritancy_sensitive"));
  }

  const allergic: IngredientProfile = { ...EMPTY_PROFILE, allergies: ["panthenol"] };
  const allergy = evaluateVerdict(matchTokens("Panthenol, Glycerin", catalog), pack, catalog, allergic);
  assert.equal(allergy.ok, true);
  if (allergy.ok) {
    assert.equal(allergy.verdict, "avoid");
    assert.ok(allergy.reasons.some((reason) => reason.ruleKey === "profile_allergy"));
  }

  const recovery: IngredientProfile = { ...EMPTY_PROFILE, recoveryActive: true };
  const skipped = evaluateVerdict(
    matchTokens("Retinol, Lactic Acid", catalog),
    pack,
    catalog,
    recovery
  );
  assert.equal(skipped.ok, true);
  if (skipped.ok) {
    assert.equal(skipped.verdict, "good_fit");
    assert.equal(
      skipped.reasons.some((reason) => reason.ruleKey === "retinol_plus_aha"),
      false
    );
  }
});

test("phase 3 sql adds the ingredient idempotency index", () => {
  const sql = readFileSync(join(root, "db", "phase3.sql"), "utf8");
  assert.match(sql, /ingredient_scans_user_idempotency_idx/);
  assert.match(sql, /ON ingredient_scans \(user_id, idempotency_key\)/);
  assert.match(sql, /WHERE idempotency_key IS NOT NULL/);
});
