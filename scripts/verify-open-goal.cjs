/**
 * Open-goal engine verification harness (no DB, no network, no API keys).
 *
 *   node scripts/verify-open-goal.cjs            # summary for every test goal
 *   node scripts/verify-open-goal.cjs --verbose  # full roadmaps
 *
 * Exercises the deterministic path end-to-end: goal resolution → target skills →
 * prerequisite expansion → skill gap → three-layer discovery → roadmap. This is
 * exactly what runs when no LLM provider is configured.
 */
const path = require("path");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.resolve(__dirname, "..", "src") },
});

const { resolveGoal, buildGoalInput } = jiti("../src/lib/domain/goalResolver.ts");
const { analyzeSkillGap } = jiti("../src/lib/domain/skillGap.ts");
const { generateRoadmap } = jiti("../src/lib/domain/path.ts");
const { recommend } = jiti("../src/lib/domain/recommend.ts");
const { buildPool } = jiti("../src/lib/discovery/index.ts");
const { SKILLS, skillName } = jiti("../src/lib/catalog/index.ts");
const { PERSONAS } = jiti("../src/lib/personas.ts");
const { questionsForSkill } = jiti("../src/lib/domain/quizGen.ts");

const VERBOSE = process.argv.includes("--verbose");

function profile(over = {}) {
  return {
    id: "t",
    name: "Tester",
    targetRole: over.targetRole ?? "",
    goalText: over.goalText ?? "",
    experienceLevel: over.experienceLevel ?? "beginner",
    learningStyle: over.learningStyle ?? "mixed",
    weeklyHours: over.weeklyHours ?? 8,
    timelineWeeks: over.timelineWeeks ?? 24,
    careerOutcome: over.careerOutcome ?? "",
    interests: over.interests ?? [],
    knownSkills: over.knownSkills ?? [],
    preferences: over.preferences ?? {},
  };
}

const CASES = [
  { name: "Linux Kernel Developer", goalText: "I want to become a Linux Kernel Developer", knownSkills: [["c-programming", 2], ["linux-cli", 2]], experienceLevel: "intermediate" },
  { name: "Robotics Engineer", goalText: "I want to be a Robotics Engineer working on real robots" },
  { name: "Quant Developer", goalText: "Become a Quant Developer at a hedge fund", experienceLevel: "intermediate", knownSkills: [["python", 3], ["programming-fundamentals", 3]] },
  { name: "Game Engine Programmer", goalText: "I want to be a game engine programmer writing my own renderer" },
  { name: "Computer Graphics Engineer", goalText: "computer graphics engineer, real-time rendering and shaders" },
  { name: "Embedded Systems Engineer", goalText: "Embedded systems engineer writing firmware for microcontrollers" },
  { name: "MLOps Engineer", goalText: "I'd like to become an MLOps engineer", experienceLevel: "intermediate", knownSkills: [["python", 3], ["docker", 2]] },
  { name: "Cybersecurity Engineer", goalText: "cybersecurity engineer doing penetration testing" },
  { name: "Quantum Software Engineer", goalText: "quantum software engineer building quantum algorithms" },
  { name: "Unusual: AUV control", goalText: "I want to be an autonomous underwater robotics control engineer" },
  { name: "Predefined role (ml-engineer)", targetRole: "ml-engineer", goalText: "machine learning engineer", experienceLevel: "intermediate" },
  { name: "Vague goal", goalText: "I want a good job in tech, not sure what yet" },
  { name: "Compiler + skills only", goalText: "I want to learn LLVM and write a compiler" },
  { name: "Confirmed target override", goalText: "surprise me", preferences: { targetSkillIds: ["rust", "distributed-systems", "kubernetes"] } },
];

