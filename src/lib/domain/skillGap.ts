import { SKILL_BY_ID, getRole, matchRole, skillName } from "@/lib/catalog";
import type {
  GapStatus,
  GoalResolution,
  LearnerProfile,
  Role,
  SkillGap,
  SkillGapItem,
} from "./types";
import { expandTargets, resolveGoalForProfile, type GoalHint } from "./goalResolver";
import { orderSkills } from "./util";

/**
 * Resolve the learner's target role from an id or free text.
 * Kept for callers that specifically want a predefined role; open goals resolve
 * through `resolveGoalForProfile` instead and legitimately have no Role.
 */
export function resolveRole(profile: LearnerProfile): Role | null {
  if (profile.targetRole && getRole(profile.targetRole)) {
    return getRole(profile.targetRole)!;
  }
  return matchRole(`${profile.targetRole ?? ""} ${profile.goalText ?? ""}`);
}

function reasonFor(
  status: GapStatus,
  proficiency: number,
  target: number,
  goalName: string,
): string {
  const levelWord = ["none", "aware", "working", "strong"];
  switch (status) {
    case "mastered":
      return `You're already at the level ${goalName} needs (${levelWord[proficiency]}).`;
    case "partial":
      return `You have a ${levelWord[proficiency]} grasp — ${goalName} expects ${levelWord[target]}. A focused push closes it.`;
    default:
      return `Not in your profile yet, and required for ${goalName}.`;
  }
}

/**
 * Skill-gap analysis over a RESOLVED target skill set, so it works for any goal
 * — predefined role or arbitrary free text. Pass a `hint` when an LLM has
 * proposed candidate skills; it only ever widens the deterministic result.
 */
export function analyzeSkillGap(profile: LearnerProfile, hint?: GoalHint): SkillGap {
  const resolution = resolveGoalForProfile(profile, hint);
  const goalName = resolution.label || profile.targetRole || "your goal";
  const { targets, addedPrerequisites } = expandTargets(resolution);
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
      reason: reasonFor(status, proficiency, t.targetLevel, goalName),
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

  // Provenance the UI shows as "how we read your goal".
  const notes = [...resolution.notes];
  if (addedPrerequisites.length) {
    const example = addedPrerequisites
      .map((id) => SKILL_BY_ID[id])
      .filter(Boolean)
      .sort((a, b) => a!.tier - b!.tier)[0];
    notes.push(
      `Added ${addedPrerequisites.length} prerequisite skill${addedPrerequisites.length === 1 ? "" : "s"} from the graph${example ? ` (starting with ${example.name})` : ""}.`,
    );
  }
  if (mastered.length) {
    notes.push(
      `Skipped ${mastered.length} skill${mastered.length === 1 ? "" : "s"} you already have, including ${mastered.slice(0, 2).map((m) => m.name).join(" and ")}.`,
    );
  }

  return {
    roleId: resolution.roleId,
    roleName: goalName,
    mastered,
    partial,
    missing,
    orderedSkillIds,
    resolution: { ...resolution, notes } as GoalResolution,
  };
}

/** Human-readable prerequisite explanation used by "How we built your path". */
export function prerequisiteNotes(orderedSkillIds: string[]): string[] {
  const position = new Map(orderedSkillIds.map((id, i) => [id, i]));
  const out: string[] = [];
  for (const id of orderedSkillIds) {
    const skill = SKILL_BY_ID[id];
    if (!skill) continue;
    for (const p of skill.prerequisites) {
      if (position.has(p) && position.get(p)! < position.get(id)!) {
        out.push(`${skill.name} comes after ${skillName(p)} because it's a prerequisite.`);
        break;
      }
    }
    if (out.length >= 3) break;
  }
  return out;
}
