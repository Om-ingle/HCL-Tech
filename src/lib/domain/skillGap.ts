import { SKILL_BY_ID, getRole, matchRole, detectSkills } from "@/lib/catalog";
import type {
  GapStatus,
  LearnerProfile,
  Role,
  SkillGap,
  SkillGapItem,
} from "./types";
import { orderSkills, prerequisiteClosure } from "./util";

/** Resolve the learner's target role from an id or free text. */
export function resolveRole(profile: LearnerProfile): Role | null {
  if (profile.targetRole && getRole(profile.targetRole)) {
    return getRole(profile.targetRole)!;
  }
  return matchRole(`${profile.targetRole ?? ""} ${profile.goalText ?? ""}`);
}

interface TargetSkill {
  skillId: string;
  targetLevel: number;
}

/**
 * Full target-skill set = role's skills + their prerequisite closure (so
 * foundational gaps surface). For unmatched/unusual goals, fall back to a
 * coherent foundational target so the learner still gets a usable roadmap.
 */
function targetSkills(role: Role | null, profile: LearnerProfile): TargetSkill[] {
  if (role) {
    const base: TargetSkill[] = role.targetSkills.map((t) => ({ ...t }));
    const present = new Set(base.map((t) => t.skillId));
    for (const p of prerequisiteClosure(base.map((t) => t.skillId))) {
      if (!present.has(p)) base.push({ skillId: p, targetLevel: 2 });
    }
    return base;
  }
  // Custom / unrecognized goal → foundational tech starter path.
  const seed = ["python", "programming-fundamentals", "sql", "software-apis", "git"];
  const ids = new Set(seed);
  for (const p of prerequisiteClosure(seed)) ids.add(p);
  return Array.from(ids).map((id) => ({ skillId: id, targetLevel: 2 }));
}

function reasonFor(
  status: GapStatus,
  skillName: string,
  proficiency: number,
  target: number,
  roleName: string,
): string {
  const levelWord = ["none", "aware", "working", "strong"];
  switch (status) {
    case "mastered":
      return `You're already at the level ${roleName} needs (${levelWord[proficiency]}).`;
    case "partial":
      return `You have a ${levelWord[proficiency]} grasp — ${roleName} expects ${levelWord[target]}. A focused push closes it.`;
    default:
      return `Not in your profile yet, and required for ${roleName}.`;
  }
}

export function analyzeSkillGap(profile: LearnerProfile): SkillGap {
  const role = resolveRole(profile);
  const roleName = role?.name ?? (profile.targetRole || "your goal");
  const targets = targetSkills(role, profile);
  const known = new Map(profile.knownSkills.map((k) => [k.skillId, k.proficiency]));

  const mastered: SkillGapItem[] = [];
  const partial: SkillGapItem[] = [];
  const missing: SkillGapItem[] = [];

  for (const t of targets) {
    const s = SKILL_BY_ID[t.skillId];
    if (!s) continue;
    const proficiency = known.get(t.skillId) ?? 0;
    const status: GapStatus =
      proficiency >= t.targetLevel ? "mastered" : proficiency > 0 ? "partial" : "missing";
    const item: SkillGapItem = {
      skillId: s.id,
      name: s.name,
      domain: s.domain,
      tier: s.tier,
      status,
      proficiency,
      targetLevel: t.targetLevel,
      prerequisites: s.prerequisites,
      reason: reasonFor(status, s.name, proficiency, t.targetLevel, roleName),
    };
    (status === "mastered" ? mastered : status === "partial" ? partial : missing).push(item);
  }

  const gapIds = [...missing, ...partial].map((i) => i.skillId);
  const orderedSkillIds = orderSkills(gapIds);

  // Sort each bucket by learning order for stable, readable display.
  const orderIndex = new Map(orderedSkillIds.map((id, i) => [id, i]));
  const byOrder = (a: SkillGapItem, b: SkillGapItem) =>
    (orderIndex.get(a.skillId) ?? 99) - (orderIndex.get(b.skillId) ?? 99) ||
    a.tier - b.tier ||
    a.name.localeCompare(b.name);
  missing.sort(byOrder);
  partial.sort(byOrder);
  mastered.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  return {
    roleId: role?.id ?? null,
    roleName,
    mastered,
    partial,
    missing,
    orderedSkillIds,
  };
}
