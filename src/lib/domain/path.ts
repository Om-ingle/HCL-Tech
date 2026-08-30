import { SKILL_BY_ID, skillName } from "@/lib/catalog";
import { buildPool, type ResourcePool } from "@/lib/discovery";
import type {
  Difficulty,
  LearnerProfile,
  Phase,
  Resource,
  Roadmap,
  RoadmapRationale,
  SkillGap,
  Step,
} from "./types";
import { buildContext, buildWhy, scoreResource, type RecommendContext } from "./recommend";
import { hasAssessment } from "./quizGen";
import { prerequisiteNotes } from "./skillGap";

// Domain-specific phrasing where we have it; every other domain (including any
// added later) falls back to a generated title/milestone, so the roadmap is
// never blocked on someone authoring copy for a new area.
const PHASE_TITLES: Record<string, string> = {
  Programming: "Programming Foundations",
  "Computer Science": "Core CS Foundations",
  Math: "Mathematics for the Path",
  Data: "Data Foundations",
  "Machine Learning": "Machine Learning Core",
  MLOps: "Deployment & MLOps",
  Software: "Software Engineering",
  Cloud: "Cloud & DevOps",
  "AI & LLMs": "AI & LLM Engineering",
  Security: "Security Core",
  Systems: "Systems & Low-Level Foundations",
  Robotics: "Robotics & Control",
  Embedded: "Embedded & Firmware",
  Graphics: "Graphics & Real-Time Rendering",
  "Quantitative Finance": "Quantitative Finance",
  "Quantum Computing": "Quantum Computing",
};

const MILESTONES: Record<string, string> = {
  Programming: "Write clean programs and use version control confidently.",
  "Computer Science": "Reason about complexity and pick the right data structure.",
  Math: "Hold the math intuition that the rest of the path builds on.",
  Data: "Load, clean, and explore real datasets end-to-end.",
  "Machine Learning": "Train, evaluate, and reason about ML models.",
  MLOps: "Deploy and operate a model behind a real API.",
  Software: "Design and ship reliable APIs and services.",
  Cloud: "Containerize and run workloads in the cloud.",
  "AI & LLMs": "Build grounded, evaluated LLM applications.",
  Security: "Identify, model, and respond to real threats.",
  Systems: "Read and write code that talks directly to the machine.",
  Robotics: "Close a sense–plan–act loop on a real or simulated robot.",
  Embedded: "Ship firmware that meets timing and power budgets.",
  Graphics: "Put pixels on screen through a pipeline you understand.",
  "Quantitative Finance": "Take a strategy from idea to honest backtest.",
  "Quantum Computing": "Build, run, and reason about quantum circuits.",
};

function phaseTitle(domain: string, part = 0, parts = 1): string {
  const base = PHASE_TITLES[domain] ?? `${domain} Track`;
  if (parts <= 1) return base;
  return part === 0 ? base : `${base} — Going Deeper`;
}

function milestoneFor(domain: string, skillIds: string[]): string {
  const authored = MILESTONES[domain];
  if (authored) return authored;
  const top = skillIds
    .map((id) => SKILL_BY_ID[id])
    .filter(Boolean)
    .sort((a, b) => b!.tier - a!.tier)[0];
  return top
    ? `Apply ${domain} skills in practice, up to ${top.name}.`
    : `Apply ${domain} skills in practice.`;
}

/** Group ordered gap skills into coherent phases (one per domain run, split if large). */
function groupIntoPhases(
  orderedSkillIds: string[],
): { domain: string; skillIds: string[]; part: number; parts: number }[] {
  const byDomain = new Map<string, string[]>();
  const firstSeen = new Map<string, number>();
  orderedSkillIds.forEach((id, i) => {
    const d = SKILL_BY_ID[id]?.domain ?? "General";
    if (!byDomain.has(d)) {
      byDomain.set(d, []);
      firstSeen.set(d, i);
    }
    byDomain.get(d)!.push(id);
  });
  return Array.from(byDomain.entries())
    .sort((a, b) => (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0))
    .flatMap(([domain, ids]) => {
      if (ids.length <= 5) return [{ domain, skillIds: ids, part: 0, parts: 1 }];
      // split oversized domains into balanced halves
      const mid = Math.ceil(ids.length / 2);
      return [
        { domain, skillIds: ids.slice(0, mid), part: 0, parts: 2 },
        { domain, skillIds: ids.slice(mid), part: 1, parts: 2 },
      ];
    });
}

function bestResourceForSkill(
  skillId: string,
  ctx: RecommendContext,
  used: Set<string>,
  pool: ResourcePool,
): Resource | undefined {
  const candidates = pool.forSkill(skillId).filter((r) => !used.has(r.id));
  if (candidates.length === 0) return undefined;
  return candidates
    .map((r) => ({ r, score: scoreResource(r, ctx).score }))
    .sort((a, b) => b.score - a.score)[0].r;
}

