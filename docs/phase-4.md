# RiRu Phase 4

Build a short routine from the latest succeeded face scan and the profile. Attach example products from a YAML catalog. Store a price only when the caller pastes one.

Every routine payload includes: "Informational only, not a medical diagnosis."

This is not a diagnosis, not a dose, and not a shop. Example formulas were written for this catalog. Their source note says they were not copied from a retailer label. Similarity is the overlap of ingredient names. It is not a measured match.

## What works

- `POST /api/v1/recommendations` reads the caller's profile, the routine pack in `data/routines/v1/pack.yaml`, and the example products in `data/products/catalog.yaml`. `disclaimerAck` must be JSON `true`. The response is 201 and the body is a `Routine`.
- Omit `scanId` and the route uses the latest face scan. That scan must be `succeeded`. A newer rejected photo is not skipped in favor of an older success. The code is `NO_SUCCEEDED_SCAN`. A `scanId` that is not a uuid, or that is not the caller's, is 404. A scan that exists and did not succeed is 409.
- `analysis_kind` `heuristic_v0` does not personalize. Sample concerns are ignored. The summary says the saved scan is a sample score, not a measurement.
- Other succeeded scans use `scan_findings` when those rows exist, and the `concerns` JSON otherwise. Severity accepts `mild` / `Mild` and the same for moderate, severe, and none.
- A severe finding keeps the step, sets `product` to null, and sets `caution` to "See a dermatologist if this worries you. This app cannot assess skin cancer." Cleanser, moisturizer, and sunscreen steps can still carry an example. The same sentence is appended to the summary.
- Filters drop a product for an allergy, fragrance when the profile is fragrance-sensitive, pregnancy, an active recovery note, or irritancy of 4 or more when the profile says sensitive. Pregnancy leaves out retinol, retinyl palmitate, salicylic acid, and benzoyl peroxide. Recovery also leaves out glycolic acid, lactic acid, and azelaic acid. Azelaic acid is in that list as a conservative filter because it is an acid. That is not a clinical claim. The app does not compute a dose. `clinician_note` is not copied into the API.
- When a recovery row is active, `recoveryActive` is true and `clinicianOverridesApp` tells the caller to follow the clinician. There is no recovery screen in this phase.
- The caller's budget tier is tried first (`low`, `mid`, or `high`). If nothing in that tier passes, another tier is used and `why` says so. `any` uses the whole eligible pool. Other tiers on a step are up to two examples, one per remaining tier. Nothing is ordered by a sponsor.
- `GET /api/v1/recommendations/{id}` is owner-only. The routine table has no payload column, so this response keeps the stored step text and summary, then rebuilds `product.why` as a shorter catalog sentence and recomputes the other budget tiers from the live YAML. The create response is the in-memory build, including the overlap sentence from that request. Those two `why` strings are not forced to match.
- `GET /api/v1/products/search` filters by `q`, `stepKind`, and `budget`. `q` matches name, brand, slug, and INCI. `product.why` is empty. The limit is 50.
- `GET /api/v1/products/{id}/alternatives` returns `method: jaccard_v1` and at most eight examples in the same step. Hard filters match the routine. `jaccard_embedding_v1` is named in the contract and is not implemented. The catalog is small, so there is no embedding model.
- `POST /api/v1/products/{id}/prices` stores `provider: manual` for that caller. `priceCents` is a whole number from 0 through 2000000000. Currency is three letters. The link must be `http` or `https`. The server does not request the URL. `GET` returns only that caller's rows, newest first, at most 50. A missing catalog id is 404. Both methods require a session.
- YAML stays the catalog. Inside the same transaction as a routine or a price, the writer upserts the referenced `ingredients`, `products`, and `product_ingredients` rows so the foreign keys can point at them. The ingredient conflict check still reads YAML. `ingredient_rules` are not copied into SQL. There is no `db/phase4.sql`. Phase 1 tables are enough. `migrate.js` is unchanged.
- The routine page keeps the old check-off list from `GET /api/dashboard`. Above it, "Build from latest scan" calls the new route. Other budget tiers are on the step. Similar examples and a pasted price load when you ask. The nav is unchanged. `POST /api/scans` still writes the heuristic and does not read the photo.
- The standalone trace includes `data/products`, `data/routines`, and `data/ingredients` for the new routes. The loader also checks `process.cwd()/data`.
- Recommendations do not call FastAPI and do not increment the streak. No new rate limit was added.

## How to run

From the repo root, with Postgres already migrated through phase 1 (phase 2 and phase 3 indexes are not required for this slice):

```powershell
npm ci
$env:DEMO_MODE = "true"
npm run dev
```

Open `/routine`. Confirm the notice, then build from the latest succeeded scan. A typed ingredient check and this list both run when the ML service is down.

Pasting a price or saving a routine returns an error until `migrate.js` has been applied to a reachable database. `DEMO_MODE=false` also needs `SESSION_SECRET` of at least 16 characters.

## Checks that ran

On 2026-10-12, from this checkout:

- `npm test` (33 tests). The recommendation file loads the real YAML and checks overlap, the sample-score scan, allergy, fragrance, pregnancy, recovery, retinol plus the skipped weekly acid, a severe finding with no product, other budget tiers, search, a non-web price link, and that the price store and the price route do not call `fetch(`.
- `npm run typecheck`
- `npm run build` (Next.js 16.2.11). Routes include `/api/v1/recommendations`, `/api/v1/recommendations/[id]`, `/api/v1/products/search`, `/api/v1/products/[id]/prices`, and `/api/v1/products/[id]/alternatives`. `search` is its own route.
- `npm run prisma:validate` with `DATABASE_URL` set to a local placeholder. No new unique field. No phase 4 SQL file.
- The production trace copied `data/products/catalog.yaml`, `data/routines/v1/pack.yaml`, and `data/ingredients/catalog.yaml` into `.next/standalone/data`.
- With `DEMO_MODE=true`, `GET /routine` returned the build button, the check-off heading, the disclaimer line, and "Reset checks". `GET /` included the home-card line about building a list from the latest scan. `GET /api/v1/products/search?q=ceramide&stepKind=moisturizer` returned Example Ceramide Cream with an empty `why`. A missing disclaimer and a `javascript:` price link returned 400. A non-uuid product id and a non-uuid routine id returned 404.
- `POST /api/v1/recommendations` with `disclaimerAck: true` returned 500 `ROUTINE_FAILED`. The log line was `ECONNREFUSED` and did not include a pasted link. Postgres is not running here, so no routine row and no price row were written.

## What did not run

- Phase 1, phase 2, and phase 3 SQL were not applied to a Postgres server. This phase adds no SQL file. A routine insert and a price insert were not executed against a database.
- Docker is not installed here. The image was not built.
- No retailer page was requested. No price was invented. Jaccard was not measured against a labeled set. It is name overlap only.
- A browser click-through was not done. There is no browser tool in this session. Without `DEMO_MODE`, the HTML is the session gate until a cookie exists, and creating a session also failed with no database.
- `zerops.yaml` still has no `ML_SERVICE_URL`. This phase does not need that service. Face photos and label photos on that deploy still fail closed.
- The legacy Flask scanner on `main` was not merged. `main` is a different app.

## Not in this phase

Grounded chat, embeddings, an official price provider, the recovery screen, progress, and export or delete.
