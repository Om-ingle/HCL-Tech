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
  | "exercise"
  | "module"; // generated learning module (Layer 3 of resource discovery)

// ── Static catalog shapes ─────────────────────────────────────────────────────
export interface Skill {
  id: string;
  name: string;
  domain: string;
  tier: SkillTier; // rough learning order within a domain (1 = foundational)
  prerequisites: string[]; // skill ids
  description: string;
  aliases?: string[]; // synonyms/tech names used to resolve free-text goals
  related?: string[]; // sibling skills — expands an under-specified goal
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

/** Where a resource came from. Only `generated` has no external URL. */
export type ResourceOrigin = "catalog" | "canonical" | "search" | "generated";

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
  /** Real, discovered URL. Absent for generated modules — never invented. */
  url?: string;
  tags: string[];
  provider?: string;
  origin?: ResourceOrigin;
  concepts?: string[]; // syllabus outline (generated modules)
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
  /** Learner-confirmed target skills — overrides goal inference when present. */
  targetSkillIds?: string[];
  /** LLM-inferred skills that aren't in the curated catalog, persisted so they
   *  survive restarts and re-registration on every profile load. */
  dynamicSkills?: DynamicSkillDef[];
}

/** A skill the AI inferred for a goal outside the curated catalog. */
export interface DynamicSkillDef {
  id?: string; // dyn-<slug>, stable across processes; derived from name when absent
  name: string;
  domain: string;
  description?: string; // one line from the LLM, used by generated modules
  tier?: SkillTier;
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

// ── Open-goal resolution ─────────────────────────────────────────────────────
// How an arbitrary natural-language goal became a concrete target skill set.
export type GoalMethod =
  | "role" // matched a predefined role
  | "archetype" // matched a known goal archetype (kernel dev, quant, …)
  | "terms" // inferred from skill names/aliases in the text
  | "domain" // inferred from a domain keyword
  | "llm" // LLM proposed skills (always validated against the graph)
  | "starter"; // nothing recognized — foundational starter route

export interface GoalResolution {
  goalText: string;
  label: string; // human-readable destination, e.g. "Linux Kernel Developer"
  domain: string; // primary domain
  domains: string[]; // all domains touched, most relevant first
  roleId: string | null; // set only when a predefined role matched
  targets: RoleTargetSkill[]; // seed targets (before prerequisite expansion)
  methods: GoalMethod[]; // every signal that contributed, strongest first
  matchedTerms: string[]; // phrases we understood
  unknownTerms: string[]; // phrases we could not map — used to bias discovery
  confidence: number; // 0..1, drives how loudly the UI asks for confirmation
  notes: string[]; // "how we read your goal" provenance lines
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
  resolution?: GoalResolution; // how an open goal was interpreted
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
  /** "How we built your path" — plain-language provenance for the route. */
  how?: string[];
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
