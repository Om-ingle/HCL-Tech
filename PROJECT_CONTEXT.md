# PROJECT_CONTEXT.md

The single technical/product context document for **Skill Atlas** (package name `learning-navigator`). Written for a future developer or AI coding assistant: read this first, and you should not have to rediscover the architecture from the codebase. Everything here describes **what the code does today** — nothing aspirational.

---

## 1. Project overview

**Skill Atlas** is an AI-powered personalized learning-path recommender that behaves like a **GPS navigator for skills**. A learner describes a goal in plain English ("final year student, know some C, want to get into data science"); the app:

1. extracts a structured profile from that text,
2. resolves the goal to a concrete **target-skill set**,
3. computes a **skill gap** (mastered / partial / missing) against the learner's known skills,
4. expands prerequisites and orders them with a **topological sort**,
5. discovers **resources** for each skill and **scores** them with explainable factors,
6. assembles a **phased roadmap** with milestones and checkpoints,
7. tracks progress and **reroutes** (regenerates a new roadmap version) when the learner completes steps, passes/fails checkpoints, gives feedback, or changes pace/destination,
8. answers questions via a grounded **assistant**, and always surfaces a **Next Best Action**.

**Value proposition / differentiation:** not a course list. Every route is (a) prerequisite-aware — the graph decides order, never the LLM; (b) fully explainable — every skill inclusion, resource pick, and adaptation carries a human-readable reason; (c) **functional with zero API keys** (deterministic engine), and gets *smarter* about unusual goals when an LLM is connected; (d) adaptive — the route visibly recalculates like a GPS.

The intended experience is a demo-able end-to-end product (hackathon MVP by design — see `README.md`): onboarding in one sentence → confirm profile → watch a route appear → interact with it and watch it reroute.

---

## 2. Complete architecture

```
User (anonymous browser)
  │
  ├── profileId: localStorage ("skill-atlas", zustand persist)
  └── ai_sid: HttpOnly cookie (set in middleware.ts)
        │
        ▼
UI  — src/app/(pages) + src/components   [client components, zustand store]
        │  fetch (src/lib/client/api.ts)
        ▼
API routes — src/app/api/*/route.ts      [Next.js route handlers, Zod-validated]
        │
        ▼
Server service — src/lib/server/service.ts  (orchestrates everything below)
        │            src/lib/server/http.ts  (response envelope + 503 self-diagnosis)
        │            src/lib/server/session.ts (aiSessionId() from cookie)
        │            src/lib/server/assessment.ts (checkpoint grading)
        │
        ├── AI layer — src/lib/ai/*       (provider-agnostic LLM abstraction)
        │      └── providers/{gemini,openrouter,claude,grok,openaiCompat}.ts
        │
        ├── Domain engine — src/lib/domain/*  (framework-free, sync, no DB/LLM deps)
        │      goalResolver · skillGap · recommend · path · adapt · nextAction · quizGen
        │
        ├── Catalog — src/lib/catalog/*   (static knowledge, IN CODE not the DB)
        │      skills(123) · roles(7) · goals(archetypes) · resources(56) · quizzes
        │      dynamic (LLM-inferred skills) · text (normalization/matching)
        │
        ├── Discovery — src/lib/discovery/*  (3-layer resource pool)
        │      index (pool) · canonical · generate · search (optional Tavily)
        │
        ▼
Prisma (src/lib/db.ts singleton)  →  Supabase PostgreSQL
```

### Responsibilities per layer

| Layer | Responsible for |
|---|---|
| **UI** | All rendering; pages are client components that fetch via `src/lib/client/api.ts`. Zustand store (`src/store/useAppStore.ts`) holds `profileId` (persisted to localStorage), AI status, panel open-state, reroute overlay trigger. |
| **API routes** | Thin HTTP surface: parse + Zod-validate input, call the service layer, wrap in `{data}` / `{error}` envelope (`http.ts`). Never contain business logic. |
| **Server service** | The orchestrator: loads/saves profiles, runs skill-gap → discovery → roadmap generation, persists roadmap versions and step states, records `Event` rows, applies adaptations, builds the Assistant context. |
| **AI layer** | The ONLY code that talks to vendors. `aiService.ts` exposes `extractProfile`, `resolveGoalText`, `answerQuestion`, `testConnection`, `getAiStatus`. Everything else in the app calls these, never a provider directly. |
| **Domain engine** | Pure, synchronous, deterministic: goal resolution, gap analysis, prerequisite ordering, resource scoring, roadmap generation, adaptation decisions, next-best-action, quiz generation. No `fetch`, no Prisma, no React. |
| **Catalog** | The static "knowledge": skill graph (id, name, domain, tier 1–5, prerequisites, aliases), 7 predefined roles, goal archetypes, curated resources + canonical per-skill sources, curated quizzes, and the in-memory registry of dynamic (LLM-inferred) skills. |
| **Discovery** | Builds the candidate resource pool per skill: curated catalog + canonical sources → (optional) external search → generated study module. Guarantees the pool is never empty. |
| **Prisma / Supabase** | Persistence of dynamic per-learner state only (profiles, roadmap versions, step states, events, per-session AI config). |

