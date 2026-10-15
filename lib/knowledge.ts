import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import {
  DISCLAIMER,
  EMPTY_PROFILE,
  evaluateVerdict,
  normalizeInciKey,
  type IngredientCatalog,
  type IngredientProfile,
  type ParsedToken,
  type RulePack,
} from "@riru/shared";
import { contentTokens, cosine, type EmbeddingProvider } from "./embeddings.ts";
import { SYSTEM_PROMPT, type ChatTurn, type LlmProvider } from "./llm.ts";

const chunkSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,80}$/),
  title: z.string().min(1),
  source: z.string().min(1),
  topic: z.string().min(1),
  last_reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z.string().min(1),
});

const packSchema = z.object({
  version: z.string().min(1),
  chunks: z.array(chunkSchema).min(1),
});

export type KnowledgeChunk = {
  id: string;
  title: string;
  source: string;
  topic: string;
  lastReviewed: string;
  content: string;
  embedding: number[];
};

export type Citation = {
  kind: "chunk" | "rule" | "safety";
  id: string;
  title: string;
};

export type ChatAnswer = {
  text: string;
  citations: Citation[];
  followUps: string[];
  unsure: boolean;
  refused: boolean;
};

const MIN_SCORE = 0.45;
export const MAX_CHAT_CHARS = 2000;

const FOLLOW_UPS: Record<string, string[]> = {
  sunscreen: ["How do I patch test a new product?", "What order should a simple morning routine follow?"],
  "patch-testing": ["How much sunscreen should I apply on my face?", "What order should a simple morning routine follow?"],
  routine: ["How much sunscreen should I apply on my face?", "How do I patch test a new product?"],
  ingredients: ["What order should a simple morning routine follow?", "How do I patch test a new product?"],
  aftercare: ["How do I patch test a new product?", "What order should a simple morning routine follow?"],
  safety: ["How do I patch test a new product?"],
};

export function loadKnowledgePack(root = findKnowledgeRoot()): KnowledgeChunk[] {
  const file = path.join(root, "knowledge", "v1", "pack.yaml");
  const parsed = packSchema.parse(parse(readFileSync(file, "utf8")));
  const seen = new Set<string>();
  return parsed.chunks.map((chunk) => {
    if (seen.has(chunk.id)) throw new Error(`Duplicate knowledge id: ${chunk.id}`);
    seen.add(chunk.id);
    return {
      id: chunk.id,
      title: chunk.title,
      source: chunk.source,
      topic: chunk.topic,
      lastReviewed: chunk.last_reviewed,
      content: chunk.body.trim(),
      embedding: [],
    };
  });
}

export function findKnowledgeRoot(): string {
  const candidates = [path.join(process.cwd(), "data"), path.join(process.cwd(), "..", "data")];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "knowledge", "v1", "pack.yaml"))) return dir;
  }
  throw new Error("KNOWLEDGE_PACK_MISSING");
}

export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function keywordScore(query: string, chunk: KnowledgeChunk): number {
  const wanted = contentTokens(`${query}`);
  if (wanted.length === 0) return 0;
  const have = new Set(contentTokens(`${chunk.title} ${chunk.content}`));
  const hits = wanted.filter((token) => have.has(token)).length;
  return hits / wanted.length;
}

export function rankChunks(
  query: string,
  queryVector: number[],
  chunks: KnowledgeChunk[],
  k = 4
): Array<KnowledgeChunk & { score: number }> {
  const ranked = chunks
    .map((chunk) => {
      const vectorScore = chunk.embedding.length > 0 ? cosine(queryVector, chunk.embedding) : 0;
      const words = keywordScore(query, chunk);
      return { ...chunk, score: Math.max(vectorScore, words) };
    })
    .filter((chunk) => chunk.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, k);
}

export function mentionedIngredients(text: string, catalog: IngredientCatalog): ParsedToken[] {
  const hay = ` ${normalizeInciKey(text)} `;
  const found: ParsedToken[] = [];
  const seen = new Set<string>();
  for (const entry of catalog.entries) {
    const names = [entry.key, ...entry.aliases.map((alias) => normalizeInciKey(alias))];
    if (!names.some((name) => name.length >= 4 && hay.includes(` ${name} `))) continue;
    if (seen.has(entry.inci)) continue;
    seen.add(entry.inci);
    found.push({ raw: entry.inci, inci: entry.inci, status: "matched" });
  }
  return found;
}

export function ruleCitations(
  text: string,
  catalog: IngredientCatalog,
  pack: RulePack,
  profile: IngredientProfile
): Citation[] {
  const tokens = mentionedIngredients(text, catalog);
  if (tokens.length === 0) return [];
  const verdict = evaluateVerdict(tokens, pack, catalog, profile);
  if (!verdict.ok) return [];
  return verdict.reasons.map((reason) => ({
    kind: "rule" as const,
    id: reason.ruleKey,
    title: reason.message,
  }));
}

