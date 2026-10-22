import type { ScanPayload } from "./scan-engine";
import type { IngredientDetail } from "./ocr";

import { productRecommendationText } from "./knowledge";

export type ProductContext = {
  ingredients: string[];
  details: IngredientDetail[];
};

function metric(scan: ScanPayload | null, id: string, fallback: number) {
  return scan?.metrics.find((m) => m.id === id)?.score ?? fallback;
}

function weakest(scan: ScanPayload | null) {
  if (!scan?.metrics?.length) return null;
  return [...scan.metrics].sort((a, b) => a.score - b.score)[0];
}

function cautions(product: ProductContext | null) {
  return (product?.details ?? []).filter((d) => d.rating === "caution");
}

function goods(product: ProductContext | null) {
  return (product?.details ?? []).filter((d) => d.rating === "good");
}

function mentionedIngredients(text: string, product: ProductContext | null) {
  const hay = text.toLowerCase();
  const pool = product?.details?.length
    ? product.details
    : [];
  return pool.filter((d) => hay.includes(d.name.toLowerCase()));
}

function productBlurb(product: ProductContext | null) {
  if (!product?.ingredients?.length) {
    return "No product label scanned yet — use Product OCR, then ask me about it.";
  }
  const top = goods(product).slice(0, 4).map((d) => d.name);
  const warn = cautions(product).slice(0, 3).map((d) => d.name);
  const bits = [`Last label had ${product.ingredients.length} INCI names`];
  if (top.length) bits.push(`helpful: ${top.join(", ")}`);
  if (warn.length) bits.push(`watch: ${warn.join(", ")}`);
  return bits.join(". ") + ".";
}

function scanBlurb(scan: ScanPayload | null) {
  if (!scan) return "No face scan yet — run /scan so I can tie advice to scores.";
  const w = weakest(scan);
  return `Latest face score ${scan.overallScore}. ${scan.summary}${
    w ? ` Weakest marker: ${w.label} (${w.score}).` : ""
  }`;
}

function matchProductToSkin(scan: ScanPayload | null, product: ProductContext | null) {
  if (!product?.details?.length) return productBlurb(product);
  const hydration = metric(scan, "hydration", 72);
  const barrier = metric(scan, "barrier", 81);
  const pigment = metric(scan, "pigment", 63);
  const names = product.details.map((d) => d.name.toLowerCase()).join(" | ");
  const notes: string[] = [];

  if (/(hyaluronic|glycerin|urea|panthenol|squalane)/.test(names)) {
    notes.push(
      hydration < 75
        ? "Humectants on this label are a good match for low hydration — apply on damp skin."
        : "Hydration look fine; keep the humectants, no need to stack extra HA."
    );
  }
  if (/(ceramide|cholesterol|petrolatum|madecassoside|centella|allantoin)/.test(names)) {
    notes.push(
      barrier < 78
        ? "Barrier lipids/soothers on the label fit a recovering barrier. Pause extra acids."
        : "Barrier looks steady; those lipids are still useful at night."
    );
  }
  if (/(niacinamide|ascorb|vitamin c|azelaic|tranexamic|arbutin)/.test(names)) {
    notes.push(
      pigment < 70
        ? "Brighteners here line up with uneven tone — pair with daily SPF."
        : "Tone is decent; those brighteners are optional, not urgent."
    );
  }
  if (/(retinol|retinal|tretinoin|glycolic|salicylic|benzoyl)/.test(names) && barrier < 78) {
    notes.push("Strong actives on this label + a weaker barrier: use 1–2×/week or skip until barrier ≥78.");
  }
  const warn = cautions(product);
  if (warn.length) {
    notes.push(
      `Cautions: ${warn.map((d) => `${d.name} (${d.concern})`).join("; ")}.`
    );
  }
  return notes.join(" ") || productBlurb(product);
}