### Architecturally important files

| File | Why it matters |
|---|---|
| `src/lib/domain/goalResolver.ts` | The open-goal engine. Turns ANY text into validated target skills; refuses out-of-domain goals. |
| `src/lib/domain/skillGap.ts` | Gap analysis (`analyzeSkillGap`) — works for any resolved goal, not just roles. |
| `src/lib/domain/path.ts` | Roadmap generator: groups ordered gaps into domain phases, picks resources, emits rationale. |
| `src/lib/domain/recommend.ts` | Deterministic explainable resource scoring (`scoreResource`, `ScoreFactor[]`). |
| `src/lib/domain/adapt.ts` | All adaptation rules (completion / assessment / feedback / time / goal change). |
| `src/lib/domain/nextAction.ts` | Hydrates a roadmap + step states into the Navigator view & Next Best Action. |
| `src/lib/domain/quizGen.ts` | Curated quizzes + deterministic graph-fact-generated checkpoints. |
| `src/lib/ai/types.ts` | `LLMProvider` interface + `PROVIDER_META` (the model catalog). |
| `src/lib/ai/config.ts` | Session-scoped AI config resolution/persistence; key masking. |
| `src/lib/ai/aiService.ts` | AI entry points + fallback + retired-model retry. |
| `src/lib/catalog/dynamic.ts` | Registers LLM-inferred skills as full graph citizens (`dyn-*`). |
| `src/lib/discovery/index.ts` | The 3-layer pool (`buildPool`, `fetchExternal`). |
| `src/lib/server/service.ts` | Everything the API routes call. |
| `src/middleware.ts` | Issues the anonymous `ai_sid` cookie. |
| `src/lib/serialize.ts` | Row ⇄ domain-object mapping (JSON string columns). |
| `scripts/verify-ai-wiring.cjs`, `scripts/verify-layout.cjs` | The two verification suites (§20). |

There is **no MCP** implementation. External resource discovery is a pluggable search-provider layer (Tavily-shaped), OFF by default — see §9.

---

## 3. Technology stack

Actually present in `package.json` (no other runtime deps; **no vendor AI SDKs** — all AI calls are plain `fetch`):

- **Next.js 14.2.15** (App Router) · **React 18.3** · **TypeScript 5.6**
- **Tailwind CSS 3.4** (design tokens as CSS variables, `tailwind.config.ts` maps them)
- **Prisma 5.22** + **Supabase PostgreSQL**
- **Zod 3.23** (API input validation, `src/lib/validation/schemas.ts`)
- **Zustand 4.5** (client store with `persist` → localStorage key `skill-atlas`)
- **Framer Motion 11** (animations, incl. the reroute overlay)
- **lucide-react** (icons)
- Dev tooling: ESLint, PostCSS/Autoprefixer. **No test framework** — verification is two Node scripts (§20).

---

## 4. Core product flow

```
natural-language goal ──▶ /api/onboard
   extractProfile (LLM if available, else deterministic) → ProfileDraft
   resolveGoalText (LLM hint if available) → GoalResolution + dynamicSkills
        │  learner reviews/edits the draft + target skills on the goal screen
        ▼
   POST /api/profile → LearnerProfile row (known skills, confirmed targets)
        ▼
   goal resolution (role/archetype/terms/domain/LLM, §5)
        ▼
   skill-gap analysis: known proficiency vs target level → missing/partial/mastered
        ▼
   prerequisite expansion + topological ordering (the graph is the authority)
        ▼
   resource discovery pool (3 layers, §9)
        ▼
   explainable recommendation scoring → pick per-skill resources + projects
        ▼
   roadmap generation: domain phases, milestones, checkpoints, rationale
   (persisted as LearningPath version N)
        ▼
   learning step (/step/[id]: resource/module details, external link, FeedbackBar)
        ▼
   assessment (/api/quiz, /api/assessment/submit) → proficiency update
        ▼
   feedback (/api/feedback: too_easy/too_hard/too_long/not_useful/…)
        ▼
   adaptation (src/lib/domain/adapt.ts) → new roadmap version = "reroute"
   + What Changed overlay + Next Best Action
        ▼
   dashboard (streak, progress, skill passport, recent activity)
```

Stage notes:

- **Onboarding** (`/api/onboard`): one call does extraction + goal resolution + target-skill proposal. The learner confirms/edits before `POST /api/profile` persists anything.
- **Goal resolution happens once at onboarding** (plus re-resolution on reroute from the *stored* profile); it is never re-run per roadmap regeneration.
- **Every reroute** = `analyzeSkillGap` → `discoveryPool` → `generateRoadmap(version+1)` → persist. Old versions remain queryable.

---

## 5. Goal resolution / open-goal system (read this carefully)

