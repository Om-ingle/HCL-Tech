import type {
  KnownSkill,
  LearnerProfile,
  Preferences,
  Roadmap,
  RoadmapRationale,
  Difficulty,
  LearningStyle,
} from "@/lib/domain/types";

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// Minimal shape of the Prisma LearnerProfile row we depend on.
interface ProfileRow {
  id: string;
  name: string;
  targetRole: string;
  goalText: string;
  experienceLevel: string;
  learningStyle: string;
  weeklyHours: number;
  timelineWeeks: number;
  careerOutcome: string;
  interests: string;
  knownSkills: string;
  preferences: string;
  ownerId?: string | null;
}

export function profileFromRow(row: ProfileRow): LearnerProfile {
  return {
    id: row.id,
    name: row.name,
    targetRole: row.targetRole,
    goalText: row.goalText ?? "",
    experienceLevel: (row.experienceLevel ?? "beginner") as Difficulty,
    learningStyle: (row.learningStyle ?? "mixed") as LearningStyle,
    weeklyHours: row.weeklyHours ?? 8,
    timelineWeeks: row.timelineWeeks ?? 24,
    careerOutcome: row.careerOutcome ?? "",
    interests: safeParse<string[]>(row.interests, []),
    knownSkills: safeParse<KnownSkill[]>(row.knownSkills, []),
    preferences: safeParse<Preferences>(row.preferences, {}),
    ownerId: row.ownerId ?? null,
  };
}

export function profileToRow(profile: LearnerProfile) {
  return {
    name: profile.name,
    targetRole: profile.targetRole,
    goalText: profile.goalText,
    experienceLevel: profile.experienceLevel,
    learningStyle: profile.learningStyle,
    weeklyHours: profile.weeklyHours,
    timelineWeeks: profile.timelineWeeks,
    careerOutcome: profile.careerOutcome,
    interests: JSON.stringify(profile.interests ?? []),
    knownSkills: JSON.stringify(profile.knownSkills ?? []),
    preferences: JSON.stringify(profile.preferences ?? {}),
    ...(profile.ownerId !== undefined ? { ownerId: profile.ownerId } : {}),
  };
}

export function roadmapFromRow(row: { version: number; phases: string; rationale: string }): Roadmap {
  return {
    version: row.version,
    phases: safeParse(row.phases, []),
    rationale: safeParse<RoadmapRationale>(row.rationale, {
      targetRole: "",
      summary: "",
      strategy: "",
      gapCounts: { mastered: 0, partial: 0, missing: 0 },
    }),
  };
}
