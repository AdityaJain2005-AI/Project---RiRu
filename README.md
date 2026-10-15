# RiRu – AI Skincare Guide

An end-to-end AI skincare platform that eliminates guesswork by combining computer vision, product OCR, routine safety analysis, and a personalized AI assistant.

**Live Stage:** https://appstage-2b6b-3000.prg1.zerops.app/scan
**Repository:** https://github.com/Azad-Ali-Mohamed/facelab-riru

---

## Project Vision

RiRu is designed as a complete skincare system rather than a simple scanner:

- **Computer Vision Scan** – Real-time analysis of face metrics (redness, texture, acne severity)
- **Product & Ingredient OCR** – Snap a bottle and automatically parse the full INCI list onto a digital shelf
- **Automated Routine Auditor** – Detects dangerous active ingredient clashes and builds a safe AM/PM calendar
- **Context-Aware AI Assistant** – A personalized LLM chatbot backed by a persistent “Skin Wiki” that remembers past reactions, skin scores, and active products

---

## Architecture Decisions (Why I chose this structure)

Since this was my first time building a web application, I wanted to keep the architecture simple and practical while still leaving room to grow the product. I chose Next.js so I could build the frontend and backend in one place, PostgreSQL to keep user data, skincare products, routines, and scan history organized, and Zerops to handle the deployment and infrastructure without adding too much complexity. I also kept the application modular so features like the dashboard, skin scan, product shelf, routine analysis, and AI assistant could be developed independently. From a product perspective, I wanted RiRu to feel like one complete skincare guide rather than a collection of separate AI features, so I designed the system around a user's skin journey and the data they build up over time.

## How the project was built

- **Architecture & product decisions** → Designed by me
- **Code implementation** → Developed with heavy assistance from **Grok Build**
- **Infrastructure & deployment** → Fully handled by **Zerops Control Plane** (from development environment to staging)

I planned the system boundaries, data model, and user flows first. Then I used Grok Build as a coding partner to implement the UI, API routes, database layer, and wiring. Zerops provided the consistent environment and one-command deployments throughout the process.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui + Lucide icons
- **Database**: PostgreSQL (managed on Zerops)
- **Deployment**: Zerops (`zerops.yaml` with `dev` and `prod` setups)
- **AI Coding Agent**: Grok Build

---

## Current Status

The core UI, database schema, health checks, and dashboard are live on Zerops. The scan screen sends the photo to a baseline visual estimate (`baseline_cv_v1`). It is not a measurement and not a diagnosis. Older rows may still be the heuristic in `lib/scan-engine.ts`. `POST /api/scans` still writes that heuristic.

A typed ingredient list can be checked with the versioned rule pack, and that path does not need the ML service. A label photo is read only when the ML service is up. The photo is not kept unless storage is configured and the user opts in. OCR accuracy is not measured.

A routine can be built from the latest succeeded face scan and the profile. Example products are formulas in `data/products`, not shop listings. Similarity is ingredient-name overlap (`jaccard_v1`), not a measured match. A price is stored only when you paste it, and only on your own rows. The server does not open the link. A sample-score scan does not personalize the list. The check-off list on `/routine` is unchanged.

Phase 1 tables are applied on the local Postgres 16 cluster used for development. That cluster has no `vector` extension, so chat embeddings stay in `embedding_fallback`. Grounded chat is `POST /api/chat`. With `DEMO_MODE=true` it uses the mock model. An empty API key returns “Chat is not configured.” Progress, check-ins, recovery mode, export, and delete are in Phase 6. Hindi and Tamil locale codes exist and still return English.

Phase 1 is in [`docs/phase-1.md`](docs/phase-1.md). Phase 2 (quality gate and baseline face estimate) is in [`docs/phase-2.md`](docs/phase-2.md). Phase 3 (ingredient catalog, OCR, and the conflict check) is in [`docs/phase-3.md`](docs/phase-3.md). Phase 4 (recommendations and pasted prices) is in [`docs/phase-4.md`](docs/phase-4.md). Phase 5 (grounded chat) is in [`docs/phase-5.md`](docs/phase-5.md). Phase 6 (progress and privacy) is in [`docs/phase-6.md`](docs/phase-6.md). Phase 7 (skin-model decision) is in [`docs/phase-7.md`](docs/phase-7.md). Phase 8 (OCR and the INCI gold set) is in [`docs/phase-8.md`](docs/phase-8.md). Phase 9 (hardening and project docs) is in [`docs/phase-9.md`](docs/phase-9.md).

Also: [`CONTRIBUTING.md`](CONTRIBUTING.md), [`docs/deployment.md`](docs/deployment.md), [`docs/privacy-policy.md`](docs/privacy-policy.md) (a template, not legal advice), and [`docs/project-report.md`](docs/project-report.md). License: MIT.

## Design

Phase 0 (architecture, data model, API contract, risks) is in [`docs/phase-0.md`](docs/phase-0.md). Later phases implement that contract one slice at a time.

---

## Disclosure (for The Zerops Challenge)

Architecture, product direction, and technical decisions were made by me.  
Code development was significantly assisted by Grok Build.  
The entire application is built, deployed, and operated on Zerops.
