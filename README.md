# 🧭 Skill Atlas — your learning navigator

An **AI-powered personalized learning-path recommender**. Tell it where you are and where you want to go; it charts a phased route to your target role, explains every turn, and **reroutes** as you learn — like GPS for skills.

Built to feel like a navigator, not another purple-glass AI dashboard. It runs **fully offline with zero API keys** (deterministic engine), and gets smarter when you plug in an LLM.

---

## Highlights

- **Conversational onboarding** — describe your goal in plain English; the app extracts a structured profile you can confirm and edit.
- **Explainable skill-gap analysis** — every skill sorted into *mastered / partial / missing*, in prerequisite order, each with a reason.
- **Scored, transparent recommendations** — each resource shows *why* it was picked and the point-by-point factors behind its score.
- **Phased roadmap** — a dependency-ordered route with milestones, checkpoints, and a clear "next best action."
- **Adaptive rerouting** — completing steps, passing/failing checkpoints, feedback, changing your pace or destination all **regenerate the path**, with an animated "recalculating route" moment.
- **Q&A assistant** — ask "why this step?", "how long is left?", "what are my gaps?" and get grounded answers.
- **Progress dashboard** — streak, phases done, checkpoint average, skill passport, activity timeline.
- **Provider-agnostic AI** — Gemini · OpenRouter · Claude · Grok, or none at all.

---

## Quickstart

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # fill in DATABASE_URL + DIRECT_URL from Supabase
npm run db:migrate          # create the Postgres schema
npm run dev                 # http://localhost:3000
```

No API key required. On the home page, click **“Try a demo”** to seed three personas, or paste your own intro to build a fresh path.

---

## AI configuration (optional)

The app has a **provider-agnostic LLM abstraction** — domain logic never talks to a vendor directly, only to a common `LLMProvider` interface. Adding a provider is one adapter file.

| Provider | Default model | Get a key |
|---|---|---|
| **Google Gemini** | `gemini-3.7-flash` (free tier) | https://aistudio.google.com/app/apikey |
| **OpenRouter** (gateway — any model) | `google/gemini-3.5-flash-lite:free` | https://openrouter.ai/keys |
| **Anthropic Claude** | `claude-haiku-4-5-20251001` | https://console.anthropic.com/settings/keys |
| **xAI Grok** | `grok-4-fast` | https://console.x.ai |

Configure it in-app: the **AI Brain** button (top-right) → pick provider, model, key → *Test connection* → *Save*. The key is stored **per browser session** (server-side, HttpOnly cookie) — there is no global or env-var fallback key. A saved model that the provider has since retired is automatically retried on the provider's current default.

**Modes** (`AI_MODE`): `hybrid` (default — deterministic core + LLM for language tasks) · `ai` (LLM for everything it supports; path ordering stays deterministic) · `demo` (fully offline fallback).

> 🔒 **Keys are server-side only** — never sent to the browser, never hardcoded, never logged, and masked in the UI after saving.

---

## Demo personas

Seed with the **“Try a demo”** button or `POST /api/seed`. Each produces a noticeably different route:

| Persona | From → To | Path shape |
|---|---|---|
| 🌱 **Maya** | Complete beginner → Data Scientist | 5 phases, 14 skills to learn |
| 📈 **Dev** | Intermediate Python dev → ML Engineer | 7 phases, 2 mastered / 2 partial |
| 🤖 **Sam** | Backend dev → AI/LLM Engineer | 3 phases, 5 skills already mastered |

---

## How it works

The engine is **fallback-first**: the deterministic core always produces a complete, explainable result; when an LLM is available (and mode ≠ demo) it *enhances* language-heavy steps, and any error silently falls back. That's what keeps the app working on zero credits.

- **Skill gap** = your known skills vs. the target role's required skills, topologically sorted so prerequisites come first.
- **Recommendations** = explainable scoring (each `ScoreFactor` carries a human-readable note).
- **Roadmap** = phases built from the ordered gaps, versioned so every reroute is a new version.
- **Adaptation** = completions, assessments, feedback, time/goal changes each emit an event and regenerate the roadmap.

```
src/
  app/            Pages: / · /navigator · /gap · /dashboard · /step/[id]  +  /api/* route handlers
  components/     RouteMap · NextBestAction · RerouteOverlay · AiSettings · Assistant · …
  lib/
    ai/           Provider-agnostic LLM layer — types, adapters, config, aiService, deterministic fallback
    domain/       Framework-free engine (no LLM/DB deps): skill-gap, recommend, roadmap, adaptation
    catalog/      Static skills / roles / resources / quizzes (in code, not the DB)
    server/       Service layer (domain + Prisma), HTTP helpers, assessment grading
  store/          Zustand client store
prisma/           Postgres schema + migrations
```

---

## Tech stack

Next.js 14 (App Router) · TypeScript · React 18 · Prisma + PostgreSQL (Supabase) · Zod · Zustand · Tailwind CSS · Framer Motion · lucide-react. All AI calls are plain `fetch` — no vendor SDKs.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:migrate` | Create/apply a migration (local dev) |
| `npm run db:deploy` | Apply pending migrations (CI / prod) |
| `npm run db:studio` | Browse the database |
| `npm run lint` | Lint |

---

*A hackathon MVP — deliberately scoped for a great end-to-end demo over exhaustive coverage.*
