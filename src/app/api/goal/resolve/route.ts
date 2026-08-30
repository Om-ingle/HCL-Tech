import { resolveGoalText } from "@/lib/ai/aiService";
import { validateSkillNames } from "@/lib/domain/goalResolver";
import { goalResolveSchema } from "@/lib/validation/schemas";
import { aiScopeId } from "@/lib/server/auth";
import { ok, parseBody, route } from "@/lib/server/http";
import { SKILL_BY_ID } from "@/lib/catalog";

export const runtime = "nodejs";

/**
 * Resolve ANY natural-language goal to target skills for the confirmation screen.
 * Deterministic by default; upgraded by one small structured LLM call when this
 * session has a provider configured. Returns skill ids + names so the UI can
 * show and edit exactly what was inferred.
 */
export const POST = route(async (req) => {
  const { text, targetRole } = await parseBody(req, goalResolveSchema);
  const sid = await aiScopeId();
  const { resolution, source, provider, note, dynamicSkills } = await resolveGoalText(text, targetRole, {
    sessionId: sid,
  });
  return ok({
    resolution,
    source,
    provider,
    note,
    dynamicSkills,
    targets: resolution.targets.map((t) => ({
      skillId: t.skillId,
      name: SKILL_BY_ID[t.skillId]?.name ?? t.skillId,
      domain: SKILL_BY_ID[t.skillId]?.domain ?? "",
      targetLevel: t.targetLevel,
    })),
  });
});

/** Validate skill names/ids typed by the learner (used when editing targets). */
export const PUT = route(async (req) => {
  const body = (await req.json()) as { names?: unknown };
  const names = Array.isArray(body.names) ? body.names.map(String).slice(0, 60) : [];
  const { ids, unknown } = validateSkillNames(names);
  return ok({
    ids,
    unknown,
    skills: ids.map((id) => ({ skillId: id, name: SKILL_BY_ID[id]?.name ?? id })),
  });
});
