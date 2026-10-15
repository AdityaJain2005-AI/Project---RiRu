# RiRu project report

Short note for the VIT proposal. It describes the build that exists in this repository.

## What it is

RiRu is a free informational skincare web app for students. It is not a diagnosis. The same disclaimer is on the ingredient verdict, the scan warnings, and the chat reply.

## What shipped

- Next.js 16 is the only public API. A FastAPI worker reads a face photo with MediaPipe Face Landmarker and Lab/Laplacian rules (`baseline_cv_v1`). Confidence is capped at 0.55. Acne is always reported as none. If the worker is down, the scan fails. No score is invented.
- `heuristic_v0` is the older sample score on `POST /api/scans`. It does not read the photo.
- Typed ingredient lists are matched against the catalog. A gold set of nine strings covers exact names, aliases, and one misspelling. Label photos need Tesseract. That binary is not installed on the development machine, so photographed-label accuracy was not measured.
- Routines use example formulas. A price is stored only when the user pastes it.
- Chat retrieves short excerpts from `data/knowledge/v1/pack.yaml`. Ranking is a JavaScript mix of cosine similarity and keyword overlap. Embeddings are stored in `embedding_fallback` because PostgreSQL here has no `vector` extension.
- Progress, check-ins, recovery mode, export, and delete exist. The clinician note is omitted from the public recovery API and from the model prompt.

## What was not done

- No trained skin model. ACNE04, Fitzpatrick17k, SD-198, and DermNet were not used. Fitzpatrick I–VI remains unmeasured (`n = 0`).
- No PaddleOCR. No Lighthouse score. No penetration test. No WCAG certification.
- Hindi and Tamil are reserved locale codes. The copy is English.

## How to judge it

Run `npm test`, `npm run typecheck`, `npm run prisma:validate`, and `npm run build`. Read `docs/phase-5.md` through `docs/phase-9.md` for the checks that were actually run.
