# RiRu Phase 7

The photo path stays `baseline_cv_v1`. `heuristic_v0` stays a labeled sample score on the legacy route. No new skin model was added, and no Fitzpatrick metric was computed.

Every scan payload still includes: "Informational only, not a medical diagnosis."

## What works

- `docs/model-card.md` records the Phase 7 decision: do not add an `analysis_kind` until a dataset license, a frozen split, and real per-concern and per-group metrics exist. The metric table still says not measured, including a Fitzpatrick I–VI row with n = 0.
- ACNE04, Fitzpatrick17k, SD-198, and DermNet stay blocked. No weight file was downloaded.
- `heuristic_v0` is not a fallback when the ML service is missing. That row fails. History labels a succeeded `heuristic_v0` row as a sample score that did not read the photo.
- A rejected photo returns a retake warning. A succeeded `baseline_cv_v1` result returns a low-confidence warning because confidence is capped at 0.55 and tone groups were not measured. A failed row says no score was invented.
- Those strings are `scanWarnings` in `lib/scan-warnings.ts`. `GET /api/v1/scans/{id}` includes them. The scan screen shows them. History shows them for the selected row.

## How to run

```powershell
npm test
npm run dev
```

Open `/history` and select a sample-score row. The amber line says the photo was not read. A failed row says the analysis did not finish.

The ML service is unchanged. Start it only if you want a live `baseline_cv_v1` photo. Docker was not required for this phase.

## Checks

Run on 2026-10-13:

- `npm test` with `RIRU_INTEGRATION=1`: 49 passed, 1 skipped, 0 failed. The skip is the optional Anthropic call. The four new tests cover a rejected photo, a capped baseline estimate, a sample score, and a failed analysis.
- `npm run typecheck` exited 0. `npm run prisma:validate` reported the schema valid.
- Browser on `http://localhost:3000/history`: the newest failed row showed "The analysis did not finish. No score was invented." Selecting the sample-score row showed "This row is a sample score. The photo was not read." A hydration warning still points at `components/AppShell.tsx` line 40.
- `npm run build` exited 0.

## What this phase does not do

- No person photo was scored by a new model.
- No precision, recall, or F1 was calculated for any concern or for Fitzpatrick I–VI.
- `baseline_cv_v1` thresholds were not refit.
- Phase 8 was not started.