export function safetyDecision(text: string): ChatAnswer | null {
  const lower = text.toLowerCase();
  if (/skin cancer|melanoma|changing mole|mole that changed|bleeding mole/.test(lower)) {
    return {
      text: `See a dermatologist. This app cannot assess skin cancer or a changing mole. ${DISCLAIMER}`,
      citations: [{ kind: "safety", id: "safety_dermatologist", title: "See a dermatologist" }],
      followUps: FOLLOW_UPS.safety,
      unsure: false,
      refused: true,
    };
  }
  if (
    /\b(prescrib|prescription|dosage|milligram|tretinoin|isotretinoin)\b/i.test(text) ||
    /\b\d+(\.\d+)?\s*(mg|iu)\b/i.test(text)
  ) {
    return {
      text: `I can't prescribe or give a drug dose. A clinician has to decide that. ${DISCLAIMER}`,
      citations: [{ kind: "safety", id: "safety_no_dose", title: "No prescribing" }],
      followUps: [],
      unsure: false,
      refused: true,
    };
  }
  return null;
}

export function followUpsFor(topics: string[]): string[] {
  const out: string[] = [];
  for (const topic of topics) {
    for (const line of FOLLOW_UPS[topic] ?? []) {
      if (!out.includes(line)) out.push(line);
    }
  }
  return out.slice(0, 3);
}

export function profileContext(flags: {
  pregnantOrFeeding: boolean;
  fragranceSensitive: boolean;
  allergies: string[];
  scanSummary: string | null;
}): string {
  const allergies = flags.allergies.length > 0 ? flags.allergies.join(", ") : "none listed";
  const scan = flags.scanSummary?.trim() || "No succeeded scan summary is saved.";
  return [
    "Optional profile context, flags only.",
    `Pregnant or feeding: ${flags.pregnantOrFeeding ? "yes" : "no"}.`,
    `Fragrance sensitive: ${flags.fragranceSensitive ? "yes" : "no"}.`,
    `Allergy names: ${allergies}.`,
    `Latest scan summary: ${scan}`,
  ].join(" ");
}

export const PROFILE_CONTEXT_SQL =
  "SELECT pregnant_or_feeding, fragrance_sensitive, self_described_sensitive, allergies FROM profiles WHERE user_id = $1";

export const RECOVERY_FLAG_SQL =
  "SELECT active FROM procedure_recoveries WHERE user_id = $1 AND active = true LIMIT 1";

export const SCAN_SUMMARY_SQL =
  "SELECT summary FROM skin_scans WHERE user_id = $1 AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1";

function finish(text: string): string {
  const trimmed = text.trim();
  if (trimmed.includes(DISCLAIMER)) return trimmed;
  return `${trimmed} ${DISCLAIMER}`;
}

export async function answerChat(input: {
  message: string;
  history: ChatTurn[];
  chunks: KnowledgeChunk[];
  catalog: IngredientCatalog;
  pack: RulePack;
  profile: IngredientProfile;
  profileNote: string | null;
  embed: EmbeddingProvider;
  llm: LlmProvider;
}): Promise<ChatAnswer> {
  const safety = safetyDecision(input.message);
  if (safety) return safety;

  const rules = ruleCitations(input.message, input.catalog, input.pack, input.profile);
  let queryVector: number[] = [];
  try {
    queryVector = (await input.embed.embed([input.message]))[0] ?? [];
  } catch {
    queryVector = [];
  }
  const hits = rankChunks(input.message, queryVector, input.chunks);
  if (hits.length === 0 && rules.length === 0) {
    return {
      text: `I'm not sure. A dermatologist or pharmacist can look at this with you. ${DISCLAIMER}`,
      citations: [],
      followUps: [],
      unsure: true,
      refused: false,
    };
  }

  const citations: Citation[] = [
    ...hits.map((hit) => ({ kind: "chunk" as const, id: hit.id, title: hit.title })),
    ...rules,
  ];
  const context = [
    "Context:",
    ...hits.map((hit) => `Note ${hit.id} (${hit.title}, ${hit.source}): ${hit.content}`),
    ...rules.map((rule) => `Rule ${rule.id}: ${rule.title}`),
    input.profileNote ? input.profileNote : "Profile context: off.",
    "UNTRUSTED USER MESSAGE:",
    input.message.slice(0, MAX_CHAT_CHARS),
  ].join("\n");

  const history = input.history.slice(-6).map((turn) => ({
    role: turn.role,
    content: turn.content.slice(0, 500),
  }));
  let generated = "";
  if (input.llm.configured()) {
    try {
      for await (const token of input.llm.stream({
        system: SYSTEM_PROMPT,
        messages: [...history, { role: "user", content: context }],
      })) {
        generated += token;
      }
    } catch {
      generated = "";
    }
  }
  const grounded = [
    ...hits.map((hit) => `${hit.title} [${hit.id}]: ${hit.content}`),
    ...rules.map((rule) => `${rule.title} [${rule.id}]`),
  ].join("\n\n");
  const usedModel = generated.trim().length > 0 && !leaksInstruction(generated, input.message);
  const text = finish(usedModel ? generated.trim() : grounded);
  return {
    text,
    citations,
    followUps: followUpsFor(hits.map((hit) => hit.topic)),
    unsure: false,
    refused: false,
  };
}

function leaksInstruction(answer: string, userMessage: string): boolean {
  const lower = answer.toLowerCase();
  if (lower.includes("ignore previous")) return true;
  if (/\b0\.\d+\s*%/.test(answer) && /\b0\.\d+\s*%/.test(userMessage)) return true;
  return false;
}

export function emptyProfile(): IngredientProfile {
  return { ...EMPTY_PROFILE, allergies: [] };
}
