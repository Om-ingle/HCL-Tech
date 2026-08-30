import { z } from "zod";

export const difficultyEnum = z.enum(["beginner", "intermediate", "advanced"]);
export const styleEnum = z.enum(["video", "reading", "project", "mixed"]);

export const onboardSchema = z.object({
  text: z.string().min(1).max(4000),
});

// Resolve a free-text goal to target skills (open-goal confirmation screen).
export const goalResolveSchema = z.object({
  text: z.string().min(1).max(4000),
  targetRole: z.string().max(120).optional(),
});

export const knownSkillSchema = z.object({
  skillId: z.string(),
  proficiency: z.number().int().min(0).max(3),
});

// Create / replace a profile (used after the user confirms the extracted draft).
export const profileInputSchema = z.object({
  name: z.string().min(1).max(80).default("Learner"),
  targetRole: z.string().min(1).max(120),
  goalText: z.string().max(4000).default(""),
  experienceLevel: difficultyEnum.default("beginner"),
  learningStyle: styleEnum.default("mixed"),
  weeklyHours: z.number().int().min(1).max(60).default(8),
  timelineWeeks: z.number().int().min(2).max(104).default(24),
  careerOutcome: z.string().max(500).default(""),
  interests: z.array(z.string().max(60)).max(30).default([]),
  knownSkillIds: z.array(z.string()).max(80).default([]),
  knownSkills: z.array(knownSkillSchema).max(80).optional(),
  /** Learner-confirmed target skills from the goal-confirmation screen. */
  targetSkillIds: z.array(z.string()).max(60).optional(),
  /** AI-inferred skills outside the catalog, to be registered + persisted. */
  dynamicSkills: z
    .array(
      z.object({
        id: z.string().max(80).optional(),
        name: z.string().min(1).max(80),
        domain: z.string().max(60).default("Custom"),
        description: z.string().max(400).optional(),
        tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
      }),
    )
    .max(40)
    .optional(),
});

export const profileUpdateSchema = profileInputSchema.partial().extend({
  id: z.string(),
});

export const stepActionSchema = z.object({
  profileId: z.string(),
  stepId: z.string(),
});

export const assessmentSubmitSchema = z.object({
  profileId: z.string(),
  stepId: z.string(),
  answers: z.array(z.object({ questionId: z.string(), choiceIndex: z.number().int() })),
});

export const feedbackSchema = z.object({
  profileId: z.string(),
  signal: z.enum([
    "too_easy",
    "too_hard",
    "too_long",
    "not_useful",
    "very_useful",
    "interested",
    "need_practice",
  ]),
  stepId: z.string().optional(),
  resourceId: z.string().optional(),
});

export const simulateSchema = z
  .object({
    profileId: z.string(),
    weeklyHours: z.number().int().min(1).max(60).optional(),
    targetRole: z.string().optional(),
  })
  .refine((d) => d.weeklyHours !== undefined || d.targetRole !== undefined, {
    message: "Provide weeklyHours or targetRole",
  });

export const assistantSchema = z.object({
  profileId: z.string().optional(),
  question: z.string().min(1).max(2000),
  // Short-term memory: the client sends only the last few turns so follow-ups
  // ("why this?", "can I skip it?") resolve without re-sending the chat log.
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(2000),
      }),
    )
    .max(6)
    .optional(),
});

export const aiConfigSchema = z.object({
  provider: z.enum(["gemini", "openrouter", "claude", "grok"]),
  model: z.string().max(120).default(""),
  apiKey: z.string().max(400).optional(),
  mode: z.enum(["hybrid", "ai", "demo"]).default("hybrid"),
  enabled: z.boolean().default(true),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type AiConfigInput = z.infer<typeof aiConfigSchema>;
