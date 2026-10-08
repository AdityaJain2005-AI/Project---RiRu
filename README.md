# FaceLab – AI Skincare Diagnostic Platform

An end-to-end AI skincare platform that eliminates guesswork by combining computer vision, product OCR, routine safety analysis, and a personalized AI assistant.

**Live Stage:** https://appstage-2b6b-3000.prg1.zerops.app/scan
**Repository:** https://github.com/Azad-Ali-Mohamed/facelab-riru

---

## Project Vision

FaceLab is designed as a complete skincare system rather than a simple scanner:

- **Computer Vision Scan** – Real-time analysis of face metrics (redness, texture, acne severity)
- **Product & Ingredient OCR** – Snap a bottle and automatically parse the full INCI list onto a digital shelf
- **Automated Routine Auditor** – Detects dangerous active ingredient clashes and builds a safe AM/PM calendar
- **Context-Aware AI Assistant** – A personalized LLM chatbot backed by a persistent “Skin Wiki” that remembers past reactions, skin scores, and active products

---
## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui + Lucide icons
- **Database**: PostgreSQL (managed on Zerops)
- **Deployment**: Zerops (`zerops.yaml` with `dev` and `prod` setups), will shift to vercel.
---