`src/lib/domain/goalResolver.ts` — `resolveGoal(input, hint?)`. Order of authority; every branch produces **real graph skill ids**, so a roadmap is always buildable:

1. **Predefined role** — 7 roles (`data-scientist`, `ml-engineer`, `ai-llm-engineer`, `backend-engineer`, `cloud-engineer`, `data-analyst`, `security-analyst`). An explicit `targetRoleId` wins outright (confidence 1) so demo personas stay exact; a fuzzy role match is a *guess* — `buildGoalInput` lets a strong text-only resolution beat it (an unusual goal must not be silently snapped to the nearest role).
2. **Goal archetype** (`catalog/goals.ts`) — a destination that is NOT a new career object, just a label + anchor skills already in the graph (Linux Kernel Developer, Compiler Engineer, Robotics Engineer, Autonomy/Self-Driving, Control Systems, …). Longest matching phrase wins over a fuzzy role, so "MLOps Engineer" beats the "ML Engineer" role and "Kernel Developer" is not swallowed by it.
3. **Skill terms in the text** — skill names/aliases matched directly ("robotics engineer focused on computer vision" keeps the vision part). A thin seed (≤2 skills) widens sideways via `relatedSkills`.
4. **Domain signals** — domain keywords / the matched skills' own domain seed that domain's core + flagship skills when the target set is still thin.
5. **LLM hint** (only when a provider is configured) — ONE small structured call (`GOAL_SCHEMA`: goal label, domain, 6–12 candidate skill names). Candidates are mapped via `validateSkillNames`: ids/names/aliases resolve; **topics outside the catalog are registered as dynamic skills** (`dyn-*` ids, `catalog/dynamic.ts`) so they become full graph citizens (gap analysis, ordering, quizzes, generated modules all work on them). Dynamic skills are persisted in `profile.preferences.dynamicSkills` and re-registered on profile load. A hallucinated skill that fails validation simply doesn't exist and is dropped. An all- unusable LLM response counts as an AI failure (falls back with a visible note).
6. **Fallback branches** when nothing matched:
   - **Vague but clearly tech** (the `TECH_INTENT` regex hits: "I want to work in tech") → honest *starter* route: programming fundamentals, Python, Git, Linux CLI, algorithms at low confidence, with a note telling the learner to steer.
   - **Out-of-domain** ("learn dancing", "cooking") → method `"unmapped"`, confidence 0.1, note: *"This goal is outside the offline learning catalog — connect an AI provider and I can map it properly."* **The app does NOT fabricate a Python/Git/software route for a non-tech goal.**

Examples of actual behavior:

| Input | With AI | Without AI |
|---|---|---|
| "Linux kernel developer, know Python and some C" | archetype match → kernel/systems anchors → prerequisite-expanded route | same (fully deterministic; archetype needs no LLM) |
| "battery technology / electrochemistry" | LLM infers domain + topics → dynamic skills (`dyn-electrochemistry`, …) → real route with generated study modules | mostly `unmapped`/thin — only graph-mappable terms survive; UI explains the catalog limit |
| "I want to learn dancing" | LLM infers dance-related skills → dynamic skills → dance route | **refused honestly** (unmapped + guidance to connect AI) |

A learner-confirmed target-skill list (`preferences.targetSkillIds`) always **overrides** inference with confidence 1 (validated the same way).

---

## 6. AI architecture

**Provider-agnostic by construction**: the app talks only to the `LLMProvider` interface (`generate`, `generateStructured`, `testConnection`) in `src/lib/ai/types.ts`. Adapters: `gemini.ts`, `openrouter.ts`, `claude.ts`, `grok.ts` (grok uses `openaiCompat.ts`). Adding a provider = one adapter file + a `PROVIDER_META` entry.

- **Providers**: Google Gemini (default `gemini-3.7-flash`, free-tier), OpenRouter (default `google/gemini-3.5-flash-lite:free`, gateway to any slug incl. free ones), Anthropic Claude (default `claude-haiku-4-5-20251001`, paid), xAI Grok (default `grok-4-fast`, paid). Model lists, cost labels (`free` / `free-tier` / `paid` — never guessed), key hints/URLs live in `PROVIDER_META`.
- **Config is per anonymous browser session** (§13). `resolveAiConfig(sessionId)` returns `available: true` only when the session has a saved, enabled row with a key. **There is no global or env-var fallback** — the `LLM_*`/`AI_MODE` entries still shown in `.env.example` are **not read anywhere** (stale doc; runtime config lives only in the `AiConfig` table).
- **Modes**: `hybrid` (default) and `ai` both enable the same AI calls in the current service layer (`aiService` only checks `mode !== "demo"`); `demo` disables all AI. In every mode the deterministic engine computes its result first and the LLM result is merged over it.
- **The rule**: if the learner has a valid key and mode ≠ demo, the selected LLM **is actually called** for the AI-layer tasks (extraction, goal hint, assistant). The code never silently skips the LLM "because deterministic is good enough". Fallback happens ONLY when: no key/config, `demo` mode, the provider request fails/times out, or the response is unusable (e.g. zero usable candidate skills) — and every such fallback is surfaced to the UI as a visible note ("Gemini call failed — used local parsing. (…)"), never presented as "the AI said".
- **Retired-model handling**: a vendor 404/"model not found" triggers exactly one retry with the provider's current default (`callWithModelFallback`), with a note naming both models. Same logic in `testConnection`.
- **Validation**: structured outputs (JSON schema) are parsed and merged field-by-field over the deterministic baseline with clamping/enum checks (`mergeLlmDraft`); skill names are validated against the graph; API keys are stripped from any error text before logging (`safeErr`).