function difficultyForTier(tier: number): Difficulty {
  return tier <= 2 ? "beginner" : tier <= 3 ? "intermediate" : "advanced";
}

function resourceStep(resource: Resource, ctx: RecommendContext): Step {
  const res = scoreResource(resource, ctx);
  const generated = resource.origin === "generated";
  return {
    id: `step-res-${resource.id}`,
    kind: resource.type === "project" || resource.type === "exercise" ? "project" : "resource",
    resourceId: resource.id,
    title: resource.title,
    type: resource.type,
    skillIds: resource.skills,
    prerequisiteStepIds: [],
    durationHours: resource.durationHours,
    difficulty: resource.difficulty,
    why: generated
      ? `No vetted external resource covers ${resource.skills.map(skillName).join(", ")} yet, so this is a structured module built from the skill graph.`
      : buildWhy(res.factors, res.targets),
    description: resource.concepts?.length
      ? `${resource.description}\n\nCovers:\n${resource.concepts.map((c) => `• ${c}`).join("\n")}`
      : resource.description,
    url: resource.url,
  };
}

export interface RoadmapOptions {
  /** Pre-built discovery pool. Built from the gap skills when omitted. */
  pool?: ResourcePool;
}

export function generateRoadmap(
  profile: LearnerProfile,
  gap: SkillGap,
  version: number,
  opts: RoadmapOptions = {},
): Roadmap {
  // Planning context: never exclude by completion — the roadmap is the plan;
  // StepState tracks what's done. Keeps the plan stable across regenerations.
  const ctx = buildContext(profile, gap);
  const pool =
    opts.pool ?? buildPool(gap.orderedSkillIds, { level: profile.experienceLevel });
  const groups = groupIntoPhases(gap.orderedSkillIds);
  const usedResources = new Set<string>();
  const phases: Phase[] = [];
  const weekly = Math.max(profile.weeklyHours || 6, 3);
  const uncovered: string[] = [];

  groups.forEach((group, index) => {
    const steps: Step[] = [];
    const resourceStepIds: string[] = [];

    // one resource per gap skill (deduped globally)
    for (const skillId of group.skillIds) {
      const resource = bestResourceForSkill(skillId, ctx, usedResources, pool);
      if (!resource) {
        uncovered.push(skillId);
        continue;
      }
      usedResources.add(resource.id);
      const step = resourceStep(resource, ctx);
      steps.push(step);
      resourceStepIds.push(step.id);
    }

    // a hands-on project for the phase — authored if one fits, else generated
    // from the skill's project ladder at the learner's level
    const project = pool.projectFor(group.skillIds, profile.experienceLevel);
    if (project && !usedResources.has(project.id)) {
      usedResources.add(project.id);
      const step = resourceStep(project, ctx);
      step.kind = "project";
      step.prerequisiteStepIds = [...resourceStepIds];
      steps.push(step);
    }

    // a checkpoint assessment (graph-generated when no curated quiz exists)
    const assessSkills = group.skillIds.filter((s) => hasAssessment(s));
    const assessment: Step = {
      id: `p${index}-assessment`,
      kind: "assessment",
      title: `Checkpoint: ${phaseTitle(group.domain, group.part, group.parts)}`,
      type: "assessment",
      skillIds: assessSkills.length ? assessSkills : group.skillIds,
      prerequisiteStepIds: [...resourceStepIds],
      durationHours: 1,
      difficulty: difficultyForTier(Math.max(...group.skillIds.map((s) => SKILL_BY_ID[s]?.tier ?? 3))),
      why: "Confirms you're ready to move on — and unlocks adaptive shortcuts if you ace it.",
      description: `A short check on ${group.skillIds.map(skillName).slice(0, 3).join(", ")}.`,
    };
    steps.push(assessment);

    const totalHours = steps.reduce((s, st) => s + st.durationHours, 0);
    phases.push({
      id: `phase-${index}`,
      index,
      title: phaseTitle(group.domain, group.part, group.parts),
      subtitle: `${group.skillIds.length} skill${group.skillIds.length > 1 ? "s" : ""} · ${group.skillIds.map(skillName).slice(0, 3).join(", ")}`,
      skillIds: group.skillIds,
      concepts: group.skillIds.map(skillName),
      steps,
      milestone: milestoneFor(group.domain, group.skillIds),
      estimatedWeeks: Math.max(1, Math.ceil(totalHours / weekly)),
      prerequisitePhaseIds: [],
    });
  });

  // wire cross-phase prerequisites: a phase depends on earlier phases that
  // teach any prerequisite of its skills.
  const phaseOfSkill = new Map<string, string>();
  phases.forEach((p) => p.skillIds.forEach((s) => phaseOfSkill.set(s, p.id)));
  phases.forEach((p) => {
    const prePhases = new Set<string>();
    for (const s of p.skillIds) {
      for (const pre of SKILL_BY_ID[s]?.prerequisites ?? []) {
        const owner = phaseOfSkill.get(pre);
        if (owner && owner !== p.id) prePhases.add(owner);
      }
    }
    p.prerequisitePhaseIds = Array.from(prePhases);
  });

  // Capstone phase
  const capstoneIndex = phases.length;
  const capstoneSkills = gap.orderedSkillIds
    .map((id) => SKILL_BY_ID[id])
    .filter(Boolean)
    .sort((a, b) => b!.tier - a!.tier)
    .slice(0, 3)
    .map((s) => s!.id);
  phases.push({
    id: `phase-${capstoneIndex}`,
    index: capstoneIndex,
    title: "Capstone & Portfolio",
    subtitle: `Prove you're ${gap.roleName}-ready`,
    skillIds: [],
    concepts: ["Integration", "Portfolio", "Communication"],
    steps: [
      {
        id: "capstone-project",
        kind: "project",
        title: `Capstone: a portfolio project for ${gap.roleName}`,
        type: "project",
        skillIds: capstoneSkills,
        prerequisiteStepIds: [],
        durationHours: 20,
        difficulty: "advanced",
        why: `Ties every phase together into one artifact that demonstrates ${gap.roleName} skills to employers.`,
        description: capstoneSkills.length
          ? `Scope, build, document, and present an end-to-end project that visibly uses ${capstoneSkills.map(skillName).join(", ")}.`
          : "Scope, build, document, and present an end-to-end project.",
      },
    ],
    milestone: `Ship a portfolio-ready project proving ${gap.roleName} readiness.`,
    estimatedWeeks: Math.max(1, Math.ceil(20 / weekly)),
    prerequisitePhaseIds: phases.map((p) => p.id),
  });

  const rationale: RoadmapRationale = {
    targetRole: gap.roleName,
    summary: buildSummary(gap, profile),
    strategy: buildStrategy(gap),
    gapCounts: {
      mastered: gap.mastered.length,
      partial: gap.partial.length,
      missing: gap.missing.length,
    },
    how: buildHow(gap, pool, uncovered),
  };

  return { version, phases, rationale };
}

