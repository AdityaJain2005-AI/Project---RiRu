# Facelab

One Next.js app: MediaPipe face scan (CV), Tesseract ingredient OCR, and the skin lab UI.

```bash
cd Project---RiRu
npm install
npm run dev
```

Open http://localhost:3000

| Route | What it is |
| --- | --- |
| `/scan` | Live MediaPipe Face Landmarker, 3-view capture, biomarker scores |
| `/product` | Label OCR (Tesseract in the browser) + ingredient dictionary |
| `/dashboard` | Lab scores, concerns, matched actives |
| `/routine` `/history` `/chat` | Routine, history, AI cosmetologist |

No Postgres required locally. Scans persist in `data/store.json`. If `DB_HOST` is set, it uses PostgreSQL instead.

The old Flask scanner still lives under `scanner/` but is no longer needed to run the app.