**Always deterministic (LLM never decides):** prerequisite ordering, target validation, skill-gap math, resource scoring, roadmap phase construction and ordering, adaptation rules/progression safety, next-best-action selection, quiz answer keys.

**LLM is used for:** onboarding profile extraction, open-goal interpretation (the one structured hint call), the conversational assistant, and the dynamic-skill blurbs it proposes. That is the entire AI surface today — there is no LLM in recommendation, roadmap building, or adaptation.

---

## 7. LLM cost strategy

- **Small focused prompts**: extraction `maxTokens 1500 / temp 0.1`; goal hint `maxTokens 1500 / temp 0.1` (deliberately generous — reasoning models spend tokens thinking before the JSON); assistant `maxTokens 900 / temp 0.4`, 2–5 sentence answers.
- **Structured output** (JSON schema) wherever the result is consumed by code — no parsing chatter, no follow-up repair calls.
- **No repeated calls**: the goal-resolution LLM call happens **once at onboarding**, never on regeneration; extraction happens once per onboarding; the assistant is one call per question.
- **Recent history only** — last 3 messages (§8).
- **The deterministic engine does everything that doesn't need language understanding.** This is why weak/free models suffice: the LLM only ever answers small, well-scoped questions.

---

## 8. AI conversation memory

The assistant endpoint receives, per request (`buildAssistantRequest` in `src/lib/ai/prompts.ts`):

- the current question,
- **the last 3 conversation messages** (client sends `messages.slice(-3)` from `Assistant.tsx`; server also slices `history.slice(-3)`),
- a compact **learner context** (`AssistantContext`): name, target role/goal label, experience, weekly hours, mastered/partial/missing counts, top gap skills, current phase, next best action + why, overall %, estimated weeks left.

Full chat history is intentionally NOT sent (token control; provider-side memory is never assumed). The context is **rebuilt from the learner's current profile + latest roadmap on every request**, so after a goal change the next assistant answer is already grounded in the new destination — there is no stale-goal cache. The system prompt forbids inventing resources/scores and directs plan-change requests to the app's real controls (Simulate / feedback / checkpoints).

---

## 9. Resource discovery system

Three layers, cheapest and most trusted first (`src/lib/discovery/index.ts`):

1. **Curated catalog + canonical sources** — 56 authored resources (`catalog/resources.ts`) plus a canonical per-skill registry (`discovery/canonical.ts`, e.g. official docs homepages). Always present.
2. **External search** (optional, **OFF by default**) — `discovery/search.ts` defines a pluggable `SearchProvider`; a Tavily-shaped adapter activates only when `SEARCH_PROVIDER=tavily` + `SEARCH_API_KEY` are set server-side. Only skills not already covered by layer 1 are queried (≤12 queries, bounded). Results pass a trusted-domain filter (docs./developer./learn./.edu/python.org/github.com/readthedocs/arxiv/coursera/edx/…, `discovery/search.ts` `TRUSTED` list) and a source-quality score. **URLs come only from a real search response — the LLM never supplies one.**
3. **Generated study module** (`discovery/generate.ts`) — when a skill has nothing else, a module is generated from **graph metadata** (skill name, domain, tier, prerequisites, description). It has **no external URL by design** — the UI labels it "Guided study module built from the skill graph — no external link". Never a fabricated link.

The pool is deduped by id and URL. `stats` reports catalog/canonical/external/generated counts and which skills are generated-only. Projects: `projectFor(skillIds, difficulty)` picks an authored project/exercise touching those skills (shortest first), else generates one.

A skill with no local resource therefore always ends up with at least a generated module — the roadmap is never blocked on discovery, and discovery failures are swallowed (bonus, never a dependency).

---

## 10. Projects and assessments

**Projects are skill-based, not career-based.** A project is chosen (or generated) for the *skills of a phase* at a difficulty derived from the learner's level — the same machinery works for any goal, including dynamic-skill goals.

**Assessments (checkpoints)**

