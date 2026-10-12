import { z } from "zod";

/**
 * Deterministic INCI matching and the versioned conflict pack.
 * OCR text is untrusted data. This module never sends it to a model.
 * Fuzzy distances are unvalidated engineering defaults.
 */

export const HIGH_IRRITANCY = 4;

const nameSchema = z.string().trim().min(1);

export const catalogFileSchema = z
  .object({
    version: z.union([z.string().min(1), z.number().int()]),
    ingredients: z
      .array(
        z
          .object({
            inci: nameSchema,
            aliases: z.array(nameSchema).optional(),
            functions: z.array(nameSchema).min(1),
            irritancy: z.number().int().min(0).max(5).nullable(),
            comedogenicity: z.number().int().min(0).max(5).nullable(),
            typical_range: z.string().min(1).nullable(),
            pregnancy_note: z.string().min(1),
            avoid_if: z.array(nameSchema).optional(),
            plain_description: z.string().min(1),
            source: z.string().min(1),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

export const rulePackSchema = z
  .object({
    version: z.string().min(1),
    rules: z
      .array(
        z
          .object({
            rule_key: z.string().trim().min(1),
            version: z.string().min(1).optional(),
            kind: z.enum(["conflict", "nuance", "profile"]),
            source: z.string().min(1).optional(),
            when: z
              .object({
                all_present: z.array(nameSchema).optional(),
                any_present: z.array(nameSchema).optional(),
              })
              .strict(),
            unless_profile: z
              .object({
                recovery_active: z.boolean().optional(),
              })
              .strict()
              .optional(),
            requires_profile: z
              .object({
                pregnant_or_feeding: z.boolean().optional(),
                fragrance_sensitive: z.boolean().optional(),
                self_described_sensitive: z.boolean().optional(),
              })
              .strict()
              .optional(),
            effect: z
              .object({
                verdict: z.enum(["good_fit", "caution", "avoid"]),
                message: z.string().min(1),
              })
              .strict(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

export type CatalogEntry = {
  inci: string;
  key: string;
  aliases: string[];
  functions: string[];
  irritancy: number | null;
  comedogenicity: number | null;
  typicalRange: string | null;
  pregnancyNote: string;
  avoidIf: string[];
  plainDescription: string;
  source: string;
};

export type IngredientCatalog = {
  entries: CatalogEntry[];
  byKey: Map<string, CatalogEntry>;
};

export type IngredientRule = {
  id: string;
  kind: "conflict" | "nuance" | "profile";
  allPresent: string[];
  anyPresent: string[];
  requiresPregnant: boolean;
  requiresFragranceSensitive: boolean;
  requiresSensitive: boolean;
  unlessRecoveryActive: boolean;
  verdict: "good_fit" | "caution" | "avoid";
  message: string;
};

export type RulePack = {
  version: string;
  rules: IngredientRule[];
};

export type IngredientProfile = {
  pregnantOrFeeding: boolean;
  fragranceSensitive: boolean;
  selfDescribedSensitive: boolean;
  recoveryActive: boolean;
  allergies: string[];
};

export type ParsedToken = {
  raw: string;
  inci: string | null;
  status: "matched" | "fuzzy" | "unparsed";
};

export type VerdictName = "good_fit" | "caution" | "avoid";

export type VerdictReason = {
  ruleKey: string;
  message: string;
};

export type VerdictResult =
  | { ok: false; code: "EMPTY" }
  | {
      ok: true;
      verdict: VerdictName;
      reasons: VerdictReason[];
      unparsed: string[];
      rulesetVersion: string;
    };

export const EMPTY_PROFILE: IngredientProfile = {
  pregnantOrFeeding: false,
  fragranceSensitive: false,
  selfDescribedSensitive: false,
  recoveryActive: false,
  allergies: [],
};

const RANK: Record<VerdictName, number> = {
  good_fit: 0,
  caution: 1,
  avoid: 2,
};

/** Uppercase, drop punctuation, keep digits, collapse spaces. */
export function normalizeInciKey(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fuzzyLimit(length: number): number | null {
  if (length < 5) return null;
  const cap = length <= 8 ? 1 : 2;
  const ratioCap = Math.floor(length * 0.25);
  const limit = Math.min(cap, ratioCap);
  return limit >= 1 ? limit : null;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev: number[] = [];
  let curr: number[] = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const insert = curr[j - 1] + 1;
      const remove = prev[j] + 1;
      const replace = prev[j - 1] + cost;
      curr[j] = insert < remove ? (insert < replace ? insert : replace) : remove < replace ? remove : replace;
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length] ?? 0;
}

export function parseCatalog(input: unknown): IngredientCatalog {
  const parsed = catalogFileSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Ingredient catalog YAML is invalid.");
  }
  const entries: CatalogEntry[] = [];
  const byKey = new Map<string, CatalogEntry>();
  for (const row of parsed.data.ingredients) {
    const key = normalizeInciKey(row.inci);
    if (!key) throw new Error("Ingredient catalog YAML is invalid.");
    const aliases = (row.aliases ?? []).map((alias) => alias.trim());
    const entry: CatalogEntry = {
      inci: row.inci.trim(),
      key,
      aliases,
      functions: row.functions,
      irritancy: row.irritancy,
      comedogenicity: row.comedogenicity,
      typicalRange: row.typical_range,
      pregnancyNote: row.pregnancy_note,
      avoidIf: row.avoid_if ?? [],
      plainDescription: row.plain_description,
      source: row.source,
    };
    const keys = [key, ...aliases.map((alias) => normalizeInciKey(alias))];
    for (const aliasKey of keys) {
      if (!aliasKey) throw new Error("Ingredient catalog YAML is invalid.");
      const existing = byKey.get(aliasKey);
      if (existing && existing.inci !== entry.inci) {
        throw new Error(`Ingredient catalog name collides: ${aliasKey}`);
      }
      if (!existing) byKey.set(aliasKey, entry);
    }
    if (entries.some((item) => item.inci === entry.inci)) {
      throw new Error(`Ingredient catalog name collides: ${entry.inci}`);
    }
    entries.push(entry);
  }
  return { entries, byKey };
}

export function parseRulePack(input: unknown): RulePack {
  const parsed = rulePackSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Ingredient rule pack YAML is invalid.");
  }
  const seen = new Set<string>();
  const rules: IngredientRule[] = [];
  for (const row of parsed.data.rules) {
    if (seen.has(row.rule_key)) {
      throw new Error(`Ingredient rule key collides: ${row.rule_key}`);
    }
    seen.add(row.rule_key);
    const allPresent = (row.when.all_present ?? []).map((name) => normalizeInciKey(name));
    const anyPresent = (row.when.any_present ?? []).map((name) => normalizeInciKey(name));
    if (allPresent.some((name) => !name) || anyPresent.some((name) => !name)) {
      throw new Error("Ingredient rule pack YAML is invalid.");
    }
    if (allPresent.length === 0 && anyPresent.length === 0) {
      throw new Error(`Ingredient rule has no ingredients: ${row.rule_key}`);
    }
    rules.push({
      id: row.rule_key,
      kind: row.kind,
      allPresent,
      anyPresent,
      requiresPregnant: row.requires_profile?.pregnant_or_feeding === true,
      requiresFragranceSensitive: row.requires_profile?.fragrance_sensitive === true,
      requiresSensitive: row.requires_profile?.self_described_sensitive === true,
      unlessRecoveryActive: row.unless_profile?.recovery_active === true,
      verdict: row.effect.verdict,
      message: row.effect.message,
    });
  }
  return { version: parsed.data.version, rules };
}

export function lookupIngredient(catalog: IngredientCatalog, raw: string): CatalogEntry | null {
  const key = normalizeInciKey(raw);
  if (!key) return null;
  return catalog.byKey.get(key) ?? null;
}

export function toIngredientRecord(entry: CatalogEntry) {
  return {
    inci: entry.inci,
    functions: entry.functions,
    irritancy: entry.irritancy,
    comedogenicity: entry.comedogenicity,
    typicalRange: entry.typicalRange,
    pregnancyNote: entry.pregnancyNote,
    avoidIf: entry.avoidIf,
    plainDescription: entry.plainDescription,
    source: entry.source,
  };
}

function unique(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function fuzzyMatch(key: string, catalog: IngredientCatalog): CatalogEntry | null {
  const limit = fuzzyLimit(key.length);
  if (limit === null) return null;
  const bestByInci = new Map<string, { entry: CatalogEntry; distance: number }>();
  for (const [name, entry] of catalog.byKey) {
    if (Math.abs(name.length - key.length) > limit) continue;
    const distance = levenshtein(key, name);
    if (distance < 1 || distance > limit) continue;
    if (distance / key.length > 0.25) continue;
    const prev = bestByInci.get(entry.inci);
    if (!prev || distance < prev.distance) {
      bestByInci.set(entry.inci, { entry, distance });
    }
  }
  let winner: { entry: CatalogEntry; distance: number } | null = null;
  let tie = false;
  for (const hit of bestByInci.values()) {
    if (!winner || hit.distance < winner.distance) {
      winner = hit;
      tie = false;
    } else if (hit.distance === winner.distance && hit.entry.inci !== winner.entry.inci) {
      tie = true;
    }
  }
  if (!winner || tie) return null;
  return winner.entry;
}

function matchPiece(display: string, catalog: IngredientCatalog): ParsedToken {
  const full = normalizeInciKey(display);
  const outer = normalizeInciKey(display.replace(/\([^)]*\)/g, " "));
  const inners: string[] = [];
  for (const match of display.matchAll(/\(([^)]*)\)/g)) {
    inners.push(normalizeInciKey(match[1] ?? ""));
  }
  const exactHits: CatalogEntry[] = [];
  const seen = new Set<string>();
  for (const key of unique([full, outer, ...inners])) {
    const entry = catalog.byKey.get(key);
    if (!entry || seen.has(entry.inci)) continue;
    seen.add(entry.inci);
    exactHits.push(entry);
  }
  if (exactHits.length === 1) {
    return { raw: display, inci: exactHits[0].inci, status: "matched" };
  }
  if (exactHits.length > 1) {
    return { raw: display, inci: null, status: "unparsed" };
  }
  const fuzzy = full ? fuzzyMatch(full, catalog) : null;
  if (fuzzy) return { raw: display, inci: fuzzy.inci, status: "fuzzy" };
  return { raw: display, inci: null, status: "unparsed" };
}

/** Split a label on commas, semicolons, newlines, and bullets. Join a hyphen that breaks a word across lines. */
export function matchTokens(raw: string, catalog: IngredientCatalog): ParsedToken[] {
  const prepared = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/([A-Za-z])-\s*\n\s*([A-Za-z])/g, "$1$2");
  const tokens: ParsedToken[] = [];
  for (const piece of prepared.split(/[,;\n•·]+/)) {
    const display = piece.replace(/\s+/g, " ").trim();
    if (!display) continue;
    tokens.push(matchPiece(display, catalog));
  }
  return tokens;
}

function raise(current: VerdictName, next: VerdictName): VerdictName {
  return RANK[next] > RANK[current] ? next : current;
}

function presentKeys(tokens: ParsedToken[]): Set<string> {
  const keys = new Set<string>();
  for (const token of tokens) {
    if (!token.inci) continue;
    if (token.status !== "matched" && token.status !== "fuzzy") continue;
    const key = normalizeInciKey(token.inci);
    if (key) keys.add(key);
  }
  return keys;
}

function ruleMatches(rule: IngredientRule, present: Set<string>, profile: IngredientProfile): boolean {
  if (rule.unlessRecoveryActive && profile.recoveryActive) return false;
  if (rule.requiresPregnant && !profile.pregnantOrFeeding) return false;
  if (rule.requiresFragranceSensitive && !profile.fragranceSensitive) return false;
  if (rule.requiresSensitive && !profile.selfDescribedSensitive) return false;
  for (const name of rule.allPresent) {
    if (!present.has(name)) return false;
  }
  if (rule.anyPresent.length > 0 && !rule.anyPresent.some((name) => present.has(name))) {
    return false;
  }
  return true;
}

/**
 * Verdict from confirmed tokens. Nuance rules attach a message and do not
 * raise the verdict. Unparsed names block good_fit. An empty list is not a verdict.
 */
export function evaluateVerdict(
  tokens: ParsedToken[],
  pack: RulePack,
  catalog: IngredientCatalog,
  profile: IngredientProfile = EMPTY_PROFILE
): VerdictResult {
  if (tokens.length === 0) return { ok: false, code: "EMPTY" };
  const present = presentKeys(tokens);
  let verdict: VerdictName = "good_fit";
  const reasons: VerdictReason[] = [];

  for (const rule of pack.rules) {
    if (!ruleMatches(rule, present, profile)) continue;
    if (rule.kind === "nuance") {
      reasons.push({ ruleKey: rule.id, message: rule.message });
      continue;
    }
    verdict = raise(verdict, rule.verdict);
    reasons.push({ ruleKey: rule.id, message: rule.message });
  }

  const allergyKeys = new Set(
    profile.allergies.map((name) => normalizeInciKey(name)).filter((name) => name.length > 0)
  );
  for (const token of tokens) {
    const rawKey = normalizeInciKey(token.raw);
    const inciKey = token.inci ? normalizeInciKey(token.inci) : "";
    if ((rawKey && allergyKeys.has(rawKey)) || (inciKey && allergyKeys.has(inciKey))) {
      verdict = raise(verdict, "avoid");
      reasons.push({
        ruleKey: "profile_allergy",
        message: `${token.inci ?? token.raw} matches a name on the allergy list in the profile.`,
      });
    }
    if (!profile.selfDescribedSensitive || !token.inci) continue;
    const entry = catalog.byKey.get(normalizeInciKey(token.inci));
    if (!entry || entry.irritancy === null || entry.irritancy < HIGH_IRRITANCY) continue;
    verdict = raise(verdict, "caution");
    reasons.push({
      ruleKey: "high_irritancy_sensitive",
      message: `${entry.inci} has a high irritancy rank in this catalog, and the profile says sensitive skin. The rank is not a measurement.`,
    });
  }

  const unparsed = tokens.filter((token) => token.status === "unparsed").map((token) => token.raw);
  if (unparsed.length > 0) {
    verdict = raise(verdict, "caution");
    reasons.push({
      ruleKey: "unparsed_names",
      message: "Some names are not in the catalog, so this list cannot be called a good fit.",
    });
  }

  return {
    ok: true,
    verdict,
    reasons,
    unparsed,
    rulesetVersion: pack.version,
  };
}
