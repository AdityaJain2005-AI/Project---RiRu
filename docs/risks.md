# RiRu risks

Phase 0. These are open. Phase 1 does not close the product risks. It must avoid making the deploy risk worse.

## Product and science

| Risk | Why it matters | What we do |
|---|---|---|
| The live scan is random jitter around old scores | A visitor can believe it measured their skin | Keep it only on the legacy route. Label `heuristic_v0` as a sample. Phase 2 must not present `baseline_cv_v1` as clinical either. Confidence cap 0.55. |
| Classical CV will be wrong on dark skin, makeup, beard, glasses, and warm bulbs | Redness and spots measured in RGB or Lab shift with tone and light | Quality gate rejects bad light. Copy says the score is a rough visual estimate. Phase 7 reports per-tone metrics only if we have a licensed labeled set. Until then the report says "not measured". |
| Dehydration, sensitivity, and "skin type" are not things a photo reliably shows | Overconfident labels cause bad routines | Dehydration confidence stays very low. Sensitive comes from the profile. Skin type from shine ratio is a heuristic with the same cap. |
| A spot detector can look like a cancer checker | Harm if someone skips a dermatologist, or panics | No benign/malignant class. Severe or odd findings get escalation copy only: see a dermatologist. The app cannot assess skin cancer. |
| Pregnancy rules can be read as medical clearance | Missing an ingredient is dangerous | Verdict `avoid` means "do not rely on this app; ask your clinician". Unknown INCI never produces `good_fit`. |
| Vitamin C + niacinamide folklore | A blunt rule blocks a combination many people tolerate | Encoded as `kind: nuance` with an honest message. The LLM is not allowed to replace that message. |
| RAG will still hallucinate | Citations do not guarantee the sentence followed them | Low retrieval score returns "I'm not sure". A response checker strips dosing and diagnosis phrasing. |
| Prompt injection via a photographed label | OCR text can contain instructions | OCR is stored as data and wrapped as untrusted. The checker does not trust the model's refusal alone. |
| Shared demo user | Every visitor currently reads and writes Maya Chen's scans and chat | Phase 1 splits guests. This is a live behavior change. |
| Guilt-heavy streaks | The current `streak_days` increments on every scan, including retries | Progress phase treats check-ins as optional. A missed day writes nothing. |
| Bias evaluation with no data | Pressure to publish a fairness table | Refuse to fill numbers we did not measure. |

## Licenses we have not verified

Do not download these into the repo, and do not train, until someone writes the license result into `docs/model-card.md`.

| Item | Status |
|---|---|
| MediaPipe Face Landmarker | Apache-2.0. Acceptable. Confirm the exact model asset's license when the file is pinned. |
| Tesseract | Apache-2.0. Acceptable. |
| PaddleOCR | Apache-2.0. Acceptable as an optional engine. Model-asset license still checked at pin time. |
| `all-MiniLM-L6-v2` | Apache-2.0 weights via sentence-transformers. Acceptable. |
| ACNE04, SD-198, Fitzpatrick17k | Not verified. Not approved. |
| DermNet | Treat as not licensed for this project. |
| Retailer product photos and descriptions | Do not bulk-copy a retailer's catalog. Seed products are name, brand, and INCI lists we have a right to store. Phase 4's seed must record the source of each INCI list. If the source is unclear, the product does not ship. |
| xAI API | Optional. Paid. Terms are the caller's responsibility. The free path does not need it. |

## Law and privacy

This is not legal advice.

| Risk | Response in the design |
|---|---|
| Face images are biometric-adjacent | Default is do not store. Consent is separate for camera, storage, and training. Training opt-in does nothing until a job exists, and that job must check the flag. |
| GDPR / DPDP purpose limitation | Profile fields are the ones the routine needs. No birthdate. No precise location. |
| Children | Under 18 stays on guest mode. No email account in the MVP. Idle guest deletion at 30 days. |
| Delete that fails halfway | Delete storage keys first, then the user row inside one transaction for the SQL. Receipt is written only after the SQL commit. A retried delete on an already-gone user returns 200 with the same receipt id if the client sends the same `Idempotency-Key`. |
| Shared networks and guest rate limits | IP caps will block some campuses and mobile NATs. The cap is a backstop. Document it in the Phase 1 summary if it ships. |
| Scraping prices | Not implemented. Manual links only, until an official API has a written terms note. |

## Engineering and deploy

| Risk | Response |
|---|---|
| Moving the app to `apps/web` breaks Zerops | Web stays at the repo root. |
| Prisma migrate fights `migrate.js` | One entrypoint. `migrate.js` launches the Prisma migration. Hand-written SQL in `migrate.js` is not extended with a second style after Phase 1 except for the extension probe. |
| `CREATE EXTENSION vector` fails on Zerops | Catch it, set `schema_flags.vector_available = false`, use `double precision[]` and in-process cosine. Revisit if the knowledge base grows past a few hundred chunks. |
| Two ORMs drift | Prisma owns DDL. SQLAlchemy does not create tables. CI compares shared JSON schemas. |
| ML image is too big for the free container | Tesseract and MediaPipe first. PaddleOCR and OpenCV are optional. |
| Heuristic fallback hides outages | v1 routes fail closed with `ML_UNAVAILABLE`. |
| Existing `GET /` readiness | Do not tie the Zerops health check to Postgres or to FastAPI. `GET /api/health` can report degraded. The balancer should keep using `GET /`. |
| `chat_messages` role check | Phase 1 widens it. Old rows stay `ai`. New v1 rows use `assistant`. Both are valid. |
| Unique index on `(user_id, idempotency_key)` in Prisma | The SQL unique index is partial (`WHERE idempotency_key IS NOT NULL`). Prisma's `@@unique` is not partial. Phase 1 must keep the partial index in raw SQL and must not let `prisma migrate` replace it with a full unique constraint, or every legacy scan with a null key will collide. The Prisma `@@unique` in `docs/schema.prisma` is a reminder of the key, and the migration SQL wins. |
| Container disk used as a photo store | Forbidden by the storage interface when `STORAGE_PROVIDER=none`. |
| No automated tests today | Phase 1 adds CI that at least typechecks the web app and boots the ML health route. Feature tests arrive with the feature phases. Playwright for scan, results, and routine is Phase 7, with an earlier smoke test in Phase 2 if the scan UI lands. |
| Windows local dev | The working copy is on Windows. Python tooling in `services/ml` must run under Docker so contributors are not required to build MediaPipe natively on Windows. |
| Branch split | Working copy is on `frontend` at `ad9ac16`. `main` is four commits ahead (`e962be7` through `b1fcfc1`: README, upload, scanner, check). Phase 1 should start from an explicit branch choice. Default recommendation: branch `riru-phase-1` from current `frontend`, and inspect `main` before merging so those four commits are not dropped. This phase did not merge them. |

## Trade-offs explicitly accepted

- Zerops Postgres instead of a required Supabase project. Supabase remains a storage adapter.
- Guest cookie auth instead of required Supabase Auth. Accounts stay optional.
- Jaccard over a small catalog instead of vector product search, until the catalog is large. API field `method` records which one ran.
- Rules engine in TypeScript instead of asking the LLM to invent a routine.
- No Redis. Job state is a Postgres table.
- MIT, already in `package.json`, instead of adding Apache-2.0.

## Rejected for the MVP

- Scraping e-commerce HTML.
- A single shared demo account for all visitors.
- Storing every scan photo.
- Reporting fabricated model accuracy.
- Letting the chatbot prescribe or dose.
- A second migration tool inside FastAPI.
- Rewriting the existing UI before the service behind it exists.
