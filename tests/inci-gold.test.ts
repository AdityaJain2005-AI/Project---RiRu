import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { matchTokens, parseCatalog } from "../packages/shared/src/ingredients.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

type GoldCase = { raw: string; inci: string | null; status: "matched" | "fuzzy" | "unparsed" };

test("INCI gold set matches the catalog normalizer", () => {
  const catalog = parseCatalog(parse(readFileSync(join(root, "data", "ingredients", "catalog.yaml"), "utf8")));
  const gold = parse(readFileSync(join(root, "data", "ingredients", "inci-gold.yaml"), "utf8")) as {
    cases: GoldCase[];
  };
  assert.ok(gold.cases.length >= 8);
  let correct = 0;
  for (const item of gold.cases) {
    const token = matchTokens(item.raw, catalog)[0];
    assert.equal(token?.status, item.status, item.raw);
    assert.equal(token?.inci ?? null, item.inci, item.raw);
    if (token?.status === item.status && (token.inci ?? null) === item.inci) correct += 1;
  }
  assert.equal(correct, gold.cases.length);
});
