# 🧭 Skill Atlas

**Give it a goal. It builds the route.**

Skill Atlas is an AI-powered learning navigator. Describe what you want to achieve in plain language, and it turns your current skills, pace and progress into a personalized, prerequisite-aware learning route then recalculates that route as you learn, the way a GPS recalculates when you take a different turn.

```
Goal  →  Understand  →  Find the gaps  →  Build the route  →  Learn  →  Reroute
```

---

## Why Skill Atlas?

Most course recommenders answer *"what should you take?"*  a list of courses, the same list for everyone.

Skill Atlas answers the harder question:

> **"What should I learn next, in what order, and why?"**

The order is the point. You can't learn Docker before you know the command line, and you shouldn't grind basics you've already mastered. Skill Atlas works that out from an actual skill graph and keeps working it out: the route adapts when you improve, struggle, change direction, or only have half the time you used to.

## What you can do

**Say anything.** "Final-year student, know some C, want to get into data science." "Linux kernel developer." There's no dropdown of predefined careers — though well-known ones are recognized instantly.

**See your gaps honestly.** Every skill sorted into *mastered / partial / missing*, in learning order, with a reason for each.

**Follow a route, not a list.** A phased roadmap where prerequisites actually come first, with milestones, checkpoints and one clear **Next Best Action** at all times.

**Get real resources.** Curated catalog and canonical sources first; when a skill has nothing local, a study module is generated from the graph and links are never fabricated.

**Learn by doing.** Skill-based projects and checkpoint quizzes for every skill on your route.

**Watch it reroute.** Pass a checkpoint → the route shortens. Struggle → it reinforces fundamentals. Say "too long" → it favors shorter resources. Change your hours or destination → the timeline and route recalculate, with a **What Changed** summary so it's never a mystery.

**Ask why.** An AI assistant grounded in your actual roadmap  "why this step?", "how long is left?" plus **How we built your path** explaining the strategy behind every route.

**Track it.** A progress dashboard and **Skill Passport** of your proficiency levels. Light/dark mode, one responsive UI from phone to desktop.

## See it in action

1. **Tell it your goal** one sentence is enough.
2. **It understands your level and target**  an editable profile, extracted from what you wrote.
3. **It identifies what's missing**  the gap between your skills and the goal.
4. **It builds the route**  prerequisite-aware, phased, with resources attached.
5. **You learn and take checkpoints.**
6. **Your route changes as your knowledge changes.**

And if your goal is unusual? With an AI provider connected, the LLM maps it into real skills  instead of forcing you down a generic tech path. Without one, Skill Atlas tells you honestly that the goal is outside its offline catalog rather than inventing a fake route.

## The interesting part: how it thinks

```
LLM                →  understands goals, language and learner intent
Learning Engine    →  validates skills, prerequisites, resources, ordering and adaptation
```

The LLM never builds the roadmap. The deterministic engine never has to guess what you meant. The engine always produces a complete, explainable route first the LLM enhances understanding on top.

That split is what lets the product accept arbitrary natural-language goals *without* blindly trusting an LLM with the learning structure and it's why the whole thing still works with no API key at all.

## AI Providers

| Provider | Notes |
|---|---|
| Google Gemini | Free-tier flash models; a good default |
| OpenRouter | Gateway to many models, including free ones |
| Anthropic Claude | Paid |
| xAI Grok | Paid |

BYOK - bring your own key, pick a provider and model in the app's AI settings, and test the connection before saving. Modes: **Hybrid** (default), **AI**, or **Demo**. With no key, it runs in Demo mode and remains fully functional.

## Built with

Next.js 14 · TypeScript · React 18 · Tailwind CSS · Prisma · Supabase PostgreSQL · Zod · Zustand · Framer Motion

Plain `fetch` for all AI calls — no vendor SDKs.

## Run it locally

Node.js + a Supabase Postgres database.

```bash
npm install               # also runs `prisma generate`
cp .env.example .env      # set DATABASE_URL + DIRECT_URL
npm run db:migrate
npm run dev               # http://localhost:3000
```

No API key required.

## Demo

Click **"Try a demo"** on the home page to seed three personas  a complete beginner heading to Data Scientist, an intermediate Python developer heading to ML Engineer, and a senior backend engineer heading to AI/LLM Engineering  each producing a visibly different route.

## Architecture

```
Learner
  ↓
Next.js UI
  ↓
API + Learning Engine + AI Layer
  ↓
Prisma
  ↓
Supabase PostgreSQL
```

For the full architecture, edge cases, fallback behavior, data model and development rules, see **[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)**.

---

*Skill Atlas isn't a list of courses. It's a learning route that changes with you.*
