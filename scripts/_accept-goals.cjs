/** Acceptance: 4 goals through the live OpenRouter config (DB-healed model). */
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.resolve(__dirname, "..", "src") } });
(async () => {
  const { resolveGoalText } = jiti("../src/lib/ai/aiService.ts");
  const { analyzeSkillGap } = jiti("../src/lib/domain/skillGap.ts");
  const { generateRoadmap } = jiti("../src/lib/domain/path.ts");
  const { buildPool } = jiti("../src/lib/discovery/index.ts");
  const { isDynamicSkillId } = jiti("../src/lib/catalog/dynamic.ts");

  const GOALS = [
    "I want to become a Linux Kernel Developer",
    "I want to become a Robotics Engineer",
    "I want to learn chemistry in battery",
    "I want to become a artisanal cheese ager and affineur who understands rind microbiology",
  ];
  let failures = 0;
  for (const text of GOALS) {
    const out = await resolveGoalText(text, undefined, { roleIsGuess: true });
    const g = out.resolution;
    const profile = {
      id: "t", name: "T", targetRole: "", goalText: text, experienceLevel: "beginner",
      learningStyle: "mixed", weeklyHours: 8, timelineWeeks: 24, careerOutcome: "",
      interests: [], knownSkills: [],
      preferences: {
        ...(g.targets.length ? { targetSkillIds: g.targets.map((t) => t.skillId) } : {}),
        ...(out.dynamicSkills.length ? { dynamicSkills: out.dynamicSkills } : {}),
      },
    };
    const gap = analyzeSkillGap(profile);
    const pool = buildPool(gap.orderedSkillIds, { level: "beginner" });
    const roadmap = generateRoadmap(profile, gap, 1, { pool });
    const steps = roadmap.phases.flatMap((p) => p.steps);
    const generated = steps.filter((s) => !s.url).length;
    const ok = out.source === "llm";
    if (!ok) failures++;
    console.log(`\n${ok ? "✓" : "✗"} "${text}"`);
    console.log(`   source: ${out.source}${out.provider ? ` · ${out.provider}` : ""}`);
    console.log(`   label : ${g.label}  [${g.domains.join(", ")}]  conf ${g.confidence.toFixed(2)}`);
    console.log(`   dyn   : ${out.dynamicSkills.map((d) => d.name).join(", ") || "(none)"}`);
    console.log(`   route : ${gap.orderedSkillIds.slice(0, 6).join(" → ")} (${gap.orderedSkillIds.length} skills)`);
    console.log(`   phases: ${roadmap.phases.map((p) => p.title).join(" | ")}`);
    console.log(`   steps : ${steps.length}, no-url generated: ${generated}`);
    console.log(`   dyn in route: ${gap.orderedSkillIds.some(isDynamicSkillId) ? "yes" : "no"}`);
  }
  console.log(failures ? `\n❌ ${failures} goal(s) fell back` : "\n✅ all goals resolved by the live LLM");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("ERR", String(e.message).slice(0, 600)); process.exit(1); });