function buildSummary(gap: SkillGap, profile: LearnerProfile): string {
  const total = gap.mastered.length + gap.partial.length + gap.missing.length;
  return `Toward ${gap.roleName}: you've already got ${gap.mastered.length} of ${total} key skills. This path focuses on the ${gap.missing.length} missing and ${gap.partial.length} partial skills, ordered so prerequisites always come first, at ${profile.weeklyHours}h/week.`;
}

function buildStrategy(gap: SkillGap): string {
  if (gap.orderedSkillIds.length === 0) {
    return "You already meet the target profile — the path focuses on consolidation and a capstone.";
  }
  const first = gap.orderedSkillIds.slice(0, 3).map(skillName).join(" → ");
  return `Start with foundations (${first}), then build upward. Advanced topics stay locked until their prerequisites are complete.`;
}

/**
 * "How we built your path" — the provenance the UI shows so an unusual goal
 * never looks like it was silently replaced with something else.
 */
function buildHow(gap: SkillGap, pool: ResourcePool, uncovered: string[]): string[] {
  const how: string[] = [];
  const r = gap.resolution;

  if (r) {
    how.push(...r.notes);
    if (r.unknownTerms.length) {
      const terms = r.unknownTerms.slice(0, 3);
      const one = terms.length === 1;
      how.push(
        `We couldn't map ${terms.map((t) => `“${t}”`).join(", ")} to a known skill — ${one ? "it's" : "they're"} used to sharpen resource search, not to change your route.`,
      );
    }
  }

  how.push(...prerequisiteNotes(gap.orderedSkillIds));

  const { catalog, canonical, external, generated } = pool.stats;
  const sources: string[] = [];
  if (catalog) sources.push(`${catalog} from our curated library`);
  if (canonical) sources.push(`${canonical} official/university sources`);
  if (external) sources.push(`${external} found by live search`);
  if (sources.length) how.push(`Resources: ${sources.join(", ")}.`);
  if (generated) {
    how.push(
      `${generated} skill${generated === 1 ? "" : "s"} had no vetted resource, so we generated guided study modules from the skill graph instead of leaving gaps.`,
    );
  }
  if (uncovered.length) {
    how.push(`Still looking for material on ${uncovered.slice(0, 3).map(skillName).join(", ")}.`);
  }
  return how;
}
