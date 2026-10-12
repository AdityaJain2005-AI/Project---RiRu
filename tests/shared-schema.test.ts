import assert from "node:assert/strict";
import test from "node:test";
import { DISCLAIMER, errorBodySchema, sessionResponseSchema } from "../packages/shared/src/index.ts";

test("error schema accepts the public error shape", () => {
  const parsed = errorBodySchema.parse({
    error: { code: "RATE_LIMITED", message: "Too many scans today." },
  });
  assert.equal(parsed.error.code, "RATE_LIMITED");
});

test("error schema rejects a string error", () => {
  assert.equal(errorBodySchema.safeParse({ error: "nope" }).success, false);
});

test("session payload carries the medical disclaimer", () => {
  const parsed = sessionResponseSchema.parse({
    user: { id: "00000000-0000-4000-8000-000000000001", mode: "demo" },
    disclaimer: DISCLAIMER,
  });
  assert.equal(parsed.disclaimer, "Informational only, not a medical diagnosis.");
});
