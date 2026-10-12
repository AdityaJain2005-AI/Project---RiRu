# RiRu Phase 2

The scan screen sends the photo. A baseline visual estimate reads it. Bad photos are rejected. Nothing in this phase is a measurement or a diagnosis.

`react-webcam` was not added. The existing `getUserMedia` path in `components/ScanFlow.tsx` is enough.

## What works

- `POST /api/v1/scans` accepts one JPEG, PNG, or WebP (magic bytes, 8 MB). `disclaimerAck` must be the string `true`. The response is 202 with a scan id.
- The same `Idempotency-Key` and user return the original scan and do not spend another daily face-scan slot. The face-scan limit stays 8 per day outside demo mode.
- Next.js inserts a `queued` row with `overall_score` NULL, then `after()` calls FastAPI. FastAPI does not open Postgres. If `ML_SERVICE_URL` or `ML_SERVICE_TOKEN` is missing, the row becomes `failed` with code `ML_UNAVAILABLE`. The heuristic scorer is not used as a fallback.
- `POST /internal/v1/face-scans` checks the bearer token, decodes the image, and runs MediaPipe Face Landmarker plus `baseline_cv_v1`. A missing `face_landmarker.task` file returns HTTP 503 `MODEL_UNAVAILABLE`. Landmarks are not invented. A quality rejection is HTTP 200 with `status: rejected_quality` and no findings.
- Quality reasons: `no_face`, `multiple_faces`, `too_dark`, `too_bright`, `blurry`, `off_center`, `face_too_small`, `clipped`. The browser luminance and blur hint says the server decides.
- A success stores eight concerns. Acne is always `none`. Confidence is capped at 0.55. There is no 0–100 score. Region boxes are full-image coordinates from 0 to 1 with `space: "image"`.
- Severe findings add: "See a dermatologist if this worries you. This app cannot assess skin cancer."
- The photo is not written to disk. `storeImage=true` stores a copy only when the Phase 1 storage adapter accepts it. Otherwise the scan still finishes and `imageStored` is false.
- The scan screen polls `GET /api/v1/scans/{id}` for up to 60 seconds, draws finding boxes on the browser-held preview, and shows the skin-type guess, explanations, disclaimer, and escalation.
- Home, dashboard, chat, and plan read the latest row with `status = 'succeeded'` only. History still lists rejected scans. A null score renders as "—", not 0.
- Chat, when the latest succeeded scan has no metrics, replies with that summary and the disclaimer. It does not fill 78, 72, 81, or 63.
- The lab "Quick rescan" and photo buttons no longer call `POST /api/scans`. They link to `/scan`.
- `db/phase2.sql` drops `NOT NULL` on `skin_scans.overall_score`. `migrate.js` runs it after phase 1, and `scripts/bundle-migrate.mjs` inlines it as `__PHASE2_SQL__`.

`POST /api/scans` still writes `heuristic_v0` for older callers. The unused `FacelabSkinDiagnosticDashboard.tsx` still calls it and was left alone.

## How to run

From the repo root, with Postgres already migrated through phase 2:

```powershell
npm ci
npm run dev
```

ML service, from `services/ml`, after the task file is at `models/face_landmarker.task` or `FACE_LANDMARKER_MODEL` points at it:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
$env:ML_SERVICE_TOKEN = "dev-token"
$env:FACE_LANDMARKER_MODEL = "models/face_landmarker.task"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Point the web process at it with `ML_SERVICE_URL=http://127.0.0.1:8000` and the same `ML_SERVICE_TOKEN`. `DEMO_MODE=false` needs `SESSION_SECRET` of at least 16 characters.

Docker Compose is the full local stack (`postgres`, `ml`, `web`). The ML image downloads the pinned task file at build time. Docker is not installed on the machine used for this phase, so Compose was not run.

## Checks that ran

On 2026-10-12, from this checkout:

- `npm run typecheck`
- `npm test` (14 tests, including magic bytes and the analysis JSON contract)
- `npm run build` (Next.js 16.2.11, including `/api/v1/scans`)
- `npm run prisma:validate` with `DATABASE_URL` set to a local placeholder
- `services/ml` venv: `ruff check` and `pytest` (15 tests). The route tests stub the detector. The analyzer tests use a synthetic landmark array, not a photograph.
- `pytest services/ml` from the repo root uses `services/ml/pytest.ini`.
- MediaPipe 0.10.21 imports `FaceLandmarker` on this Windows CPython 3.10 venv.
- The pinned task file was downloaded (3,758,596 bytes, SHA-256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`). It is gitignored. Loaded against a flat color image, it returned no face, and the analyzer rejected that image with `no_face`.

## What did not run

- `db/phase2.sql` was not applied to a Postgres server. A queued scan insert fails until that `DROP NOT NULL` has run.
- Docker Compose was not started.
- No photograph of a person was analyzed. Thresholds in `face_analysis.py` are unvalidated engineering defaults. Metrics are not measured. See `docs/model-card.md`.
- `zerops.yaml` still has no ML service. A deploy of this branch makes the scan screen fail closed (`ML_UNAVAILABLE`) until `ML_SERVICE_URL` and `ML_SERVICE_TOKEN` are set. It does not go back to sample scores.
- `after()` is part of Next.js 16.2.11 and the production build compiled. It was not observed inside a Zerops Node process. If the platform drops `after()`, the row stays `queued` and the client stops polling after 60 seconds. No score is filled in.

## Not in this phase

Ingredient OCR, recommendations, prices, RAG chat, recovery mode, accounts, and S3 are unchanged.
