import { lookupIngredientKnowledge } from "./knowledge";

export type IngredientDetail = {
  name: string;
  function: string;
  concern: string;
  rating: "good" | "neutral" | "caution";
  category?: string;
  benefits?: string[];
  skinTypes?: string[];
  irritationRisk?: string;
  chemicalReactivity?: string;
  phNotes?: string;
  compatibilityNotes?: string;
  comedogenicity?: string;
};

const KNOWN: Record<string, Omit<IngredientDetail, "name">> = {
  water: { function: "Solvent / base", concern: "None known", rating: "neutral" },
  aqua: { function: "Solvent / base", concern: "None known", rating: "neutral" },
  glycerin: { function: "Humectant — draws water into skin", concern: "None known", rating: "good" },
  "hyaluronic acid": { function: "Humectant — surface hydration", concern: "None known", rating: "good" },
  "sodium hyaluronate": { function: "Humectant", concern: "None known", rating: "good" },
  niacinamide: { function: "Brighten, pores, barrier support", concern: "High % can flush sensitive skin", rating: "good" },
  "ceramide np": { function: "Barrier lipid", concern: "None known", rating: "good" },
  "ceramide ap": { function: "Barrier lipid", concern: "None known", rating: "good" },
  cholesterol: { function: "Barrier lipid", concern: "None known", rating: "good" },
  "panthenol": { function: "Soothing humectant", concern: "None known", rating: "good" },
  "tocopherol": { function: "Antioxidant (vitamin E)", concern: "None known", rating: "good" },
  "ascorbic acid": { function: "Vitamin C antioxidant / brightener", concern: "Can sting compromised barrier", rating: "good" },
  "ascorbyl glucoside": { function: "Stable vitamin C derivative", concern: "None known", rating: "good" },
  "azelaic acid": { function: "Calms redness, fades marks", concern: "Mild tingling possible", rating: "good" },
  "salicylic acid": { function: "BHA — unclogs pores", concern: "Drying if overused", rating: "caution" },
  "glycolic acid": { function: "AHA exfoliant", concern: "Photosensitizing; skip on broken barrier", rating: "caution" },
  "lactic acid": { function: "Gentle AHA", concern: "Use SPF the next day", rating: "neutral" },
  retinol: { function: "Cell turnover / texture", concern: "Irritation, not for pregnancy", rating: "caution" },
  retinal: { function: "Stronger retinoid", concern: "Irritation, not for pregnancy", rating: "caution" },
  "retinaldehyde": { function: "Retinoid", concern: "Irritation, not for pregnancy", rating: "caution" },
  "tretinoin": { function: "Prescription retinoid", concern: "Irritation, not for pregnancy", rating: "caution" },
  "benzoyl peroxide": { function: "Antibacterial acne treatment", concern: "Drying, bleaches fabric", rating: "caution" },
  "fragrance": { function: "Scent", concern: "Common irritant / allergen", rating: "caution" },
  parfum: { function: "Scent", concern: "Common irritant / allergen", rating: "caution" },
  "essential oil": { function: "Scent / marketing", concern: "Sensitization risk", rating: "caution" },
  "limonene": { function: "Fragrance component", concern: "Allergen when oxidized", rating: "caution" },
  "linalool": { function: "Fragrance component", concern: "Allergen when oxidized", rating: "caution" },
  alcohol: { function: "Solvent / feel", concern: "Can be drying (denat.)", rating: "caution" },
  "alcohol denat": { function: "Solvent / quick-dry", concern: "Barrier disruption if high on list", rating: "caution" },
  "phenoxyethanol": { function: "Preservative", concern: "Rare sensitivity", rating: "neutral" },
  "ethylhexylglycerin": { function: "Preservative booster", concern: "None known", rating: "neutral" },
  "dimethicone": { function: "Silicone occlusive / slip", concern: "None known for most skin", rating: "neutral" },
  "cyclopentasiloxane": { function: "Volatile silicone", concern: "None known", rating: "neutral" },
  "squalane": { function: "Lightweight emollient", concern: "None known", rating: "good" },
  "shea butter": { function: "Rich emollient", concern: "Can feel heavy on acne-prone skin", rating: "neutral" },
  "coconut oil": { function: "Occlusive oil", concern: "Comedogenic for many", rating: "caution" },
  "isopropyl myristate": { function: "Emollient / solvent", concern: "Comedogenic for some", rating: "caution" },
  "zinc oxide": { function: "Mineral UV filter + calm", concern: "None known", rating: "good" },
  "titanium dioxide": { function: "Mineral UV filter", concern: "None known", rating: "good" },
  "avobenzone": { function: "UVA filter", concern: "Can degrade without stabilizers", rating: "neutral" },
  "octinoxate": { function: "UVB filter", concern: "Some prefer mineral filters", rating: "neutral" },
  "centella asiatica": { function: "Soothing extract", concern: "None known", rating: "good" },
  "madecassoside": { function: "Centella active — repair", concern: "None known", rating: "good" },
  "green tea": { function: "Antioxidant", concern: "None known", rating: "good" },
  "camellia sinensis": { function: "Antioxidant (green tea)", concern: "None known", rating: "good" },
  "allantoin": { function: "Soothing", concern: "None known", rating: "good" },
  urea: { function: "Humectant / keratolytics at higher %", concern: "Sting on cracked skin", rating: "good" },
  "petrolatum": { function: "Occlusive seal", concern: "None known", rating: "good" },
  "mineral oil": { function: "Occlusive", concern: "None known (highly refined)", rating: "neutral" },
  "propylene glycol": { function: "Humectant / solvent", concern: "Irritant for a minority", rating: "neutral" },
  "butylene glycol": { function: "Humectant / solvent", concern: "None known", rating: "neutral" },
  "caprylyl glycol": { function: "Humectant / mild preservative", concern: "None known", rating: "neutral" },
  "carbomer": { function: "Thickener", concern: "None known", rating: "neutral" },
  "xanthan gum": { function: "Thickener", concern: "None known", rating: "neutral" },
  "disodium edta": { function: "Chelator", concern: "None known", rating: "neutral" },
  "sodium benzoate": { function: "Preservative", concern: "None known at cosmetic levels", rating: "neutral" },
  "potassium sorbate": { function: "Preservative", concern: "None known", rating: "neutral" },
  "citric acid": { function: "pH adjuster", concern: "None known at low %", rating: "neutral" },
  "sodium hydroxide": { function: "pH adjuster", concern: "None known at finished pH", rating: "neutral" },
  "adenosine": { function: "Soothing / anti-aging support", concern: "None known", rating: "good" },
  "peptides": { function: "Signaling / firmness claim", concern: "None known", rating: "good" },
  "palmitoyl tripeptide": { function: "Peptide", concern: "None known", rating: "good" },
  "tranexamic acid": { function: "Tone / PIH", concern: "None known", rating: "good" },
  "arbutin": { function: "Tone evening", concern: "None known", rating: "good" },
  "alpha-arbutin": { function: "Tone evening", concern: "None known", rating: "good" },
  "kojic acid": { function: "Tone evening", concern: "Can irritate", rating: "neutral" },
  "hydroquinone": { function: "Strong pigment suppressant", concern: "Use under guidance; not long-term DIY", rating: "caution" },
};

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\d+(\.\d+)?\s*%/g, "")
    .trim();
}

