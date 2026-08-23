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
- Only include fields you are reasonably confident about; omit the rest.
- knownSkills: concrete skills/tools the learner ALREADY has (not what they want to learn).
- Convert timelines to weeks (e.g. "6 months" → 24).
- Do not invent details that aren't implied.`;

export function buildExtractionRequest(text: string): StructuredRequest {
  return {
    system: EXTRACT_SYSTEM,
    messages: [{ role: "user", content: text }],
    temperature: 0.1,
    maxTokens: 700,
    schema: EXTRACT_SCHEMA,
    schemaName: "LearnerProfileDraft",
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
Answer in 2–5 sentences, warm but concise. Use ONLY the provided learner context — reference their real role, skills, phase, and next action.
If they ask to change the plan (shorten it, change goal, change hours), explain what would change and mention they can apply it with the app's controls (Simulate / feedback / checkpoints). Never invent resources or scores.`;

export function buildAssistantRequest(question: string, ctx: AssistantContext): LLMRequest {
  return {
    system: ASSISTANT_SYSTEM,
    messages: [
      { role: "user", content: `Here is my learning context:\n${contextToText(ctx)}\n\nMy question: ${question}` },
    ],
    temperature: 0.4,
    maxTokens: 400,
  };
}
