# Model card — RiRu skin analysis

Status: heuristic_v0 still exists for the legacy scan route. baseline_cv_v1 runs when the scan screen can reach the ML service.

No trained skin model is in this repository. No accuracy number is known. Do not fill the metric tables with estimates.

## heuristic_v0 (running in production)

| Field | Value |
|---|---|
| Name | `heuristic_v0` |
| Code | `lib/scan-engine.ts`, called by `POST /api/scans` |
| What it does | Jitters previous scores by a few points and returns canned concerns and ingredient suggestions. |
| Inputs used | The previous row's metric scores, if any. The camera frame is not read. |
| Training data | None. |
| Metrics | Not measured. Not meaningful to measure. It does not look at skin. |
| Intended use | Legacy route `POST /api/scans` only. The scan screen no longer calls it. |
| Out of scope | Any decision about health, products, or procedures. |
| Known failure | Every output is disconnected from the photo. |

The home page labels these older rows as sample estimates.

## baseline_cv_v1 (implemented, not measured)

| Field | Value |
|---|---|
| Name | `baseline_cv_v1` |
| Code | `services/ml/app/face_analysis.py`, called from `POST /internal/v1/face-scans` |
| Face detector | MediaPipe Face Landmarker, Apache-2.0. Pinned file `face_landmarker.task` float16 revision 1. URL is in `services/ml/app/detector.py`. The service does not download it. The Docker image downloads that URL at build time. |
| Asset hash | SHA-256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` (3,758,596 bytes), downloaded from the pinned URL on 2026-10-12. The file is gitignored. |
| Skin model | None. Geometric face oval plus classical features (Lab a*, highlight ratio, Laplacian variance, local contrast). |
| Thresholds | Unvalidated engineering defaults in `face_analysis.py`. They were not fit on a labeled dataset. |
| Confidence policy | Hard cap at 0.55. Quality-gate failure returns no findings and no score. |
| Acne | Always severity `none`. Redness is not reported as acne. |
| Training data | None. |
| Evaluation data | None approved. See the dataset table below. |
| Metrics | Not measured. |
| Intended use | A rough visual estimate: capture, reject a bad photo, explain a few observations. |
| Not intended | Diagnosis, triage, skin-cancer screening, Fitzpatrick typing, dehydration measurement, or proof that a product works. |
| Factors that break it | Low light, strong color cast, makeup, facial hair, occlusion, dermatological dressings, fresh wounds, very close or very far framing, compression artifacts. Performance across tones is unmeasured and is expected to move the redness and spot features. |
| Escalation | `severe` adds "See a dermatologist if this worries you. This app cannot assess skin cancer." The model has no class for cancer or infection. |

### Dataset gate

| Dataset | Decision | Date |
|---|---|---|
| ACNE04 | Blocked. License not verified. | 2026-10-12 |
| Fitzpatrick17k | Blocked. Source licenses mixed and not cleared. | 2026-10-12 |
| SD-198 | Blocked. License not verified. | 2026-10-12 |
| DermNet | Blocked. Not an open training set. | 2026-10-12 |

A future fine-tune adds a row here with the license URL, the split, and real metrics before the model id is allowed in `analysis_kind`.

### Metric table (leave blank until a real eval)

Concern rows: acne, blackheads_pores, pigmentation, redness, dark_circles, texture, fine_lines, dehydration.

Group rows: only groups that exist as labels in a dataset we are allowed to use. Self-described tone from the profile is not a ground-truth Fitzpatrick label.

| Concern | Group | Precision | Recall | F1 | n | Notes |
|---|---|---|---|---|---|---|
| | | not measured | not measured | not measured | 0 | |

## OCR (implemented, not measured)

| Field | Value |
|---|---|
| Default | Tesseract `eng` via `tesseract stdin stdout -l eng --psm 6`. Apache-2.0. The photo is not written to disk. |
| Preprocess | Pillow only: grayscale, autocontrast, scale the short edge up and cap the long edge. Deskew is not implemented. OpenCV is not imported. |
| Optional | `OCR_PROVIDER=paddle` returns 503 `OCR_PROVIDER_UNSUPPORTED`. PaddleOCR is not installed. |
| Missing binary | 503 `OCR_UNAVAILABLE`. The app does not invent text. Fewer than 3 letters is `rejected_quality` with an empty string. |
| Accuracy | Not measured. |
| Human check | The user confirms text before the verdict. Unparsed names block `good_fit`. A close spelling can still be `good_fit`, and the screen shows that spelling. |

## Embeddings (planned)

| Field | Value |
|---|---|
| Model | `sentence-transformers/all-MiniLM-L6-v2` |
| Dimensions | 384 |
| License | Apache-2.0 |
| Index | pgvector HNSW if the extension loads, otherwise brute-force cosine over `double precision[]` |
| Eval | Not run. Phase 5 should check that a handful of held-out questions retrieve the intended heading. That is a smoke test, not a retrieval benchmark. |

## LLM

The chatbot is not a model we train. The provider is whatever `LLM_PROVIDER` selects (`rules`, `ollama`, or `xai`). The rules provider is a template in `lib/chat-engine.ts` today. It has no retrieval. Phase 5 grounds the providers in `knowledge_chunks` and still refuses when the retrieval score is low.
