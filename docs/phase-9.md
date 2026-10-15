# RiRu Phase 9

Hardening and the project write-up. This is not a penetration test, not a WCAG certification, and not a Lighthouse score.

## What works

- Upload limit stays 8 MB in `lib/image-bytes.ts`. Rate limits stay in place and are skipped when `DEMO_MODE=true`: face scan 8/day, ingredient scan 20/day, chat 30/hour, export 10/hour, delete 5/hour.
- Production responses send a content-security header. It allows `'unsafe-inline'` because Next.js hydration scripts are inline. `next dev` does not send that header, so hot reload still connects. `frame-ancestors 'none'` matches the existing `X-Frame-Options: DENY`.
- The shell has a “Skip to content” link, `id="main"` on the main region, and labels on the desktop and mobile navs. `html lang` stays `en`.
- `lib/i18n.ts` accepts `en`, `hi`, and `ta`. Hindi and Tamil return the English copy with `translated: false`. No Hindi or Tamil strings were written.
- CI runs `npm run build` after the unit tests. Integration tests stay skipped there because CI does not start Postgres. A Playwright job installs Chromium and runs `e2e/shell.spec.ts`.
- `LICENSE` is MIT, matching `package.json`. `CONTRIBUTING.md`, `docs/deployment.md`, `docs/privacy-policy.md` (a template), and `docs/project-report.md` describe the build that exists.

## Dependency audit

`npm audit` on 2026-10-13 reported 15 advisories: 0 info, 0 low, 2 moderate, 12 high, 1 critical.

The critical advisory is Next.js, range through 16.3.7: unauthenticated remote code execution on Windows-hosted servers, and remote code execution in the image optimization API when AVIF files are used. This app is on Next.js 16.2.11. `npm view` listed 16.4.0 as current, and `npm install next@16.4.0` was refused: no matching version with a date before 2026-06-10. The upgrade was not forced.

High advisories that were left in place: `@prisma/config` / `deepmerge-ts`, `braces` (via `chokidar`, `micromatch`, `fast-glob`, `tailwindcss`), `nanoid`, `postcss`, `sharp`, and `source-map-js`. `npm audit fix` was not run.

## How to run

```powershell
npm test
npm run typecheck
npm run prisma:validate
npm run build
npm run test:e2e
```

`test:e2e` needs Chromium (`npx playwright install chromium`) and reuses a server already on port 3000.

After `npm run build`, delete `.next` before the next `npm run dev`.

## Checks

Run on 2026-10-13:

- `npm test` with `RIRU_INTEGRATION=1`: 53 passed, 1 skipped, 0 failed. The skip is the optional Anthropic call. The new tests are the English, Hindi, and Tamil locale cases.
- `npm run typecheck` exited 0. `npm run prisma:validate` reported the schema valid.
- `npm run build` exited 0 (Next.js 16.2.11).
- `npx playwright test`: 1 passed. Home has the skip link and `#main`. `/ingredients` shows “Informational only, not a medical diagnosis.”
- `next start` on port 3001 returned the content-security header above, including `script-src 'self' 'unsafe-inline'`. The HTML included `href="#main"` and the skip link. That server was stopped. `.next` was deleted and `npm run dev` was started again. A following `HEAD` to `http://localhost:3000/` was 200 and did not send `Content-Security-Policy`.
- Browser on `http://localhost:3000/`: the skip link is in the accessibility tree. Focusing it and activating it set the URL hash to `#main` and moved focus to the main region. `/ingredients` shows the disclaimer next to the acknowledgement checkbox. The desktop nav is named Primary. The pre-existing hydration warning still points at `components/AppShell.tsx`.
- No Lighthouse run. No manual WCAG audit beyond the skip link, language, and nav labels. No claim that the critical Next.js advisory is fixed.

## What this phase does not do

- Next.js was not upgraded past the date cutoff.
- Playwright does not cover scan upload, chat, or delete.
- Hindi and Tamil are not translated.
