import ingredientDataset from "@/knowledge/face-wash-ingredients.json";
import productDataset from "@/knowledge/riru_products_seed.json";

export type FaceWashIngredientRecord = {
  name: string;
  category: string;
  benefits: string[];
  skin_types: string[];
  irritation_risk: string;
  chemical_reactivity: string;
  ph_notes: string;
  compatibility_notes: string;
  comedogenicity: string;
};

export type RiruProductRecord = {
  record_type: string;
  product_id: string;
  brand: string;
  product_name: string;
  aliases: string[];
  category: string;
  skin_types: string[];
  skin_concerns: string[];
  key_ingredients: string[] | null;
  full_ingredients: string[] | null;
  cautions: string[];
  data_status: string;
  notes?: string;
};

const ingredientRecords = ingredientDataset.ingredients as FaceWashIngredientRecord[];
const products = productDataset as RiruProductRecord[];

export function knowledgeNormalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/\b\d+(\.\d+)?\s*%/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ingredientIndex = new Map(
  ingredientRecords.map((record) => [knowledgeNormalize(record.name), record])
);

export function lookupIngredientKnowledge(name: string) {
  const key = knowledgeNormalize(name);
  if (!key) return null;
  return (
    ingredientIndex.get(key) ??
    ingredientRecords.find((record) => {
      const candidate = knowledgeNormalize(record.name);
      return key.includes(candidate) || candidate.includes(key);
    }) ??
    null
  );
}

export function ingredientKnowledgeSummary(name: string) {
  const record = lookupIngredientKnowledge(name);
  if (!record) return null;
  return {
    category: record.category,
    benefits: record.benefits,
    skinTypes: record.skin_types,
    irritationRisk: record.irritation_risk,
    chemicalReactivity: record.chemical_reactivity,
    phNotes: record.ph_notes,
    compatibilityNotes: record.compatibility_notes,
    comedogenicity: record.comedogenicity,
  };
}

function productText(product: RiruProductRecord) {
  return [
    product.brand,
    product.product_name,
    product.category,
    ...product.aliases,
    ...product.skin_types,
    ...product.skin_concerns,
  ].join(" ").toLowerCase();
}

export function recommendFaceWashProducts(query: string, limit = 5) {
  const text = query.toLowerCase();
  const requestedSkinTypes = ["oily", "dry", "combination", "sensitive", "acne prone", "normal"]
    .filter((type) => text.includes(type));
  const requestedConcerns = ["acne", "blemish", "oil", "dryness", "dehydration", "pores", "sensitive", "texture"]
    .filter((concern) => text.includes(concern));

  return products
    .filter((product) => product.category === "cleanser")
    .map((product) => {
      const haystack = productText(product);
      let score = 0;
      if (haystack.includes(text)) score += 5;
      for (const type of requestedSkinTypes) {
        if (product.skin_types.some((value) => value.replace(/_/g, " ").includes(type))) score += 3;
      }
      for (const concern of requestedConcerns) {
        if (haystack.includes(concern)) score += 2;
      }
      if (!requestedSkinTypes.length && !requestedConcerns.length) score += 1;
      return { product, score };
    })
    .sort((a, b) => b.score - a.score || a.product.product_id.localeCompare(b.product.product_id))
    .slice(0, limit)
    .map(({ product }) => product);
}

export function productRecommendationText(query: string) {
  const matches = recommendFaceWashProducts(query);
  if (!matches.length) return "I couldn't find a matching face-wash record in the starter catalog.";
  return [
    "Catalog matches (verify the current label before buying):",
    ...matches.map(
      (product) => `• ${product.brand} ${product.product_name} — ${product.skin_types.join(", ")}; ${product.skin_concerns.join(", ")}`
    ),
    "These are starter catalog records, not verified current formulations or medical recommendations.",
  ].join("\n");
}

export function knowledgeStats() {
  return { ingredientCount: ingredientRecords.length, cleanserCount: products.filter((p) => p.category === "cleanser").length };
}
