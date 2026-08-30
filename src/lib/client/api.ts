import type {
  GoalResolution,
  LearnerProfile,
  Recommendation,
  Roadmap,
  SkillGap,
} from "@/lib/domain/types";
import type { NavigatorView } from "@/lib/domain/nextAction";
import type { ProfileDraft } from "@/lib/domain/types";
import type { PublicAiStatus } from "@/lib/ai/config";
import type { PublicQuestion } from "@/lib/server/assessment";
import type { ModelOption, ProviderId } from "@/lib/ai/types";

// ── Shared response shapes ────────────────────────────────────────────────────
export interface NavigatorBundle {
  profile: LearnerProfile;
  roadmap: Roadmap | null;
  view: NavigatorView | null;
  gap: SkillGap;
}

export interface AdaptResponse extends NavigatorBundle {
  changes: string[];
  regenerated: boolean;
}

export interface AiStatusResponse {
  status: PublicAiStatus;
  providers: Record<
    ProviderId,
    { label: string; models: ModelOption[]; defaultModel: string; keyHint: string; keyUrl: string; note: string }
  >;
  providerIds: ProviderId[];
}

export interface AiConfigPayload {
  provider: ProviderId;
  model?: string;
  apiKey?: string;
  mode?: "hybrid" | "ai" | "demo";
  enabled?: boolean;
}

export interface PersonaMeta {
  id: string;
  name: string;
  emoji: string;
  headline: string;
  targetRole: string;
  sampleOnboardingText: string;
}

/** A target skill the goal resolver inferred, shown on the confirmation screen. */
export interface TargetSkill {
  skillId: string;
  name: string;
  domain: string;
  targetLevel: number;
}

export interface GoalResolveResponse {
  resolution: GoalResolution;
  source: "llm" | "fallback";
  provider?: string;
  /** Set when a configured provider was tried but the call failed. */
  note?: string;
  /** AI-inferred skills outside the catalog — persisted with the profile. */
  dynamicSkills: { id?: string; name: string; domain?: string; description?: string; tier?: number }[];
  targets: TargetSkill[];
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let json: { ok: boolean; data?: T; error?: string };
  try {
    json = await res.json();
  } catch {
    throw new Error(`Request failed (${res.status}).`);
  }
  if (!res.ok || !json.ok) throw new Error(json.error || `Request failed (${res.status}).`);
  return json.data as T;
}

const post = <T>(path: string, body: unknown) =>
  req<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });

export const api = {
  // Onboarding & profile
  onboard: (text: string) =>
    post<{
      draft: ProfileDraft;
      source: "llm" | "fallback";
      provider?: string;
      note?: string;
      aiStatus: PublicAiStatus;
      resolution: GoalResolution;
      dynamicSkills: { id?: string; name: string; domain?: string; description?: string; tier?: number }[];
      targets: TargetSkill[];
    }>("/api/onboard", { text }),
  resolveGoal: (text: string, targetRole?: string) =>
    post<GoalResolveResponse>("/api/goal/resolve", { text, targetRole }),
  createProfile: (input: Record<string, unknown>) =>
    post<NavigatorBundle & { view: NavigatorView }>("/api/profile", input),
  getProfileBundle: (id: string) => req<NavigatorBundle>(`/api/profile/${id}`),
  updateProfile: (id: string, patch: Record<string, unknown>) =>
    req<NavigatorBundle>(`/api/profile/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteProfile: (id: string) => req<{ deleted: string }>(`/api/profile/${id}`, { method: "DELETE" }),

  // Path & navigator
  getNavigator: (profileId: string) => req<NavigatorBundle>(`/api/path/${profileId}`),
  regeneratePath: (profileId: string) =>
    post<{ roadmap: Roadmap; gap: SkillGap; view: NavigatorView }>("/api/path/generate", { profileId }),

  // Steps
  completeStep: (profileId: string, stepId: string) =>
    post<AdaptResponse>("/api/step/complete", { profileId, stepId }),
  skipStep: (profileId: string, stepId: string) =>
    post<AdaptResponse>("/api/step/skip", { profileId, stepId }),

  // Assessment
  getQuiz: (profileId: string, stepId: string) =>
    req<{ questions: PublicQuestion[]; skillIds: string[] }>(
      `/api/quiz?profileId=${encodeURIComponent(profileId)}&stepId=${encodeURIComponent(stepId)}`,
    ),
  submitAssessment: (
    profileId: string,
    stepId: string,
    answers: { questionId: string; choiceIndex: number }[],
  ) =>
    post<AdaptResponse & { scorePct: number; correct: number; total: number }>("/api/assessment/submit", {
      profileId,
      stepId,
      answers,
    }),

  // Adaptation
  feedback: (payload: { profileId: string; signal: string; stepId?: string; resourceId?: string }) =>
    post<AdaptResponse>("/api/feedback", payload),
  simulate: (payload: { profileId: string; weeklyHours?: number; targetRole?: string }) =>
    post<AdaptResponse>("/api/simulate", payload),

  // Insight
  dashboard: (profileId: string) => req<DashboardData>(`/api/dashboard/${profileId}`),
  skillGap: (profileId: string) =>
    req<{
      gap: SkillGap;
      recommendations: Recommendation[];
      discovery?: {
        catalog: number;
        canonical: number;
        external: number;
        generated: number;
        skillsCovered: number;
        skillsGeneratedOnly: string[];
      };
    }>(`/api/skill-gap/${profileId}`),
  assistant: (
    profileId: string | null,
    question: string,
    history: { role: "user" | "assistant"; text: string }[] = [],
  ) =>
    post<{
      text: string;
      source: "llm" | "fallback";
      provider?: string;
      note?: string;
      aiStatus: PublicAiStatus;
    }>("/api/assistant", { profileId: profileId ?? undefined, question, history }),

  // Personas
  listPersonas: () => req<{ personas: PersonaMeta[] }>("/api/seed"),
  seed: () => post<{ personas: SeededPersona[] }>("/api/seed", {}),

  // AI settings
  getAiConfig: () => req<AiStatusResponse>("/api/ai/config"),
  saveAiConfig: (input: AiConfigPayload) => post<{ status: PublicAiStatus }>("/api/ai/config", input),
  testAi: (input: AiConfigPayload) =>
    post<{ ok: boolean; message: string; latencyMs?: number; model?: string }>("/api/ai/test", input),
};

export interface SeededPersona {
  id: string;
  name: string;
  emoji: string;
  headline: string;
  roleName: string;
  phaseCount: number;
  missing: number;
  partial: number;
  mastered: number;
}

export interface DashboardData {
  profileName: string;
  roleName: string;
  progress: NavigatorView["progress"];
  skills: { atTarget: number; partial: number; missing: number; totalTarget: number; masteredNames: string[] };
  phases: { total: number; done: number; currentTitle: string | null };
  checkpoints: { taken: number; averageScore: number | null };
  completedCount: number;
  streakDays: number;
  weeklyHours: number;
  nextAction: { title: string; why: string; stepId: string } | null;
  passport: { skillId: string; name: string }[];
  activity: { id: string; type: string; label: string; at: string }[];
}
