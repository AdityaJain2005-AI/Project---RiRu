import assert from "node:assert/strict";
import test from "node:test";
import { DISCLAIMER_EN, messages } from "../lib/i18n.ts";

test("English is the shipped copy", () => {
  const result = messages("en");
  assert.equal(result.locale, "en");
  assert.equal(result.translated, true);
  assert.equal(result.copy.disclaimer, DISCLAIMER_EN);
});

test("Hindi and Tamil stay untranslated and fall back to English", () => {
  for (const locale of ["hi", "ta"]) {
    const result = messages(locale);
    assert.equal(result.locale, locale);
    assert.equal(result.translated, false);
    assert.equal(result.copy.disclaimer, DISCLAIMER_EN);
    assert.equal(result.copy.skipToContent, "Skip to content");
  }
});

test("an unknown locale is treated as English", () => {
  const result = messages("fr");
  assert.equal(result.locale, "en");
  assert.equal(result.translated, true);
});
