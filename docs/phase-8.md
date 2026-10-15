# RiRu Phase 8

Label reading stays Tesseract. PaddleOCR is still refused. The INCI normalizer has a small gold set against this catalog. Photographed-label accuracy was not measured.

Every ingredient payload still includes: "Informational only, not a medical diagnosis."

## What works

- `services/ml/app/ocr.py` still preprocesses with Pillow only: grayscale, autocontrast, scale the short edge toward 1200 and cap the long edge at 2000, Lanczos. A page whose mean brightness is under 90 is inverted first, so a dark label is not sent as a black image. Deskew is still absent. OpenCV is not imported.
- `OCR_PROVIDER=tesseract` is the only engine. `paddle` and any other name return HTTP 503 `OCR_PROVIDER_UNSUPPORTED`. A missing `tesseract` binary returns 503 `OCR_UNAVAILABLE`. Fewer than 3 letters returns `rejected_quality` and an empty string. The photo is not written to disk.
- INCI matching is still `matchTokens` / `normalizeInciKey` in `packages/shared`. `data/ingredients/inci-gold.yaml` is nine cases: exact names, aliases, a parenthetical, a one-character misspelling, and two strings that must stay unparsed. The test fails if any case drifts.
- Typed lists never call FastAPI. The label page still asks the user to confirm text before a verdict.

## How to run

```powershell
npm test
services\ml\.venv\Scripts\python.exe -m pytest services/ml/tests/test_ocr.py -q
```

Tesseract is not installed on this machine, so a live label photo cannot be read here. The app does not invent the text.

## Checks

Run on 2026-10-13:

- `tests/inci-gold.test.ts` passed: 9 of 9 gold cases.
- `pytest services/ml/tests/test_ocr.py`: 8 passed. That includes the dark-page invert, the paddle refusal, and the short-text rejection. The route tests stub `recognize`. They do not call a tesseract binary.
- `tesseract` is not on PATH. No photographed label was scored.
- `npm test` with `RIRU_INTEGRATION=1`: 50 passed, 1 skipped, 0 failed. The skip is the optional Anthropic call.
- `npm run typecheck` exited 0. `npm run prisma:validate` reported the schema valid.
- Browser on `http://localhost:3000/ingredients`: typed `Glycerol, Glycolc Acid`, confirmed the text, saw `GLYCERIN` and `Glycolc Acid → GLYCOLIC ACID (close spelling)`, then a compatible verdict with the disclaimer. The photo control was not used.
- `npm run build` exited 0.

## What this phase does not do

- PaddleOCR was not installed.
- No character-error rate or INCI accuracy was measured on real label photos.
- Phase 9 was not started.
