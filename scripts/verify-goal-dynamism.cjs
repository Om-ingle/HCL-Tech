/** One-off: goal-change dynamism + starter-label fix + assistant history wiring. */
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.resolve(__dirname, "..", "src") } });
const { applyGoalChange } = jiti("../src/lib/domain/adapt.ts");
const { analyzeSkillGap } = jiti("../src/lib/domain/skillGap.ts");
const { buildAssistantRequest } = jiti("../src/lib/ai/prompts.ts");

let failures = 0;
const check = (label, cond, detail) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
};

const baseProfile = {
  id: "t", name: "T", targetRole: "", goalText: "I want to become a Linux kernel developer. I know Python and some C.",
  experienceLevel: "intermediate", learningStyle: "mixed", weeklyHours: 8, timelineWeeks: 24,
  careerOutcome: "", interests: [], knownSkills: [{ skillId: "python", proficiency: 2 }],
  preferences: { targetSkillIds: ["kernel-development", "device-drivers", "memory-management"] },
};

console.log("\n1. Starter label: confirmed targets + unmappable goal → learner's own words, not 'Getting Started in Tech'");
{
  const p = { ...baseProfile, targetRole: "Gameplay Programmer", goalText: "I want to become a gameplay programmer", preferences: { targetSkillIds: ["programming-fundamentals", "python", "algorithms"] } };
  const gap = analyzeSkillGap(p);
  check("navigator title is the learner's goal", gap.roleName === "Gameplay Programmer", gap.roleName);
}

console.log("\n2. Goal change: old-goal skills/words must NOT survive the reroute");
{
  const before = analyzeSkillGap(baseProfile);
  check("before: kernel skills present", before.resolution.targets.some((t) => t.skillId === "kernel-development"));
  const changed = applyGoalChange(baseProfile, "data-scientist", "Data Scientist");
  const after = analyzeSkillGap(changed.profile);
  const skillIds = after.resolution.targets.map((t) => t.skillId);
  check("title switches to the new goal", after.roleName === "Data Scientist", after.roleName);
  check("old-goal skills are gone", !skillIds.includes("kernel-development") && !skillIds.includes("device-drivers"), skillIds.slice(0, 6).join(", "));
  check("targetSkillIds override cleared", !changed.profile.preferences.targetSkillIds);
  check("goalText no longer mentions the old goal", !/kernel/i.test(changed.profile.goalText), JSON.stringify(changed.profile.goalText));
  check("new-goal skills drive the route", skillIds.includes("statistics") || skillIds.includes("sql") || skillIds.includes("python"));
  // Known Python skill is preserved (learner history, not goal content).
  check("known skills preserved", changed.profile.knownSkills.some((k) => k.skillId === "python"));
}

console.log("\n3. Assistant request: exactly the last 3 turns + fresh context + question");
{
  const ctx = {
    profileName: "T", roleName: "Data Scientist", experienceLevel: "intermediate", weeklyHours: 8,
    masteredCount: 1, partialCount: 0, missingCount: 6, topGaps: ["Statistics"], currentPhase: "Phase 1",
    nextActionTitle: "Statistics basics", nextActionWhy: "Foundation for analysis", overallPct: 10, estimatedWeeksLeft: 20,
  };
  const history = [
    { role: "user", text: "What should I learn first?" },
    { role: "assistant", text: "Statistics basics is next." },
    { role: "user", text: "Why that one?" },
    { role: "assistant", text: "It underpins data analysis." },
    { role: "user", text: "an older turn" },
    { role: "assistant", text: "an older reply" },
  ];
  const req = buildAssistantRequest("Can I skip it?", ctx, history);
  check("only last 3 history messages sent", req.messages.length === 4, `${req.messages.length} messages`);
  check("oldest turns dropped", !req.messages.some((m) => m.content.includes("What should I learn first")));
  check("follow-up question present", req.messages[req.messages.length - 1].content.includes("Can I skip it?"));
  check("current goal context present", req.messages[req.messages.length - 1].content.includes("Data Scientist"));
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
