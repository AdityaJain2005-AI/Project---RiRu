import assert from "node:assert/strict";
import test from "node:test";
import { MAX_IMAGE_BYTES, sniffImage } from "../lib/image-bytes.ts";

test("jpeg, png, and webp magic bytes are accepted", () => {
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(
    sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png"
  );
  const webp = new Uint8Array(12);
  webp.set([0x52, 0x49, 0x46, 0x46], 0);
  webp.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.equal(sniffImage(webp), "image/webp");
});

test("svg, gif, and short buffers are rejected", () => {
  const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");
  assert.equal(sniffImage(svg), null);
  assert.equal(sniffImage(Uint8Array.from([0x47, 0x49, 0x46, 0x38])), null);
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8])), null);
  assert.equal(MAX_IMAGE_BYTES, 8 * 1024 * 1024);
});