export function cleanIngredients(text: string): string[] {
  let body = text.replace(/\n/g, " ");
  const m = body.match(/ingredients?\s*[:\-]?[\s]*(.*)/i);
  if (m) body = m[1];
  const parts = body.split(/[,;•·]/);
  const cleaned: string[] = [];
  for (const raw of parts) {
    const item = raw
      .replace(/[^A-Za-z0-9\s\-\/\(\)\.]/g, "")
      .replace(/^[\s.]+|[\s.]+$/g, "");
    if (item.length > 2 && item.length < 60) cleaned.push(item);
  }
  const seen = new Set<string>();
  return cleaned.filter((name) => {
    const key = normalizeName(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function explainIngredients(names: string[]): IngredientDetail[] {
  return names.map((name) => {
    const dataset = lookupIngredientKnowledge(name);
    if (dataset) {
      const risk = dataset.irritation_risk.toLowerCase();
      const rating = risk.includes("high")
        ? "caution"
        : risk.includes("medium")
          ? "neutral"
          : "good";
      return {
        name,
        function: `${dataset.category} — ${dataset.benefits.join(", ")}`,
        concern: dataset.compatibility_notes,
        rating: rating as IngredientDetail["rating"],
        category: dataset.category,
        benefits: dataset.benefits,
        skinTypes: dataset.skin_types,
        irritationRisk: dataset.irritation_risk,
        chemicalReactivity: dataset.chemical_reactivity,
        phNotes: dataset.ph_notes,
        compatibilityNotes: dataset.compatibility_notes,
        comedogenicity: dataset.comedogenicity,
      };
    }

    const key = normalizeName(name);
    const hit =
      KNOWN[key] ||
      Object.entries(KNOWN).find(([k]) => key.includes(k) || k.includes(key))?.[1];
    if (hit) return { name, ...hit };
    return {
      name,
      function: "Not in local dictionary — treat as inactive / unknown",
      concern: "None listed",
      rating: "neutral" as const,
    };
  });
}

function titleCase(name: string) {
  return name.replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

/** Pull INCI names from chat: pasted lists, "I use X", or known actives mentioned. */
export function extractChatIngredients(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const key = normalizeName(name);
    if (!key || key.length < 3 || seen.has(key)) return;
    seen.add(key);
    found.push(name.trim());
  };

  const looksLikeList =
    /ingredients?\s*[:\-]/i.test(text) || (text.match(/,/g) ?? []).length >= 2;
  if (looksLikeList) {
    for (const n of cleanIngredients(text)) add(n);
  }

  const lower = text.toLowerCase();
  for (const key of Object.keys(KNOWN)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(lower)) add(titleCase(key));
  }

  const addMentions = text.matchAll(
    /(?:add|i use|i'm using|im using|using|contains)\s+([A-Za-z][A-Za-z0-9\s\-]{2,40}?)(?:[.!,\n]|$)/gi
  );
  for (const m of addMentions) {
    const name = m[1].trim();
    if (/\b(skin|face|routine|scan|score|product|label|camera)\b/i.test(name)) continue;
    if (name.split(/\s+/).length > 4) continue;
    add(name);
  }

  return found;
}

export function toLabIngredients(
  details: IngredientDetail[],
  favorites: string[] = []
) {
  return details.map((d) => ({
    name: d.name,
    role: d.function.split(/[—-]/)[0].trim().slice(0, 28) || "Ingredient",
    match: d.rating === "good" ? 92 : d.rating === "caution" ? 58 : 74,
    tone: (d.rating === "caution" ? "teal" : "emerald") as "emerald" | "teal",
    favorited: favorites.includes(d.name),
  }));
}
