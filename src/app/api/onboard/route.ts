import { extractProfile, getAiStatus, resolveGoalText } from "@/lib/ai/aiService";
import { SKILL_BY_ID } from "@/lib/catalog";
import { onboardSchema } from "@/lib/validation/schemas";
import { aiSessionId } from "@/lib/server/session";
import { ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Conversational onboarding: free text → structured profile draft (LLM or fallback)
// plus the resolved goal → target skills, so the confirmation screen can show
// exactly what was inferred and let the learner edit it.
export const POST = route(async (req) => {
  const { text } = await parseBody(req, onboardSchema);
  const sid = aiSessionId();
  const [result, aiStatus] = await Promise.all([extractProfile(text, sid), getAiStatus(sid)]);
  // The drafted role is a guess from the same sentence, so it must not outrank
  // what the goal text itself says (§13: never silently swap in another role).
  const { resolution, dynamicSkills, note } = await resolveGoalText(
    text,
    result.draft.targetRoleId ?? result.draft.targetRole,
    { roleIsGuess: true, sessionId: sid },
  );
  return ok({
    ...result,
    aiStatus,
    resolution,
    dynamicSkills,
    note: note ?? result.note,
    targets: resolution.targets.map((t) => ({
      skillId: t.skillId,
      name: SKILL_BY_ID[t.skillId]?.name ?? t.skillId,
      domain: SKILL_BY_ID[t.skillId]?.domain ?? "",
      targetLevel: t.targetLevel,
    })),
  });
});
