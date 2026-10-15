import { spawn } from "node:child_process";
import path from "node:path";

export const EMBEDDING_DIMS = 384;

export type EmbeddingProvider = {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
};

const STOP = new Set([
  "a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "with", "my", "your",
  "how", "what", "when", "should", "can", "do", "i", "is", "are", "be", "it", "this",
  "that", "about", "please", "me", "you",
]);

export function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP.has(token));
}

/** Deterministic 384-d bag of words. Tests and machines without the Python model use this. */
export function hashEmbed(text: string, dimensions = EMBEDDING_DIMS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  for (const token of contentTokens(text)) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i++) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    vector[Math.abs(hash) % dimensions] += 1;
  }
  return normalize(vector);
}

export function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

export function cosine(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += a[i] * b[i];
  return sum;
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = "mock";
  readonly dimensions = EMBEDDING_DIMS;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => hashEmbed(text, this.dimensions));
  }
}

export class LocalSentenceTransformerProvider implements EmbeddingProvider {
  readonly name = "local";
  readonly dimensions = EMBEDDING_DIMS;

  async embed(texts: string[]): Promise<number[][]> {
    const script = path.join(process.cwd(), "scripts", "embed_local.py");
    const python = process.env.PYTHON || "python";
    const vectors = await runPython(python, script, JSON.stringify(texts));
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      throw new Error("EMBEDDINGS_UNAVAILABLE");
    }
    return vectors.map((row) => {
      if (!Array.isArray(row) || row.length !== EMBEDDING_DIMS) {
        throw new Error("EMBEDDINGS_UNAVAILABLE");
      }
      return normalize(row.map((value) => Number(value)));
    });
  }
}

function runPython(python: string, script: string, stdin: string): Promise<number[][]> {
  return new Promise((resolve, reject) => {
    const child = spawn(python, [script], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", () => reject(new Error("EMBEDDINGS_UNAVAILABLE")));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || "EMBEDDINGS_UNAVAILABLE"));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as number[][]);
      } catch {
        reject(new Error("EMBEDDINGS_UNAVAILABLE"));
      }
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

export function embeddingProviderFromEnv(): EmbeddingProvider {
  const name = (process.env.EMBEDDINGS_PROVIDER || "local").trim().toLowerCase();
  if (name === "mock" || name === "hash") return new MockEmbeddingProvider();
  return new LocalSentenceTransformerProvider();
}
