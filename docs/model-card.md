# Model card — RiRu skin analysis

Status: no trained skin model is in this repository. `heuristic_v0` remains a labeled sample score on `POST /api/scans`. `baseline_cv_v1` is the photo path. Phase 7 does not add an `analysis_kind`. No accuracy number is known. Do not fill the metric tables with estimates.

## Decision in Phase 7

A new classifier was not adopted. The datasets that could support a Fitzpatrick I–VI split are still blocked (table below). Shipping a weight file without that split would look like an evaluation that did not happen.

The photo path stays `baseline_cv_v1`: MediaPipe Face Landmarker for the face, then unvalidated color and texture rules. `heuristic_v0` is not used when that service is missing. A missing service fails the row. The sample scorer stays on the legacy route and is labeled in history.

A later model needs all of the following before its id is allowed in `analysis_kind`:

- A dataset row in the table below with a license URL we can use for training and for publishing metrics.
- A frozen split, including a group label that is actually in that dataset. A self-described tone on the profile is not a Fitzpatrick label.
- Precision, recall, F1, and n for each concern we show, and the same for each group that the dataset labels. Empty cells stay empty.
- The current confidence cap and the poor-photo rejection stay in front of that model until those cells are filled.

## heuristic_v0 (legacy route only)

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
| | Fitzpatrick I–VI | not measured | not measured | not measured | 0 | No licensed labeled set. Not estimated. |
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

## Embeddings

| Field | Value |
|---|---|
| Model | `sentence-transformers/all-MiniLM-L6-v2` when `EMBEDDINGS_PROVIDER=local` |
| Dimensions | 384 |
| License | Apache-2.0 |
| What ran here | `EMBEDDINGS_PROVIDER=mock` only. Sentence-transformers was not installed. The local model was not executed. |
| Index | pgvector HNSW if the extension loads. This Postgres build has no `vector` extension, so rows use `embedding_fallback`. |

## LLM

Chat uses `LlmProvider`. `DEMO_MODE=true` forces the mock. Anthropic and Ollama are implemented. Answers cite note or rule ids. Low retrieval confidence says it is not sure. A changing mole or a dose request is refused before the model. The live Anthropic call was not run.
