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

## Architecture Decisions (Why I chose this structure)

Since this was my first time building a web application, I wanted to keep the architecture simple and practical while still leaving room to grow the product. I chose Next.js so I could build the frontend and backend in one place, PostgreSQL to keep user data, skincare products, routines, and scan history organized, and Zerops to handle the deployment and infrastructure without adding too much complexity. I also kept the application modular so features like the dashboard, skin scan, product shelf, routine analysis, and AI assistant could be developed independently. From a product perspective, I wanted FaceLab to feel like one complete skincare platform rather than a collection of separate AI features, so I designed the system around a user's skin journey and the data they build up over time.

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

The core UI, database schema, health checks, and basic dashboard are live on Zerops. Computer vision, OCR, routine auditing, and the full AI assistant are still under active development.

---

## Disclosure (for The Zerops Challenge)

Architecture, product direction, and technical decisions were made by me.  
Code development was significantly assisted by Grok Build.  
The entire application is built, deployed, and operated on Zerops.