- Question source: curated quizzes (`catalog/quizzes.ts`, `QUIZ_BY_SKILL`) where they exist; otherwise **generated from graph facts** (`domain/quizGen.ts`) — e.g. prerequisite ordering, domain membership, tier relationships. Deterministic (stable hash, no RNG), so the answer key is re-derivable at grading time without storage. This makes checkpoints available for *every* skill in the graph, including dynamic ones.
- Grading: `src/lib/server/assessment.ts` (server-side).
- Proficiency update + adaptation (`applyAssessment`): ≥80% → skills raised to **strong (3)**, regenerate (path shortens — intro material skippable); <50% → skills kept at **aware (1)**, difficulty bias eased, regenerate (gentler/more foundational resources); 50–79% → **working (2)**, no regeneration.

---

## 11. Personalization and adaptation

All rules live in `src/lib/domain/adapt.ts`; each returns `{profile, changes, regenerate}` — `changes` is the **"What Changed"** list shown by the reroute overlay.

| Trigger | Effect |
|---|---|
| Resource/step completed (`/api/step/complete`) | skills → proficiency 2; no regeneration (status change only) |
| Step skipped (`/api/step/skip`) | step marked skipped; unlocks dependents |
| Assessment ≥80% / <50% / mid | see §10 |
| Feedback `too_easy` | difficulty bias +0.5, regenerate |
| `too_hard` | difficulty bias −0.5 (prereqs reinforced first), regenerate |
| `too_long` | type bias toward tutorials/docs, away from courses/books, regenerate |
| `not_useful` | resource added to `dislikedResourceIds` (+ type bias −0.3), regenerate |
| `very_useful` / `interested` / `need_practice` | positive type/domain biases; more projects/exercises, regenerate |
| Weekly hours change (`/api/simulate`) | timeline + phase durations recomputed, regenerate |
| Target role change (`/api/simulate`) | **goal change**, see below |
| Milestone/phase completion | unlocks the next phase (`nextAction.ts` prerequisite logic) |

Biases live in `profile.preferences` (`difficultyBias`, `typeBias`, `domainBias`, `dislikedResourceIds`) and feed the deterministic scorer.

**Goal change semantics** (`applyGoalChange`): known skills and proficiency history are **preserved** (the learner keeps their progress), while goal-specific state is invalidated — the confirmed `targetSkillIds` and `dynamicSkills` were confirmed for the *old* goal and are dropped, and `goalText` is replaced by the new destination so old-goal skill terms stop leaking in. Then the route regenerates from the new goal.

**Roadmap versions**: every regeneration writes a new `LearningPath` row with `version = max+1`. **Next Best Action** (`domain/nextAction.ts`) = first available/in-progress step in the current phase, with a human-readable reason.

---

## 12. Database

- **Supabase PostgreSQL** via **Prisma 5**. Schema: `prisma/schema.prisma`; one migration (`20260824025208_init_postgres`; a legacy `prisma/dev.db` remains from the pre-Postgres SQLite era and is unused).
- Connection env vars (names only, values in `.env`, never commit them):
  - `DATABASE_URL` — **transaction pooler** (port 6543, `?pgbouncer=true&connection_limit=1`) — used at runtime.
  - `DIRECT_URL` — **session pooler** (port 5432) — used by Prisma for migrations.
- Scripts: `db:migrate` (dev), `db:deploy` (CI/prod), `db:push`, `db:studio`. `npm run build` runs `prisma migrate deploy` first.

**Models** (all dynamic data; the catalog is NOT in the DB):

| Model | Stores |
|---|---|
| `LearnerProfile` | the learner: name, `targetRole` (role id or free text), `goalText`, level/style, weekly hours, timeline, outcome, interests; JSON-string columns: `knownSkills` (`{skillId, proficiency}[]`), `preferences` (target overrides, biases, `dynamicSkills`), `interests` |
| `LearningPath` | one roadmap **version**: `version`, `phases` (JSON `Phase[]`), `rationale` (JSON: summary/strategy/how) |
| `StepState` | per-step status (`locked|available|in_progress|completed|skipped`) + optional score; unique per (profile, step) |
| `Event` | history: `profile_created|completion|assessment|feedback|adaptation|time_change|goal_change` + JSON payload (drives the dashboard activity feed) |
| `AiConfig` | per-session AI config (row id = session id), §13 |

**Seed** (`POST /api/seed`, "Try a demo" button): idempotently creates the 3 demo personas with **fixed ids** (`persona-ananya`, …) and generates their roadmaps. **Anonymous sessions**: there are no user accounts — the browser holds only a `profileId` in localStorage pointing at a `LearnerProfile` row; a stale id (reset DB) yields a clean 404 which the client treats as "chart a new route".

---

## 13. Anonymous AI session isolation

This is a deliberate security/privacy design — do not regress it.

