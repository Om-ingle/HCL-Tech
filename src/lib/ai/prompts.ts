import type { JsonSchema, LLMRequest, StructuredRequest } from "./types";

// ── Profile extraction ────────────────────────────────────────────────────────
export const EXTRACT_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "the learner's first name if stated" },
    targetRole: {
      type: "string",
      description:
        "closest of: Data Scientist, Machine Learning Engineer, AI / LLM Engineer, Backend Software Engineer, Cloud Engineer, Data Analyst, Cybersecurity Analyst — or a short free-text role",
    },
    experienceLevel: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    learningStyle: { type: "string", enum: ["video", "reading", "project", "mixed"] },
    weeklyHours: { type: "integer", description: "hours available to study per week" },
    timelineWeeks: { type: "integer", description: "target timeline in weeks (months × 4)" },
    careerOutcome: { type: "string" },
    interests: { type: "array", items: { type: "string" } },
    knownSkills: {
      type: "array",
      items: { type: "string" },
      description: "specific skills/technologies the learner already has, e.g. Python, SQL, statistics",
    },
  },
};

const EXTRACT_SYSTEM = `You are the onboarding assistant for a personalized learning-path app.
Extract a structured learner profile from the user's message.
Rules:
- The learner may write in English, Hinglish (mixed Hindi-English, e.g. "mujhe data science mein career banana hai"), or anything in between — understand it like a normal Indian English speaker would.
- Only include fields you are reasonably confident about; omit the rest.
- knownSkills: concrete skills/tools the learner ALREADY has (not what they want to learn).
- Convert timelines to weeks (e.g. "6 months" → 24).
- Do not invent details that aren't implied.`;

export function buildExtractionRequest(text: string): StructuredRequest {
  return {
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: text }],
    temperature: 0.1,
    maxTokens: 1500,
    schema: EXTRACT_SCHEMA,
    schemaName: "LearnerProfileDraft",
  };
}

// ── Goal resolution ───────────────────────────────────────────────────────────
// The ONLY structured LLM call in the open-goal flow. It returns a goal label, a
// domain, and candidate SKILL NAMES — never resources, never URLs, never a
// roadmap. Everything it returns is validated against our skill graph, so a
// hallucinated skill simply doesn't resolve and is dropped.
export const GOAL_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    goal: {
      type: "string",
      description: 'short canonical name for the goal, e.g. "Linux Kernel Developer" or "Battery Chemistry & Electrochemistry"',
    },
    domain: {
      type: "string",
      description:
        "one broad field — ANY field of study is valid (Systems, Robotics, Chemistry, Energy Storage, Music, Epidemiology, Machine Learning, …)",
    },
    candidateSkills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "short concrete skill/topic name, e.g. Electrochemistry" },
          blurb: { type: "string", description: "one line (≤ 20 words) on what this skill involves" },
        },
        required: ["name"],
      },
      description:
        "6-12 concrete skills this goal requires, foundational → advanced. Plain strings are also accepted.",
    },
  },
};

const GOAL_SYSTEM = `You map a learner's stated goal onto the skills it requires.
Rules:
- The learner may write in English, Hinglish, or mixed Hindi-English ("mujhe battery technology samajhni hai") — interpret the goal as intended.
- ANY field of study is valid — battery chemistry, archaeology, music theory — not just software. Infer the domain honestly.
- Return ONLY skill/topic names (subjects, techniques, technologies). Short noun phrases.
- Do NOT return courses, books, websites, URLs, links, providers, or a study plan.
- Do NOT return soft skills (communication, teamwork) or job titles.
- Include the foundations the goal genuinely depends on, not just the advanced topics.
- If the goal is vague, infer the most standard interpretation and say so in "goal".`;

export function buildGoalRequest(goalText: string): StructuredRequest {
  return {
    system: GOAL_SYSTEM,
    messages: [{ role: "user", content: `My goal: ${goalText}` }],
    temperature: 0.1,
    // Reasoning-style models spend output tokens on thinking before the JSON —
    // a small budget truncates the object mid-brace and the whole call is lost.
    maxTokens: 1500,
    schema: GOAL_SCHEMA,
    schemaName: "GoalSkills",
  };
}

// ── Assistant Q&A ─────────────────────────────────────────────────────────────
export interface AssistantContext {
  profileName: string;
  roleName: string;
  experienceLevel: string;
  weeklyHours: number;
  masteredCount: number;
  partialCount: number;
  missingCount: number;
  topGaps: string[];
  currentPhase: string | null;
  nextActionTitle: string | null;
  nextActionWhy: string | null;
  overallPct: number;
  estimatedWeeksLeft: number;
}

export function contextToText(ctx: AssistantContext): string {
  return [
    `Learner: ${ctx.profileName}`,
    `Target role: ${ctx.roleName}`,
    `Experience: ${ctx.experienceLevel}, ${ctx.weeklyHours}h/week`,
    `Skills — mastered: ${ctx.masteredCount}, partial: ${ctx.partialCount}, missing: ${ctx.missingCount}`,
    ctx.topGaps.length ? `Top current gaps: ${ctx.topGaps.join(", ")}` : "",
    `Overall progress: ${ctx.overallPct}% · ~${ctx.estimatedWeeksLeft} weeks left`,
    ctx.currentPhase ? `Current phase: ${ctx.currentPhase}` : "",
    ctx.nextActionTitle ? `Next best action: ${ctx.nextActionTitle} — ${ctx.nextActionWhy ?? ""}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const ASSISTANT_SYSTEM = `You are the learner's AI Navigator inside a personalized learning-path app.
Answer in 2–5 sentences, warm but concise. Reply in plain English even if the learner writes in Hinglish or mixed Hindi-English — match their language only if they clearly prefer it.
Use ONLY the provided learner context — reference their real role, skills, phase, and next action.
The messages before the final question are the recent conversation; use them to resolve short follow-ups ("why?", "after that?", "can I skip it?").
If they ask to change the plan (shorten it, change goal, change hours), explain what would change and mention they can apply it with the app's controls (Simulate / feedback / checkpoints). Never invent resources or scores.`;

export interface AssistantHistoryMessage {
  role: "user" | "assistant";
  text: string;
}

export function buildAssistantRequest(
  question: string,
  ctx: AssistantContext,
  history: AssistantHistoryMessage[] = [],
): LLMRequest {
  // Only the last 3 turns — enough for "why this?" / "can I skip it?" follow-ups
  // while keeping tokens (and cost) minimal. Provider-side memory is never assumed.
  const recent = history.slice(-3);
  return {
    system: ASSISTANT_SYSTEM,
    messages: [
      ...recent.map((m) => ({ role: m.role, content: m.text })),
      { role: "user", content: `Here is my learning context:\n${contextToText(ctx)}\n\nMy question: ${question}` },
    ],
    temperature: 0.4,
    maxTokens: 900,
  };
}
