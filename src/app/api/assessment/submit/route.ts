import { assessmentSubmitSchema } from "@/lib/validation/schemas";
import { applyAssessment } from "@/lib/domain/adapt";
import {
  buildNavigator,
  latestRoadmap,
  loadProfile,
  logEvent,
  regenerateRoadmap,
  saveProfile,
  setStepStatus,
} from "@/lib/server/service";
import { findStep, gradeAnswers } from "@/lib/server/assessment";
import { guardProfile } from "@/lib/server/auth";
import { fail, ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Grade a checkpoint server-side, adapt proficiency, and reroute if warranted.
export const POST = route(async (req) => {
  const { profileId, stepId, answers } = await parseBody(req, assessmentSubmitSchema);
  await guardProfile(profileId);
  const profile = await loadProfile(profileId);
  if (!profile) return fail("Profile not found.", 404);
  const roadmap = await latestRoadmap(profileId);
  const found = roadmap ? findStep(roadmap, stepId) : null;

  const grade = gradeAnswers(answers);
  const skillIds = grade.skillIds.length ? grade.skillIds : found?.step.skillIds ?? [];
  const adapt = applyAssessment(profile, skillIds, grade.scorePct);
  await saveProfile(adapt.profile);
  await setStepStatus(profileId, stepId, "completed", grade.scorePct);

  let regenerated = false;
  if (adapt.regenerate) {
    await regenerateRoadmap(adapt.profile);
    regenerated = true;
  }
  await logEvent(profileId, "assessment_submitted", { stepId, scorePct: grade.scorePct });

  const bundle = await buildNavigator(adapt.profile);
  return ok({
    scorePct: grade.scorePct,
    correct: grade.correct,
    total: grade.total,
    changes: adapt.changes,
    regenerated,
    ...bundle,
  });
});
