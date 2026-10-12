import assert from "node:assert/strict";
import test from "node:test";
import { getStorage } from "../lib/storage.ts";

const bytes = new Uint8Array([1, 2, 3]);

test("default storage discards objects", async () => {
  const previous = process.env.STORAGE_PROVIDER;
  delete process.env.STORAGE_PROVIDER;
  const storage = getStorage();
  const put = await storage.putObject({
    userId: "user",
    objectId: "obj",
    bytes,
    contentType: "image/jpeg",
  });
  assert.deepEqual(put, { ok: false, code: "STORAGE_DISABLED" });
  assert.equal(await storage.signedUrl("user/obj"), null);
  if (previous === undefined) delete process.env.STORAGE_PROVIDER;
  else process.env.STORAGE_PROVIDER = previous;
});

test("supabase without credentials is misconfigured", async () => {
  const previousProvider = process.env.STORAGE_PROVIDER;
  const previousUrl = process.env.SUPABASE_URL;
  process.env.STORAGE_PROVIDER = "supabase";
  delete process.env.SUPABASE_URL;
  const storage = getStorage();
  const put = await storage.putObject({
    userId: "user",
    objectId: "obj",
    bytes,
    contentType: "image/jpeg",
  });
  assert.deepEqual(put, { ok: false, code: "STORAGE_MISCONFIGURED" });
  if (previousProvider === undefined) delete process.env.STORAGE_PROVIDER;
  else process.env.STORAGE_PROVIDER = previousProvider;
  if (previousUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = previousUrl;
});

test("s3 is rejected instead of writing to disk", async () => {
  const previous = process.env.STORAGE_PROVIDER;
  process.env.STORAGE_PROVIDER = "s3";
  const storage = getStorage();
  const put = await storage.putObject({
    userId: "user",
    objectId: "obj",
    bytes,
    contentType: "image/jpeg",
  });
  assert.deepEqual(put, { ok: false, code: "STORAGE_PROVIDER_UNSUPPORTED" });
  if (previous === undefined) delete process.env.STORAGE_PROVIDER;
  else process.env.STORAGE_PROVIDER = previous;
});
