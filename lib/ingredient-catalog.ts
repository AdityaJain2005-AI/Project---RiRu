import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  parseCatalog,
  parseRulePack,
  type IngredientCatalog,
  type RulePack,
} from "@riru/shared";
import { parse } from "yaml";

export class CatalogMissingError extends Error {
  constructor() {
    super("Ingredient catalog is not available.");
    this.name = "CatalogMissingError";
  }
}

let cached: { catalog: IngredientCatalog; pack: RulePack } | null = null;

export function findDataRoot(): string {
  const candidates = [
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), "..", "data"),
    path.join(process.cwd(), "..", "..", "data"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "ingredients", "catalog.yaml"))) return dir;
  }
  throw new CatalogMissingError();
}

/** YAML on disk is the catalog. Production caches it. Development re-reads the files. */
export function loadIngredientData(): { catalog: IngredientCatalog; pack: RulePack } {
  if (process.env.NODE_ENV === "production" && cached) return cached;
  const root = findDataRoot();
  const catalog = parseCatalog(
    parse(readFileSync(path.join(root, "ingredients", "catalog.yaml"), "utf8"))
  );
  const pack = parseRulePack(parse(readFileSync(path.join(root, "rules", "v1", "pack.yaml"), "utf8")));
  cached = { catalog, pack };
  return cached;
}