- `src/middleware.ts` issues an opaque UUID (`ai_sid`) in an **HttpOnly**, SameSite=Lax, Secure-in-prod cookie (1 year). `src/lib/server/session.ts` reads it; route handlers pass it into the AI config layer.
- `AiConfig`'s **row id IS the session id**: provider/model/key/mode are stored **server-side only**, scoped to that one browser session.
- The API key is **never sent to the browser** — the UI receives only `PublicAiStatus` (provider, model, mode, available, `maskedKey` like `AIz•••••a1b2`). Test-connection can reuse the stored key server-side without re-typing.
- **There is no global/env fallback configuration.** A fresh or incognito visitor has no session row → Demo/Fallback mode. One visitor's saved key can never become another visitor's provider. Saving a config without a session is refused outright.
- Switching provider clears the old key (a Gemini key against OpenRouter would 401 forever while the UI claimed it was configured). Saving a key implies `enabled: true`.

---

## 14. Fallback behavior / edge-case matrix

| Situation | Behavior |
|---|---|
| No API key / no session row | Deterministic engine only; no AI calls, no error notes; UI shows "Demo / fallback mode" |
| Valid key, mode hybrid/ai | The selected LLM **is called** for extraction / goal hint / assistant; result merged over deterministic baseline |
| Invalid key | Provider call fails → graceful deterministic fallback **with a visible note** naming the failure (key material stripped) |
| Provider timeout / network error | Same as above — fallback + note |
| Invalid/unusable LLM output (e.g. 0 usable skills) | Treated as AI **failure** → fallback + note (never an empty "success") |
| Weak model (truncated JSON, thinking ate the budget) | Gemini adapter reports the real reason (e.g. `MAX_TOKENS`); falls back with note |
| Retired/unknown saved model | One automatic retry with the provider's current default + note ("Saved model X is unavailable — used Y instead") |
| Free-form model id typed in Settings | Allowed (field is free-form); the retired-model retry covers stale ids |
| Known goal / predefined role | Fully deterministic route (no AI needed) |
| Unusual tech goal (kernel, robotics, …) | Archetype/graph resolution, deterministic |
| Out-of-domain goal, AI available | LLM-inferred skills → validated + registered as dynamic skills → real route |
| Out-of-domain goal, **no AI** | Honest refusal: "outside the offline learning catalog — connect an AI provider"; **no fake route** |
| Skill missing from catalog | Only graph-validated skills exist; unmatched LLM topics become dynamic skills or are dropped |
| Skill has no curated resource | Canonical sources → (optional) external search → **generated study module** (never empty, never a fake URL) |
| External discovery fails / disabled | Silently skipped (layers 1+3 cover everything) |
| Empty/blank learner profile input | Zod validation rejects at the API boundary |
| Goal change | Known skills preserved; confirmed targets + dynamic skills + old goalText dropped; route regenerates (§11) |
| Assessment ≥80 / <50 / mid | §10 proficiency + adaptation |
| Feedback signals | §11 bias updates + regeneration |
| No roadmap found / new profile | Navigator shows "No route yet — Generate my path" |
| Unknown/stale profileId in localStorage | API 404 "Profile not found" (not a 500); client clears it and returns home with a friendly message |
| Provider server errors | `http.ts` returns a self-diagnosing 503 JSON, not a stack trace |

---

## 15. Provider/model configuration

Centralized in `PROVIDER_META` (`src/lib/ai/types.ts`): label, curated model list with honest cost labels, default model, key hint/URL, and a per-provider note (e.g. Gemini native JSON schema; OpenRouter free slugs rotate; Claude structured output via tool use; Grok OpenAI-compatible). The Settings UI offers these as **suggestions** — the model field is free-form (Custom model). Defaults: `gemini-3.7-flash` / `google/gemini-3.5-flash-lite:free` / `claude-haiku-4-5-20251001` / `grok-4-fast`. Retired ids are never listed, and the runtime retry (§6) makes a stale saved id self-healing. Connection test (`/api/ai/test`) does a real vendor round-trip and reports latency.

---

## 16. UI and UX structure

Pages (all client components under `src/app`):

- **`/` Home / onboarding** — brand + the one-sentence goal box; extraction → editable profile draft → goal screen (resolved label, provenance "how we read your goal", editable target skills, unknown terms surfaced); "Try a demo" seeds personas.
- **`/navigator`** — the heart. Header card (route-to, progress %, regenerate); body grid: **RouteMap** (phase stations along a vertical route line — statuses locked/available/in-progress/done/skipped, per-step Done/Checkpoint) + sidebar: **NextBestAction**, **Simulate** (hours/week slider + destination select → reroute), Strategy card, **HowWeBuilt** (the roadmap rationale: summary/strategy/how).
- **`/gap`** — mastered/partial/missing buckets in learning order with per-skill reasons.
- **`/dashboard`** — day streak, progress metrics, checkpoint average, **Skill passport** (proficiency levels per skill), recent activity (from `Event` rows).
- **`/step/[id]`** — step detail: resource/module content, external link (real URLs only), quiz checkpoint, **FeedbackBar** (too easy/hard/long/not useful/…).

Global components: **TopNav** (logo, Map/Skill Gap/Dashboard pills, Ask, "AI Brain" chip showing provider + availability, theme toggle), **Assistant** (floating Q&A panel), **AiSettings** (provider/model/key/mode + test + save; masked key), **RerouteOverlay** (the animated "recalculating…" moment + What Changed list), `ui.tsx` (Button/Card/Badge/Spinner), `AppChrome`, `useTheme`.

