# RiRu Phase 6

Progress is the scan timeline, a before-and-after pair, and concern labels over time. Recovery mode can be turned on after a procedure. Export and delete cover this account.

Every progress and recovery payload includes: "Informational only, not a medical diagnosis."

Sample scores (`heuristic_v0`) are labeled as samples. A change in those numbers is not a clinical change. Concern labels are estimates from the saved scan, not a diagnosis.

## What works

- `GET /api/v1/progress` lists succeeded scans (up to 100), the earliest and latest of those, concern trends, and the last 30 check-ins. Failed scans stay in the older history list and are left out of before-and-after.
- Concern direction is lower, higher, or same from the first saved severity to the latest. `heuristic_v0` points are marked as samples. A `baseline_cv_v1` point is marked measured. A sample-score delta is returned only when both ends are sample scores with numbers.
- `POST /api/v1/check-ins` stores one optional note per account per calendar day. `completedStepIds` is at most 40 uuids. A `routineId` must belong to the caller.
- `POST /api/v1/profile/recovery-mode` turns a laser, peel, microneedling, or other note on or off. The clinician note is stored and is not in the JSON response. `GET` returns the same public shape. The routine page shows the recovery message from `data/routines/v1/pack.yaml` and clears the note field after save.
- `GET /api/v1/me/export` downloads JSON for this account, including the active clinician note and chat. Photo bytes are not included. `DELETE /api/v1/me/data` needs an `Idempotency-Key`. The same key returns the same receipt. A guest account row is removed. The shared demo account row is kept and its scans, chat, routines, and notes are cleared. Image objects are deleted when storage has a ref.
- `PUT /api/v1/privacy/image-retention` sets `profiles.delete_image_after_analysis` and appends a `delete_image_after` consent row. The default is on. After a face or label analysis finishes, a stored photo is deleted when that flag is on.
- `POST /api/v1/consent` appends a consent row. History shows the progress and privacy panels. The routine page shows the recovery card.
- `db/phase6.sql` adds the image flag and the new consent purpose. `migrate.js` runs it after phase 5.

## How to run

From the repo root, after `npm run migrate`:

```powershell
$env:DEMO_MODE = "true"
npm run dev
```

Open `/history` for progress, a check-in, export, and the photo toggle. Open `/routine` for recovery mode. Leave the delete button unused on the shared demo account unless you mean to clear it.

## Checks

Run on 2026-10-13 against the local Postgres 16 cluster:

- `npm run migrate` finished through phase 6. `Extension vector is not available` is unchanged.
- `npm test` with `RIRU_INTEGRATION=1`: 45 passed, 1 skipped, 0 failed. The skip is the optional Anthropic call. `tests/privacy-db.integration.test.ts` stored a clinician note, asserted the public recovery object omitted it, exported it, discarded a face image ref, then deleted a throwaway guest and replayed the receipt.
- `npm run typecheck` exited 0. `npm run prisma:validate` reported the schema valid. `npm run build` exited 0.
- Browser on `http://localhost:3000/history`: before-and-after labeled sample scores, concern lines for pores, dryness, and spots, and a check-in dated 2026-10-13. The photo toggle started checked. On `/routine`, saving a clinician note showed the recovery message and the note text was not on the page afterward. Recovery was then turned off. The delete button was not used. A hydration warning still points at `components/AppShell.tsx` line 40.

## What this phase does not do

- The shared demo account is one row. Delete clears that row's data and keeps the user so `DEMO_MODE` still signs in.
- No photo file was stored in this run, so the discard path cleared a database ref against the `none` storage adapter.
- Export was covered by the database test. The browser download button was not clicked.
- Phase 7 (a real skin model) was not started.
