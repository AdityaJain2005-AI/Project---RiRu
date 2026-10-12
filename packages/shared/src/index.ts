import { z } from "zod";

export const DISCLAIMER = "Informational only, not a medical diagnosis." as const;

export const errorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.unknown()).optional(),
  }),
});

export const sessionResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    mode: z.enum(["guest", "demo"]),
  }),
  disclaimer: z.literal(DISCLAIMER),
});

export type ErrorBody = z.infer<typeof errorBodySchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export {
  EMPTY_PROFILE,
  HIGH_IRRITANCY,
  catalogFileSchema,
  evaluateVerdict,
  fuzzyLimit,
  levenshtein,
  lookupIngredient,
  matchTokens,
  normalizeInciKey,
  parseCatalog,
  parseRulePack,
  rulePackSchema,
  toIngredientRecord,
  type CatalogEntry,
  type IngredientCatalog,
  type IngredientProfile,
  type IngredientRule,
  type ParsedToken,
  type RulePack,
  type VerdictName,
  type VerdictReason,
  type VerdictResult,
} from "./ingredients.ts";

export {
  ESCALATION,
  JACCARD_METHOD,
  blockReason,
  buildRoutine,
  jaccard,
  listAlternatives,
  parseManualPrice,
  parseProducts,
  parseRoutinePack,
  productFileSchema,
  routineFileSchema,
  searchProducts,
  type AlternativeHit,
  type Budget,
  type BuiltRoutine,
  type BuiltStep,
  type Concern,
  type FindingInput,
  type Period,
  type ProductRecord,
  type PublicProduct,
  type RecommendProfile,
  type RoutinePack,
  type RoutineTemplate,
  type Severity,
  type StepKind,
} from "./recommend.ts";