UX concepts: the **navigator metaphor** (route, phases as stations, reroute/recalculate, "You are here"), **Next Best Action** (one concrete step + why), **What Changed** after every reroute, **How we built your path** (transparency of the rationale), **Skill Passport** (levels 0–3: none/aware/working/strong), milestones per phase.

---

## 17. Responsive behavior

One UI across all viewport sizes — **no separate mobile design**. Conventions:

- Content sits in `max-w-6xl` with horizontal page padding; everything else is fluid (`w-full`, flex/grid reflow).
- Navigator body: `grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]` — **single stacked column below 1024px** (map first, then Next Best Action, Simulate, Strategy, How-we-built), two columns at `lg`+ (desktop appearance unchanged). ⚠️ **The `grid-cols-1` base is load-bearing**: `grid` alone auto-places children in implicit side-by-side columns (the desktop layout squashed onto phones) — this exact bug shipped and was fixed; don't remove it.
- TopNav uses `min-h-14 flex-wrap` so the bar reflows to a second row instead of overflowing; labels hide progressively (`hidden md:inline`, `hidden sm:inline`) rather than truncating controls.
- Text-heavy rows use `min-w-0` + `truncate` chains where single-line is intended; card headers `flex-wrap`.
- **No `overflow-x: hidden` anywhere as a fix** — components must actually fit.

`scripts/verify-layout.cjs` enforces all of this in a headless browser (§20). Known constraint to not regress: page-level `scrollWidth` must equal viewport width on every page at 320–1440px.

---

## 18. Theme / visual system

- Design tokens are CSS variables in `src/app/globals.css` (`:root` light: warm paper/ink cartographic palette; `.dark` overrides: dark browns) — mapped into Tailwind classes (`bg-paper`, `text-ink`, `text-route`, `bg-raised`, `border-line`, `text-muted`, `bg-marker-soft`, etc.) via `tailwind.config.ts`. Dark mode is a token swap, **not** an inversion; no hardcoded colors in components.
- Mechanism: a pre-paint inline script in `src/app/layout.tsx` reads `localStorage["skill-atlas-theme"]` and applies `prefers-color-scheme` on first visit (no flash); the toggle (`useTheme.ts`, used by TopNav) flips the `dark` class on `<html>` and persists the choice. Private-mode storage failures degrade gracefully.
- Overlays use `bg-black/40`-style translucency; components that must react to theme should read tokens, never raw colors.

---

## 19. Demo personas

`src/lib/personas.ts`, seeded via `POST /api/seed` / "Try a demo" (idempotent, fixed ids):

| Persona | From → To | What it demonstrates |
|---|---|---|
| 🌱 **Ananya** (`persona-ananya`) | Near-zero coding, final-year student → Data Scientist | Beginner: 5 phases, ~14 skills to learn, project-style learning |
| 📈 **Karthik** (`persona-karthik`) | 2yr Python dev (pandas/SQL/git, shaky stats) → ML Engineer | Partial skills: mastered/partial buckets, deployment-leaning route |
| 🤖 **Elena** (`persona-elena`) | Senior backend (Python/APIs/Docker, no LLM) → AI/LLM Engineer | Advanced: many mastered skills, short LLM-focused route |

They exist for fast demonstration/testing. They differ from real users in that their `targetRole` is an exact catalog role id (confidence 1, no inference) and their known skills are hand-tuned to produce visibly different roadmaps; a real user arrives with free text, gets extraction + goal resolution + (optionally) LLM hints and dynamic skills.

---

## 20. Testing and verification

No unit-test framework. Two Node verification scripts (run with `node scripts/…`; they use only Node stdlib + jiti + the real DB from `.env`):

- **`scripts/verify-ai-wiring.cjs`** — proves the AI layer end-to-end: (1) every provider adapter issues a REAL HTTP call to its own vendor endpoint with the model in the request (fake key → expected vendor auth error IS the proof); (2) a session-scoped fake key → call attempted, graceful fallback + visible note; (3) no session → deterministic, zero network; (4) Gemini adapter diagnoses empty candidates / thought parts / safety blocks; (5) retired-model 404 → one retry with the current default + message; (6) model catalog sanity (≥2 options each, honest cost labels, no retired ids, default listed); (7) real-DB API flow (seed → path/gap/dashboard routes, 404 for unknown learner).
- **`scripts/verify-layout.cjs`** — responsive verification in headless Edge over the Chrome DevTools Protocol (hand-rolled WebSocket client): boots `next dev`, seeds personas + a freshly-onboarded probe learner, drives the app like a user, and FAILs on page-level horizontal overflow, any element outside the viewport, or content clipped inside a card — across phone/tablet/desktop widths (320–1440), a 740×360 landscape check, per-page content assertions from API data, and screenshots into `scripts/shots/`.

