import { prisma } from "@/lib/db";
import { PERSONAS } from "@/lib/personas";
import { createProfile, regenerateRoadmap } from "@/lib/server/service";
import type { ProfileInput } from "@/lib/validation/schemas";
import { ok, route } from "@/lib/server/http";

export const runtime = "nodejs";

function personaInput(p: (typeof PERSONAS)[number]): ProfileInput {
  const pr = p.profile;
  return {
    name: pr.name,
    targetRole: pr.targetRole,
    goalText: pr.goalText,
    experienceLevel: pr.experienceLevel,
    learningStyle: pr.learningStyle,
    weeklyHours: pr.weeklyHours,
    timelineWeeks: pr.timelineWeeks,
    careerOutcome: pr.careerOutcome,
    interests: pr.interests,
    knownSkillIds: [],
    knownSkills: pr.knownSkills,
  };
}

// Seed (or reset) the three demo personas, each with a fresh roadmap v1.
export const POST = route(async () => {
  const ids = PERSONAS.map((p) => p.id);
  await prisma.event.deleteMany({ where: { profileId: { in: ids } } });
  await prisma.stepState.deleteMany({ where: { profileId: { in: ids } } });
  await prisma.learningPath.deleteMany({ where: { profileId: { in: ids } } });

  const personas = [];
  for (const p of PERSONAS) {
    const profile = await createProfile(personaInput(p), p.id);
    const { roadmap, gap } = await regenerateRoadmap(profile);
    personas.push({
      id: p.id,
      name: profile.name,
      emoji: p.emoji,
      headline: p.headline,
      roleName: gap.roleName,
      phaseCount: roadmap.phases.length,
      missing: gap.missing.length,
      partial: gap.partial.length,
      mastered: gap.mastered.length,
    });
  }
  return ok({ personas });
});

// List persona metadata (for the switcher) without touching the DB.
export const GET = route(async () => {
  const personas = PERSONAS.map((p) => ({
    id: p.id,
    name: p.profile.name,
    emoji: p.emoji,
    headline: p.headline,
    targetRole: p.profile.targetRole,
    sampleOnboardingText: p.sampleOnboardingText,
  }));
  return ok({ personas });
});