export function cosmetologistReply(
  userText: string,
  scan: ScanPayload | null,
  product: ProductContext | null = null
): string {
  const t = userText.toLowerCase();
  const score = scan?.overallScore ?? null;
  const hydration = metric(scan, "hydration", 72);
  const barrier = metric(scan, "barrier", 81);
  const pigment = metric(scan, "pigment", 63);
  const hits = mentionedIngredients(t, product);

  if (hits.length) {
    return hits
      .map((d) => `${d.name}: ${d.function}. ${d.concern}${d.rating === "caution" ? " — go slow." : ""}`)
      .join("\n") + `\n\n${matchProductToSkin(scan, product)}`;
  }

  if (/recommend|suggest|which .*?(face ?wash|cleanser)|face ?wash|cleanser options|what should i buy/.test(t)) {
    return `${productRecommendationText(userText)}\n\n${productBlurb(product)}`;
  }

  if (/ocr|label|inci|product|this cream|this serum|bottle|ingredient/.test(t)) {
    return `${matchProductToSkin(scan, product)}\n\n${scanBlurb(scan)}`;
  }

  if (/compat|together|mix|layer|conflict|ok for me|should i use/.test(t)) {
    return matchProductToSkin(scan, product);
  }

  if (/hydrat|dry|dehydrat|flak/.test(t)) {
    const extra = product
      ? ` From your last label: ${goods(product)
          .filter((d) => /hydrat|glycerin|hyaluron|urea|panthenol|squalane/i.test(d.name + d.function))
          .map((d) => d.name)
          .slice(0, 3)
          .join(", ") || "no obvious humectant — consider HA or glycerin"}.`
      : "";
    return `Hydration is ${hydration}. Tonight: humectant on damp skin, seal with a cream, skip foaming cleanser.${extra}`;
  }

  if (/cleanser|wash|cleanse|strip/.test(t)) {
    return `Barrier is ${barrier}. Use a gentle gel AM; double-cleanse PM only if you wore SPF. If the last OCR list leads with Alcohol Denat or fragrance, that’s a worse cleanser match.`;
  }

  if (/spf|sun|uv|pigment|dark spot|tone/.test(t)) {
    return `Even tone is ${pigment}. Daily mineral SPF 50 matters more than another serum. ${productBlurb(product)}`;
  }

  if (/routine|am|pm|night|morning|order/.test(t)) {
    return [
      scanBlurb(scan),
      "AM: cleanse → water-based serum → moisturizer → SPF.",
      "PM: cleanse → treatment (if barrier ≥78) → cream.",
      productBlurb(product),
    ].join("\n");
  }

  if (/retinol|retinoid|acid|exfol|peel|aha|bha/.test(t)) {
    return barrier < 78
      ? `Barrier ${barrier} is below 78 — hold retinoids/strong acids. Azelaic or lactic 1×/week max. ${productBlurb(product)}`
      : `Barrier ${barrier} can tolerate a mild acid or retinoid 2–3×/week. Don’t stack with another exfoliant on the OCR label the same night.`;
  }

  if (/acne|pore|breakout|clog/.test(t)) {
    return `Texture/pores: keep niacinamide, skip heavy oils (coconut, IPM) if they showed up on OCR. ${productBlurb(product)}`;
  }

  if (/sensitiv|red|sting|irritat|barrier/.test(t)) {
    return `Barrier ${barrier}. Strip back to cleanse / panthenol or centella / cream / SPF. Pause fragrance and acids from the last label.`;
  }

  if (/why|score|scan|result|what do you see/.test(t)) {
    return `${scanBlurb(scan)}\n${productBlurb(product)}`;
  }

  if (/hello|hi\b|hey|what can you/.test(t)) {
    return `I use your latest face scan${score != null ? ` (${score})` : ""} and any product OCR you ran. Ask about a label, layering, dryness, SPF, or whether a product fits your scores.`;
  }

  const w = weakest(scan);
  return [
    `Heard: “${userText.trim()}”.`,
    scanBlurb(scan),
    productBlurb(product),
    w
      ? `If you want a next step: target ${w.label.toLowerCase()} first, then we can check the last OCR list against it.`
      : "Scan your face or a product label and I’ll get specific.",
  ].join("\n");
}

export function chatSystemPrompt(scan: ScanPayload | null, product: ProductContext | null) {
  return [
    "You are Facelab’s skincare assistant — practical, not a doctor.",
    "Use BOTH the face-scan scores and the OCR ingredient list when present.",
    "If the user asks about a product, judge it against their scores (hydration, barrier, pigment).",
    "Flag fragrance, drying alcohol, strong acids, and retinoids when the barrier is weak.",
    "Short answers. No diagnosis.",
    `Face scan: ${JSON.stringify(scan)}`,
    `Latest OCR product: ${JSON.stringify(product)}`,
  ].join("\n");
}
