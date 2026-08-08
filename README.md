# Facelab

AI skincare cosmetologist app on **Zerops** — Next.js App Router, Tailwind CSS, Lucide icons, PostgreSQL health checks.

## Routes

| Path | Description |
|------|-------------|
| `/` | Marketing landing |
| `/dashboard` | Skin Diagnostic Dashboard (scores, concerns, routine, ingredients, AI chat) |
| `/api/health` | Health JSON (`db: ok \| error`, always HTTP 200) |

## Stack

- Next.js 16 (standalone SSR)
- React 19 + TypeScript
- Tailwind CSS 3
- Lucide icons
- PostgreSQL (`db` service) for migrations / health

## Local on appdev

```bash
ssh appdev
cd /var/www
npm run dev   # 0.0.0.0:3000
```

Or via platform: `zerops_dev_server action=start hostname=appdev command="npm run dev" port=3000`

## Deploy

- **Dev** (source + hot reload): `zerops_deploy targetService=appdev setup=dev`
- **Stage** (production standalone): `zerops_deploy sourceService=appdev targetService=appstage setup=prod`

`zerops.yaml` setups: `dev` | `prod`.