**Manual flows after major changes**: onboarding with a plain-English sentence (with and without an AI key configured); "Try a demo" → complete a step → pass/fail a checkpoint → Simulate a reroute → read What Changed; ask the assistant "why this step?"; test an out-of-domain goal ("dancing") with AI off and on; resize desktop → phone continuously on the Navigator.

---

## 21. Deployment

- **Vercel** (no `vercel.json` — default Next.js integration). Production build: `npm run build` = `prisma migrate deploy && next build` (migrations are applied from the build step); `postinstall` runs `prisma generate`.
- **Environment variables by name only**: `DATABASE_URL` (transaction pooler), `DIRECT_URL` (session pooler, migrations); optional `SEARCH_PROVIDER=tavily` + `SEARCH_API_KEY` (external discovery, off unless set). There are deliberately **no AI key env vars in use** — runtime AI config is per-session in the DB (§13). The `LLM_*`/`AI_MODE` block in `.env.example` is stale and ignored by the code.
- Supabase provides the Postgres instance; the app holds no other infrastructure. First deploy of a fresh DB: run `db:deploy` (or rely on the build step) — the schema is a single init migration.
- Considerations: serverless functions must reach Supabase (pooler URLs); AI calls happen server-side only, so vendor egress comes from the deploy region; the app works with zero configured AI keys.

---

## 22. Known limitations / honest caveats

- **Offline skill knowledge is finite** (123 curated skills, 7 roles, archetypes, 56 resources). Unusual goals depend on the LLM hint + dynamic skills; without AI they resolve thinly or are honestly refused.
- **Generated study modules** (layer 3) are derived from graph metadata — structured and on-topic, but less authoritative than curated resources, and have no external link by design.
- **External discovery is off by default** and depends on an optional search key; free search tiers rate-limit.
- **Free/weak models**: small token budgets can truncate JSON (handled as failure with fallback); quality of goal interpretation varies by model.
- **Model deprecation** is mitigated (one retry with the provider default) but the catalog can drift from vendors between updates.
- **Latent bug (known, unfixed)**: a hard refresh directly on a guarded page (`/step/…`, `/navigator`, `/gap`, `/dashboard`) can bounce to home — the `if (!profileId) router.replace("/")` effect occasionally wins the race against zustand persist hydration from localStorage. Client-side navigation (normal usage) is unaffected.
- Demo personas are hand-tuned; real-world goal resolution is only as good as the graph + optional LLM.
- Hackathon MVP scope: no auth/accounts, no i18n, one locale-tolerant prompt (English/Hinglish).

---

## Development Rules

1. **Preserve the deterministic learning backbone.** Prerequisite ordering, gap math, scoring, roadmap ordering, adaptation rules, and quiz keys stay LLM-free and synchronous (`src/lib/domain` has no fetch/DB/React deps — keep it that way).
2. **Don't hardcode careers.** New destinations are goal archetypes (label + anchors) or LLM-inferred dynamic skills — never a duplicated role/skill/resource pile.
3. **Reusable skills over duplication**; prerequisite closure does the expansion.
4. **Never invent URLs.** Links come only from the curated catalog, the canonical registry, or a real search response. The LLM returns skill names, not resources.
5. **Never silently bypass a user-selected working LLM.** If a key exists and mode ≠ demo, the AI-layer tasks call the provider. Fallback only on: no key, demo mode, request failure/timeout, unusable response — and always with a visible note.
6. **Never expose API keys.** Server-side only, masked in the UI, stripped from error messages/logs; never hardcoded, never a default/fallback key.
7. **No global AI configuration.** Config is per anonymous session (`ai_sid` → `AiConfig` row). One visitor must never inherit another's provider.
8. **Keep fallback honest.** A failed provider call is reported as such; deterministic answers are never presented as "the AI said".
9. **Keep LLM calls small**: structured output, tight maxTokens, once-per-flow (goal resolution at onboarding only), last-3-message history.
10. **Preserve the provider abstraction** — new vendor = one adapter + `PROVIDER_META` entry; nothing outside `src/lib/ai` may talk to a vendor.
11. **Goal-change correctness**: known-skill history is preserved; confirmed targets/dynamic skills/goalText are invalidated on retarget; the assistant context must always be rebuilt from current state.
12. **Maintain responsive behavior**: no page-level horizontal overflow at any width; the Navigator grid keeps its `grid-cols-1` base; no `overflow-x: hidden` "fixes"; no separate mobile design. Run `scripts/verify-layout.cjs` after layout changes.
13. **Anonymous by design**: profileId lives in the browser; a stale id must degrade gracefully (404 → re-onboard), never 500.
14. **Avoid unnecessary dependencies/refactors** — plain-`fetch` AI calls, stdlib verification scripts, MVP scope.
15. **Verify existing flows after changes**: `node scripts/verify-ai-wiring.cjs`, `node scripts/verify-layout.cjs`, `npx tsc --noEmit`, plus the manual flows in §20.
