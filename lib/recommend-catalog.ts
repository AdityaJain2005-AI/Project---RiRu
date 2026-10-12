import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  parseProducts,
  parseRoutinePack,
  type ProductRecord,
  type RoutinePack,
} from "@riru/shared";
import { parse } from "yaml";
import { CatalogMissingError, findDataRoot, loadIngredientData } from "./ingredient-catalog";

export type RecommendData = {
  products: ProductRecord[];
  pack: RoutinePack;
  irritancyAtLeast4: string[];
  byId: Map<string, ProductRecord>;
};

let cached: RecommendData | null = null;

function readYaml(root: string, ...parts: string[]): unknown {
  const file = path.join(root, ...parts);
  if (!existsSync(file)) throw new CatalogMissingError();
  return parse(readFileSync(file, "utf8"));
}

/** YAML on disk is the catalog. Production caches it. Development re-reads the files. */
export function loadRecommendData(): RecommendData {
  if (process.env.NODE_ENV === "production" && cached) return cached;
  const root = findDataRoot();
  const { catalog } = loadIngredientData();
  const known = new Set(catalog.byKey.keys());
  const products = parseProducts(readYaml(root, "products", "catalog.yaml"), known);
  const pack = parseRoutinePack(readYaml(root, "routines", "v1", "pack.yaml"));
  const irritancyAtLeast4 = catalog.entries
    .filter((entry) => entry.irritancy !== null && entry.irritancy >= 4)
    .map((entry) => entry.key);
  const byId = new Map(products.map((product) => [product.id, product]));
  cached = { products, pack, irritancyAtLeast4, byId };
  return cached;
}

export function openRecommendData():
  | { ok: true; data: RecommendData }
  | { ok: false; status: 500; code: "CATALOG_UNAVAILABLE"; message: string } {
  try {
    return { ok: true, data: loadRecommendData() };
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/v1/recommendations",
        code: err instanceof CatalogMissingError ? "catalog_missing" : "catalog_invalid",
        name,
      })
    );
    return {
      ok: false,
      status: 500,
      code: "CATALOG_UNAVAILABLE",
      message: "The product catalog is not available.",
    };
  }
}