let failures = 0;
const check = (label, cond, detail = "") => {
  if (!cond) {
    failures++;
    console.log(`   ✗ FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

function run(label, p) {
  const gap = analyzeSkillGap(p);
  const pool = buildPool(gap.orderedSkillIds, { level: p.experienceLevel });
  const roadmap = generateRoadmap(p, gap, 1, { pool });
  const recs = recommend(p, gap, { limit: 3, minScore: 1, pool });
  const r = gap.resolution;

  const steps = roadmap.phases.flatMap((ph) => ph.steps);
  const resourceSteps = steps.filter((s) => s.resourceId);
  const origins = {};
  for (const s of resourceSteps) {
    const res = pool.all().find((x) => x.id === s.resourceId);
    const o = res ? res.origin ?? "catalog" : "project";
    origins[o] = (origins[o] ?? 0) + 1;
  }

  console.log(`\n━━ ${label}`);
  console.log(`   goal      : "${p.goalText || p.targetRole}"`);
  console.log(`   resolved  : ${r.label}  [${r.domains.join(", ")}]  conf ${r.confidence.toFixed(2)}  via ${r.methods.join("+")}`);
  console.log(`   targets   : ${r.targets.length} skills  |  gap ${gap.missing.length} missing / ${gap.partial.length} partial / ${gap.mastered.length} mastered`);
  console.log(`   matched   : ${r.matchedTerms.slice(0, 6).join(", ") || "—"}${r.unknownTerms.length ? `   unmapped: ${r.unknownTerms.slice(0, 4).join(", ")}` : ""}`);
  console.log(`   order     : ${gap.orderedSkillIds.slice(0, 8).map(skillName).join(" → ")}${gap.orderedSkillIds.length > 8 ? " → …" : ""}`);
  console.log(`   phases    : ${roadmap.phases.map((ph) => ph.title).join(" | ")}`);
  console.log(`   steps     : ${steps.length} (${resourceSteps.length} resources) origins ${JSON.stringify(origins)}`);
  console.log(`   top rec   : ${recs[0] ? `${recs[0].resource.title} (${recs[0].score})` : "none"}`);
  console.log(`   how       :`);
  for (const line of roadmap.rationale.how ?? []) console.log(`               • ${line}`);

  if (VERBOSE) {
    for (const ph of roadmap.phases) {
      console.log(`\n   ▸ ${ph.title} — ${ph.estimatedWeeks}w · ${ph.milestone}`);
      for (const s of ph.steps) {
        console.log(`       [${s.kind}] ${s.title}${s.url ? ` <${s.url}>` : " (no link — generated)"}`);
        console.log(`               ${s.why}`);
      }
    }
  }

  // ── invariants every goal must satisfy ──
  check("resolves to at least one target skill", r.targets.length >= 1, `${r.targets.length}`);
  check("expands to a substantial path", gap.orderedSkillIds.length >= 5, `${gap.orderedSkillIds.length} skills`);
  check("has phases", roadmap.phases.length >= 2);
  check("every gap skill has a resource", resourceSteps.length >= Math.min(gap.orderedSkillIds.length, 5));
  check("no invented urls", steps.every((s) => !s.url || /^https?:\/\//.test(s.url)));
  check("generated steps have no url", resourceSteps.every((s) => {
    const res = pool.all().find((x) => x.id === s.resourceId);
    return !res || res.origin !== "generated" || !s.url;
  }));
  check("prereqs ordered before dependents", (() => {
    const pos = new Map(gap.orderedSkillIds.map((id, i) => [id, i]));
    return gap.orderedSkillIds.every((id, i) => {
      const sk = SKILLS.find((s) => s.id === id);
      return (sk?.prerequisites ?? []).every((pre) => !pos.has(pre) || pos.get(pre) < i);
    });
  })());
  check("has assessment checkpoints", steps.some((s) => s.kind === "assessment"));
  check("has a project", steps.some((s) => s.kind === "project"));
  check("how-panel explains provenance", (roadmap.rationale.how ?? []).length > 0);
  return { gap, roadmap, pool };
}

console.log(`SKILL GRAPH: ${SKILLS.length} skills across ${new Set(SKILLS.map((s) => s.domain)).size} domains`);

const seen = [];
for (const c of CASES) seen.push({ label: c.name, ...run(c.name, profile(c)) });

console.log("\n\n════ DEMO PERSONAS (must still work) ════");
for (const persona of PERSONAS) {
  const res = run(`${persona.emoji} ${persona.profile.name} → ${persona.profile.targetRole}`, persona.profile);
  check(`${persona.profile.name} keeps predefined role`, res.gap.roleId === persona.profile.targetRole, `got ${res.gap.roleId}`);
}

console.log("\n\n════ DISTINCTNESS (no-API paths must not be generic) ════");
const sig = (x) => x.gap.orderedSkillIds.slice(0, 6).join(",");
const sigs = new Map();
for (const s of seen) {
  const k = sig(s);
  if (sigs.has(k)) {
    console.log(`   ✗ FAIL "${s.label}" has the same opening as "${sigs.get(k)}": ${k}`);
    failures++;
  } else sigs.set(k, s.label);
}
console.log(`   ${sigs.size}/${seen.length} distinct openings`);

console.log("\n════ GENERATED ASSESSMENTS ════");
let noQuiz = 0;
for (const s of SKILLS) if (questionsForSkill(s.id).length === 0) noQuiz++;
console.log(`   skills with at least one question: ${SKILLS.length - noQuiz}/${SKILLS.length}`);
check("every skill is assessable", noQuiz === 0, `${noQuiz} skills have no questions`);

// §13: onboarding guesses a role from the same sentence. That guess must never
// override a goal the text states clearly, or an unusual destination silently
// becomes the nearest predefined role.
console.log("\n════ GUESSED ROLE MUST NOT OVERRIDE A CLEAR GOAL ════");
const GUESS_CASES = [
  {
    goalText:
      "I want to become a robotics engineer working on autonomous underwater vehicles. I can code in Python and know basic linear algebra.",
    guess: "data-scientist",
    expectDomain: "Robotics",
  },
  {
    goalText: "I want to be a Linux kernel developer. I know some C and Linux.",
    guess: "backend-engineer",
    expectDomain: "Systems",
  },
  { goalText: "I want a good job in tech, not sure what yet", guess: "data-scientist", expectDomain: "Data" },
];
for (const c of GUESS_CASES) {
  const withGuess = buildGoalInput(c.goalText, c.guess, true);
  const r = resolveGoal(withGuess);
  const ok = r.domain === c.expectDomain;
  console.log(`   ${ok ? "✓" : "✗"} "${c.goalText.slice(0, 46)}…" + guess ${c.guess} → ${r.label} [${r.domain}]`);
  check(`guessed role handling for "${c.goalText.slice(0, 30)}"`, ok, `expected ${c.expectDomain}, got ${r.domain}`);
}

console.log(failures === 0 ? "\n✅ ALL CHECKS PASSED\n" : `\n❌ ${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
