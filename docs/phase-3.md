# RiRu Phase 3

Type an ingredient list, or photograph a label. The app normalizes INCI names, then runs a versioned rule pack against the profile. The verdict uses the text you confirm. It is not a diagnosis, not a dose, and not a product suggestion.

Every scan and verdict payload includes: "Informational only, not a medical diagnosis."

## What works

- `POST /api/v1/ingredients/scan` accepts multipart `text` and/or a JPEG, PNG, or WebP (magic bytes, 8 MB). `disclaimerAck` must be the string `true`. The response is 202 and the body is an `IngredientScan`.
- Non-empty `text` is used instead of OCR. That path does not call FastAPI. The row is `succeeded` inside the request, with `ocrText` and `parsed`. `after()` is not required for a typed list.
- A photo is inserted as `queued`. `after()` sends the bytes to `POST /internal/v1/ingredient-scans`. The client polls `GET /api/v1/ingredients/scans/{id}` for about 60 seconds. FastAPI does not open Postgres and does not write the photo to disk.
- Tesseract reads stdin (`tesseract stdin stdout -l eng --psm 6`) after a Pillow preprocess: grayscale, autocontrast, short-edge upscale, long-edge cap. Deskew is not implemented. OpenCV is not imported. `OCR_PROVIDER=paddle`, or any provider other than `tesseract`, returns 503 `OCR_PROVIDER_UNSUPPORTED`. A missing binary returns 503 `OCR_UNAVAILABLE`. Fewer than 3 letters is HTTP 200 `rejected_quality` with an empty `ocrText`. No text is invented.
- The same `Idempotency-Key` and user return the original row and do not spend another daily slot. The limit is 20 ingredient scans per day outside demo mode. Validation failures do not spend a slot. A key already used by another job returns 409.
- `PATCH /api/v1/ingredients/scans/{id}` stores `confirmedText` and refreshes `parsed`. A queued or running row returns 409.
- `POST /api/v1/ingredients/analyze` takes `inciNames` or `ingredientScanId`, not both. `disclaimerAck` must be JSON `true`. A scan with null `confirmed_text` returns 400 `CONFIRM_REQUIRED`. Another user's scan returns 404. An empty list is 400, not a verdict.
- The catalog and the rule pack are YAML in `data/ingredients/catalog.yaml` and `data/rules/v1/pack.yaml`. The SQL `ingredients` and `ingredient_rules` tables stay empty. Contributors edit the files. `GET /api/v1/ingredients/{inci}` is a case-insensitive lookup and does not require a session.
- Matching is exact on the INCI name and aliases, then a close spelling when the token is at least 5 characters. The distance cap is 1 up to length 8, otherwise 2, and never more than a quarter of the length. A tie stays unparsed. A short token must be exact. A hyphen at a line break is joined before the split.
- `avoid` beats `caution` beats `good_fit`. An unparsed name blocks `good_fit`. A fuzzy match does not. `kind: nuance` (vitamin C plus niacinamide) adds a message and does not raise the verdict. The message says the old "never mix" claim is overstated at cosmetic pH, and that irritation is still possible.
- Pregnancy rules for retinoids, salicylic acid, and benzoyl peroxide set `avoid` when `pregnant_or_feeding` is true. The message says to follow a clinician. The app does not compute a dose. A missing profile is all flags false and allergies empty.
- A name on `profiles.allergies` that matches a token sets `avoid` (`profile_allergy`). Sensitive skin plus an irritancy rank of 4 or more sets `caution` (`high_irritancy_sensitive`). Those two rules are built in, not YAML. Irritancy ranks are coarse catalog defaults, not measurements. Comedogenicity is null.
- Fragrance materials (parfum, fragrance, limonene, linalool) are `caution` only when the profile is fragrance-sensitive.
- `retinol_plus_aha` is skipped while a `procedure_recoveries` row is active. This phase does not build or strip a routine.
- The photo is discarded unless `storeImage` is true and the storage adapter accepts it. `STORAGE_PROVIDER=none` still finishes the scan with `imageStored` false. Opt-in writes a `store_image` consent row. A bottle photo does not use `camera_analysis`.
- The screen is `/ingredients`, linked from the nav (Label) and the home cards. You confirm the notice, see matched, close-spelling, and unparsed tags, then choose "Check this text". There is no product list and no price.
- `db/phase3.sql` adds a partial unique index on `(user_id, idempotency_key)`. `migrate.js` runs it after phase 2. `scripts/bundle-migrate.mjs` inlines it as `__PHASE3_SQL__`.
- The standalone build includes `data/ingredients` and `data/rules` next to the server, and the loader also checks `process.cwd()/data`.

`POST /api/scans` still writes `heuristic_v0`. The face-scan path is unchanged.

## How to run

From the repo root, with Postgres already migrated through phase 3:

```powershell
npm ci
npm run dev
```

A typed list works with `DEMO_MODE=true` and no ML process. `DEMO_MODE=false` needs `SESSION_SECRET` of at least 16 characters.

Label photos need the ML service, from `services/ml`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
$env:ML_SERVICE_TOKEN = "dev-token"
$env:OCR_PROVIDER = "tesseract"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Point the web process at `ML_SERVICE_URL=http://127.0.0.1:8000` and the same token. The machine also needs the `tesseract` binary and English trained data on `PATH`. The Docker image installs `tesseract-ocr` and `tesseract-ocr-eng` at build time and does not download an OCR model at runtime.

## Checks that ran

On 2026-10-12, from this checkout:

- `npm test` (22 tests). The ingredient file loads the real YAML and checks conflicts, pregnancy `avoid`, the vitamin C nuance, unparsed names, fuzzy ties, allergies, and the phase 3 index SQL.
- `npm run typecheck`
- `npm run build` (Next.js 16.2.11). Routes include `/ingredients`, `/api/v1/ingredients/scan`, `/api/v1/ingredients/scans/[id]`, `/api/v1/ingredients/analyze`, and `/api/v1/ingredients/[inci]`.
- `npm run prisma:validate` with `DATABASE_URL` set to a local placeholder. The schema was not given a new unique field. The partial index stays in SQL.
- `node scripts/bundle-migrate.mjs`. `migrate.cjs` contains `ingredient_scans_user_idempotency_idx`. esbuild still warns that `import.meta` is empty in the CommonJS bundle. The SQL is inlined, so that branch is unused.
- The production trace copied `data/ingredients/catalog.yaml` and `data/rules/v1/pack.yaml` into `.next/standalone/data`.
- `services/ml` venv: `ruff check` and `pytest` (23 tests, 8 of them OCR). Route tests stub `recognize`. They do not run the tesseract binary.
- `pytest services/ml` from the repo root passed the same 23 tests.

## What did not run

- `db/phase3.sql` was not applied to a Postgres server. Neither was phase 2. An ingredient insert fails until migrate has run against a real database.
- Docker is not installed here. The image was not built, so the apt install of Tesseract was not executed.
- `tesseract` is not on this machine's `PATH`. No bottle photo was read. OCR accuracy is not measured. Fuzzy distances and irritancy ranks are unvalidated defaults.
- `zerops.yaml` still has no `ML_SERVICE_URL`. A deploy of this branch fails label photos and face photos closed until that service is set. A typed ingredient list still runs, because it never calls FastAPI.
- `after()` was not observed on Zerops. If the platform drops it, a photo row stays `queued` and the page stops polling after 60 seconds. A typed list does not depend on `after()`.
- The legacy Flask scanner on `main` was not merged. `main` is a different app.

## Not in this phase

Product recommendations, prices, Jaccard alternatives, RAG chat, recovery routines, accounts, and progress or export screens.
