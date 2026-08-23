import {
  RESOURCES,
  resourcesTeaching,
  SKILL_BY_ID,
  skillName,
  QUIZ_BY_SKILL,
} from "@/lib/catalog";
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
import { buildContext, scoreResource, type RecommendContext } from "./recommend";
import { buildWhy } from "./recommend";

const PHASE_TITLES: Record<string, string> = {
  Programming: "Programming Foundations",
  Math: "Mathematics for the Path",
  Data: "Data Foundations",
  "Machine Learning": "Machine Learning Core",
  MLOps: "Deployment & MLOps",
  Software: "Software Engineering",
  Cloud: "Cloud & DevOps",
  "AI & LLMs": "AI & LLM Engineering",
  Security: "Security Core",
};

const MILESTONES: Record<string, string> = {
  Programming: "Write clean programs and use version control confidently.",
  Math: "Hold the math intuition that ML and analysis build on.",
  Data: "Load, clean, and explore real datasets end-to-end.",
  "Machine Learning": "Train, evaluate, and reason about ML models.",
  MLOps: "Deploy and operate a model behind a real API.",
  Software: "Design and ship reliable APIs and services.",
  Cloud: "Containerize and run workloads in the cloud.",
  "AI & LLMs": "Build grounded, evaluated LLM applications.",
  Security: "Identify, model, and respond to real threats.",
};

function phaseTitle(domain: string): string {
  return PHASE_TITLES[domain] ?? `${domain} Track`;
}

/** Group ordered gap skills into coherent phases (one per domain run, split if large). */
function groupIntoPhases(orderedSkillIds: string[]): { domain: string; skillIds: string[] }[] {
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
  const groups = Array.from(byDomain.entries())
    .sort((a, b) => (firstSeen.get(a[0]) ?? 0) - (firstSeen.get(b[0]) ?? 0))
    .flatMap(([domain, ids]) => {
      if (ids.length <= 5) return [{ domain, skillIds: ids }];
      // split oversized domains into balanced halves
      const mid = Math.ceil(ids.length / 2);
      return [
        { domain, skillIds: ids.slice(0, mid) },
        { domain, skillIds: ids.slice(mid) },
      ];
    });
  return groups;
}

function bestResourceForSkill(
  skillId: string,
  ctx: RecommendContext,
  used: Set<string>,
): Resource | undefined {
  const candidates = resourcesTeaching(skillId).filter((r) => !used.has(r.id));
  if (candidates.length === 0) return undefined;
  return candidates
    .map((r) => ({ r, score: scoreResource(r, ctx).score }))
    .sort((a, b) => b.score - a.score)[0].r;
}

function pickProject(skillIds: string[], used: Set<string>): Resource | undefined {
  const set = new Set(skillIds);
  const projects = RESOURCES.filter(
    (r) => (r.type === "project" || r.type === "exercise") && r.skills.some((s) => set.has(s)) && !used.has(r.id),
  );
  return projects.sort((a, b) => b.skills.filter((s) => set.has(s)).length - a.skills.filter((s) => set.has(s)).length)[0];
}

function difficultyForTier(tier: number): Difficulty {
  return tier <= 2 ? "beginner" : tier <= 3 ? "intermediate" : "advanced";
}

function resourceStep(resource: Resource, ctx: RecommendContext): Step {
  const res = scoreResource(resource, ctx);
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
    why: buildWhy(res.factors, res.targets),
    description: resource.description,
    url: resource.url,
  };
}

export function generateRoadmap(
  profile: LearnerProfile,
  gap: SkillGap,
  version: number,
): Roadmap {
  // Planning context: never exclude by completion — the roadmap is the plan;
  // StepState tracks what's done. Keeps the plan stable across regenerations.
  const ctx = buildContext(profile, gap);
  const groups = groupIntoPhases(gap.orderedSkillIds);
  const usedResources = new Set<string>();
  const phases: Phase[] = [];
  const weekly = Math.max(profile.weeklyHours || 6, 3);

  groups.forEach((group, index) => {
    const steps: Step[] = [];
    const resourceStepIds: string[] = [];

    // one resource per gap skill (deduped globally)
    for (const skillId of group.skillIds) {
      const resource = bestResourceForSkill(skillId, ctx, usedResources);
      if (!resource) continue;
      usedResources.add(resource.id);
      const step = resourceStep(resource, ctx);
      steps.push(step);
      resourceStepIds.push(step.id);
    }

    // a hands-on project for the phase
    const project = pickProject(group.skillIds, usedResources);
    if (project) {
      usedResources.add(project.id);
      const step = resourceStep(project, ctx);
      step.prerequisiteStepIds = [...resourceStepIds];
      steps.push(step);
    }

    // a checkpoint assessment
    const assessSkills = group.skillIds.filter((s) => (QUIZ_BY_SKILL[s]?.length ?? 0) > 0);
    const assessment: Step = {
      id: `p${index}-assessment`,
      kind: "assessment",
      title: `Checkpoint: ${phaseTitle(group.domain)}`,
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
      title: phaseTitle(group.domain),
      subtitle: `${group.skillIds.length} skill${group.skillIds.length > 1 ? "s" : ""} · ${group.skillIds.map(skillName).slice(0, 3).join(", ")}`,
      skillIds: group.skillIds,
      concepts: group.skillIds.map(skillName),
      steps,
      milestone: MILESTONES[group.domain] ?? `Apply ${group.domain} skills in practice.`,
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
        skillIds: [],
        prerequisiteStepIds: [],
        durationHours: 20,
        difficulty: "advanced",
        why: `Ties every phase together into one artifact that demonstrates ${gap.roleName} skills to employers.`,
        description: "Scope, build, document, and present an end-to-end project.",
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
