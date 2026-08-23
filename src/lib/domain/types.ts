// ── Core domain types (framework-free, no LLM/DB deps) ────────────────────────

export type SkillTier = 1 | 2 | 3 | 4 | 5;
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type LearningStyle = "video" | "reading" | "project" | "mixed";
export type ResourceType =
  | "course"
  | "tutorial"
  | "documentation"
  | "book"
  | "project"
  | "assessment"
  | "exercise";

// ── Static catalog shapes ─────────────────────────────────────────────────────
export interface Skill {
  id: string;
  name: string;
  domain: string;
  tier: SkillTier; // rough learning order within a domain (1 = foundational)
  prerequisites: string[]; // skill ids
  description: string;
}

export interface RoleTargetSkill {
  skillId: string;
  targetLevel: number; // 1 aware, 2 working, 3 strong
}

export interface Role {
  id: string;
  name: string;
  domain: string;
  blurb: string;
  aliases: string[]; // for fuzzy goal → role matching
  targetSkills: RoleTargetSkill[];
}

export interface Resource {
  id: string;
  title: string;
  type: ResourceType;
  domain: string;
  difficulty: Difficulty;
  skills: string[]; // skills taught
  prerequisites: string[]; // skill ids expected beforehand
  durationHours: number;
  description: string;
  url: string;
  tags: string[];
  provider?: string;
}

export interface QuizQuestion {
  id: string;
  skillId: string;
  question: string;
  options: string[];
  answerIndex: number;
}

// ── Learner ───────────────────────────────────────────────────────────────────
export interface KnownSkill {
  skillId: string;
  proficiency: number; // 0 none, 1 aware, 2 working, 3 strong
}

export interface Preferences {
  domainBias?: Record<string, number>;
  typeBias?: Partial<Record<ResourceType, number>>;
  difficultyBias?: number; // -1 prefers easier … +1 prefers harder
  dislikedResourceIds?: string[];
}

export interface LearnerProfile {
  id: string;
  name: string;
  targetRole: string; // role id or free text
  goalText: string;
  experienceLevel: Difficulty;
  learningStyle: LearningStyle;
  weeklyHours: number;
  timelineWeeks: number;
  careerOutcome: string;
  interests: string[];
  knownSkills: KnownSkill[];
  preferences: Preferences;
}

// A partial profile produced by extraction (LLM or fallback), before confirm.
export interface ProfileDraft {
  name?: string;
  targetRole?: string;
  targetRoleId?: string;
  goalText?: string;
  experienceLevel?: Difficulty;
  learningStyle?: LearningStyle;
  weeklyHours?: number;
  timelineWeeks?: number;
  careerOutcome?: string;
  interests?: string[];
  knownSkillIds?: string[];
  extractionSource?: "llm" | "fallback";
  notes?: string[];
}

// ── Skill-gap analysis ──────────────────────────────────────────────────────
export type GapStatus = "mastered" | "partial" | "missing";

export interface SkillGapItem {
  skillId: string;
  name: string;
  domain: string;
  tier: SkillTier;
  status: GapStatus;
  proficiency: number;
  targetLevel: number;
  prerequisites: string[];
  reason: string;
}

export interface SkillGap {
  roleId: string | null;
  roleName: string;
  mastered: SkillGapItem[];
  partial: SkillGapItem[];
  missing: SkillGapItem[];
  orderedSkillIds: string[]; // topologically sorted learning order for gaps
}

// ── Recommendations ─────────────────────────────────────────────────────────
export interface ScoreFactor {
  key: string;
  label: string;
  contribution: number; // signed points added to the score
  note: string;
}

export interface Recommendation {
  resource: Resource;
  score: number;
  factors: ScoreFactor[];
  why: string;
  targetsSkills: string[];
}

// ── Roadmap ───────────────────────────────────────────────────────────────────
export type StepKind = "resource" | "project" | "assessment";
export type StepStatus =
  | "locked"
  | "available"
  | "in_progress"
  | "completed"
  | "skipped";

export interface Step {
  id: string;
  kind: StepKind;
  resourceId?: string;
  title: string;
  type: ResourceType;
  skillIds: string[];
  prerequisiteStepIds: string[];
  durationHours: number;
  difficulty: Difficulty;
  why: string;
  description: string;
  url?: string;
}

export interface Phase {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  skillIds: string[];
  concepts: string[];
  steps: Step[];
  milestone: string;
  estimatedWeeks: number;
  prerequisitePhaseIds: string[];
}

export interface RoadmapRationale {
  targetRole: string;
  summary: string;
  strategy: string;
  gapCounts: { mastered: number; partial: number; missing: number };
}

export interface Roadmap {
  version: number;
  phases: Phase[];
  rationale: RoadmapRationale;
}

// Step merged with its persisted state, plus computed unlock info.
export interface HydratedStep extends Step {
  status: StepStatus;
  score?: number | null;
  phaseId: string;
  phaseIndex: number;
}
