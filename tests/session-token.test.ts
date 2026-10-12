import assert from "node:assert/strict";
import test from "node:test";
import {
  hashIp,
  hashSessionToken,
  newSessionToken,
  sessionPepper,
  SessionSecretError,
} from "../lib/session-token.ts";

test("session token hash is not the raw token and changes with the pepper", () => {
  const token = newSessionToken();
  const a = hashSessionToken(token, "pepper-a-sixteen");
  const b = hashSessionToken(token, "pepper-b-sixteen");
  assert.equal(a.length, 64);
  assert.notEqual(a, token);
  assert.notEqual(a, b);
  assert.equal(a, hashSessionToken(token, "pepper-a-sixteen"));
});

test("ip hash does not keep the address", () => {
  const hash = hashIp("203.0.113.8", "pepper-a-sixteen");
  assert.equal(hash.includes("203.0.113.8"), false);
  assert.equal(hash.length, 64);
});

test("production refuses a missing session secret", () => {
  const previousNode = process.env.NODE_ENV;
  const previousSecret = process.env.SESSION_SECRET;
  process.env.NODE_ENV = "production";
  delete process.env.SESSION_SECRET;
  assert.throws(() => sessionPepper(), SessionSecretError);
  process.env.NODE_ENV = previousNode;
  if (previousSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = previousSecret;
});
