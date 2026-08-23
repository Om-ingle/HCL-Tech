import { latestRoadmap, loadProfile } from "@/lib/server/service";
import { findStep, questionsForSkills, toPublic } from "@/lib/server/assessment";
import { ok, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // reads query params per request; never prerender

// Public quiz questions (answer key stripped). Skills come from ?skills=a,b
// or are derived from a roadmap step via ?profileId=&stepId=.
export const GET = route(async (req) => {
  const url = new URL(req.url);
  const skillsParam = url.searchParams.get("skills");
  const profileId = url.searchParams.get("profileId");
  const stepId = url.searchParams.get("stepId");

  let skillIds: string[] = [];
  if (skillsParam) {
    skillIds = skillsParam.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (profileId && stepId) {
    const profile = await loadProfile(profileId);
    const roadmap = profile ? await latestRoadmap(profileId) : null;
    const found = roadmap ? findStep(roadmap, stepId) : null;
    skillIds = found?.step.skillIds ?? [];
  }

  const qs = questionsForSkills(skillIds);
  return ok({ questions: toPublic(qs), skillIds });
});
