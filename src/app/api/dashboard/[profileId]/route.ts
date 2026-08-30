import { buildNavigator, loadProfile, recentEvents, statesMap } from "@/lib/server/service";
import { skillName } from "@/lib/catalog";
import { fail, ok, route } from "@/lib/server/http";

export const runtime = "nodejs";

type Ctx = { params: { profileId: string } };

const EVENT_LABELS: Record<string, string> = {
  profile_created: "Profile created",
  profile_updated: "Updated profile",
  path_regenerated: "Recalculated route",
  step_completed: "Completed a step",
  step_skipped: "Skipped a step",
  assessment_submitted: "Took a checkpoint",
  feedback: "Gave feedback",
  simulate: "Ran a what-if",
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Consecutive-day streak of activity ending today or yesterday. */
function computeStreak(dates: Date[]): number {
  if (!dates.length) return 0;
  const days = Array.from(new Set(dates.map(dayKey)));
  const set = new Set(days);
  let streak = 0;
  const cursor = new Date();
  // allow the streak to still count if the last activity was yesterday
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (set.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export const GET = route(async (_req, { params }: Ctx) => {
  const profile = await loadProfile(params.profileId);
  if (!profile) return fail("Profile not found.", 404);

  const [{ view, gap, roadmap }, states, events] = await Promise.all([
    buildNavigator(profile),
    statesMap(params.profileId),
    recentEvents(params.profileId, 60),
  ]);

  const totalTarget = gap.mastered.length + gap.partial.length + gap.missing.length;
  const completedStepIds = Array.from(states.entries())
    .filter(([, s]) => s.status === "completed")
    .map(([id]) => id);
  const assessmentScores = Array.from(states.values())
    .filter((s) => s.score != null)
    .map((s) => s.score as number);
  const avgScore = assessmentScores.length
    ? Math.round(assessmentScores.reduce((a, b) => a + b, 0) / assessmentScores.length)
    : null;

  const activity = events.map((e) => ({
    id: e.id,
    type: e.type,
    label: EVENT_LABELS[e.type] ?? e.type,
    at: e.createdAt,
  }));

  return ok({
    profileName: profile.name,
    roleName: gap.roleName,
    progress: view?.progress ?? {
      overallPct: 0,
      completedSteps: 0,
      totalSteps: 0,
      currentPhaseIndex: 0,
      estimatedWeeksLeft: profile.timelineWeeks,
    },
    skills: {
      atTarget: gap.mastered.length,
      partial: gap.partial.length,
      missing: gap.missing.length,
      totalTarget,
      masteredNames: gap.mastered.map((m) => m.name),
    },
    phases: {
      total: roadmap?.phases.length ?? 0,
      done: view ? view.phases.filter((p) => p.phaseStatus === "done").length : 0,
      currentTitle: view ? view.phases[view.progress.currentPhaseIndex]?.title ?? null : null,
    },
    checkpoints: { taken: assessmentScores.length, averageScore: avgScore },
    completedCount: completedStepIds.length,
    streakDays: computeStreak(events.map((e) => new Date(e.createdAt))),
    weeklyHours: profile.weeklyHours,
    nextAction: view?.nextAction
      ? { title: view.nextAction.step.title, why: view.nextAction.reason, stepId: view.nextAction.step.id }
      : null,
    passport: gap.mastered.map((m) => ({ skillId: m.skillId, name: skillName(m.skillId) })),
    activity,
  });
});
