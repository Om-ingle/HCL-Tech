/**
 * Live provider-truth acceptance (uses the configured provider/key).
 *
 *   node scripts/_accept-goals.cjs
 *
 * Verifies: the SELECTED provider is actually called for EVERY goal — including
 * goals the deterministic engine already knows (Linux Kernel Developer) — and
 * that out-of-domain goals (dancing, singing) get real AI-understood skills
 * rather than a generic tech route.
 */
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.resolve(__dirname, "..", "src") } });
(async () => {
  // A session row IS required now — config is per-session, never global.
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  const sid = "test-session-" + Date.now();
  const { resolveAiConfig, saveAiConfig } = jiti("../src/lib/ai/config.ts");

  // Case: a fresh session id with NO saved config → Demo/Fallback, no calls.
  const fresh = await resolveAiConfig("brand-new-session-no-config");
  console.log(`FRESH SESSION: available=${fresh.available} source=${fresh.source}${fresh.available ? "  ✗ LEAK" : "  ✓ isolated"}`);
  let setupFailures = fresh.available ? 1 : 0;

  // This script has no browser cookie, so seed the session row directly from
  // the old singleton's values if present (never printed).
  const singleton = await p.aiConfig.findUnique({ where: { id: "singleton" } });
  if (singleton?.apiKey) {
    await saveAiConfig(
      { provider: singleton.provider, model: singleton.model, apiKey: singleton.apiKey, mode: singleton.mode, enabled: true },
      sid,
    );
  }
  await p.$disconnect();

  const cfg = await resolveAiConfig(sid);
  console.log(`SEEDED SESSION: ${cfg.provider} · ${cfg.model} · available=${cfg.available} · source=${cfg.source} · mode=${cfg.mode}`);
  if (!cfg.available) {
    console.log("No provider available (no old global key to seed from) — offline checks only.");
    process.exit(setupFailures);
  }

  const { resolveGoalText } = jiti("../src/lib/ai/aiService.ts");
  const { isDynamicSkillId } = jiti("../src/lib/catalog/dynamic.ts");

  const GOALS = [
    { text: "I want to become a Linux Kernel Developer", expectLlm: true }, // known goal — LLM still called
    { text: "I want to become a Robotics Engineer", expectLlm: true },
    { text: "I want to learn dancing", expectLlm: true, outOfDomain: true },
    { text: "I want to learn singing", expectLlm: true, outOfDomain: true },
  ];

  let failures = 0;
  for (const { text, outOfDomain } of GOALS) {
    const out = await resolveGoalText(text, undefined, { roleIsGuess: true, sessionId: sid });
    const g = out.resolution;
    const ok = out.source === "llm" && g.targets.length > 0;
    const relevant = outOfDomain
      ? out.dynamicSkills.length > 0 && !g.domains.includes("Programming")
      : true;
    if (!ok || !relevant) failures++;

    const srcLine =
      out.source === "llm"
        ? "LLM · " + out.provider
        : "FALLBACK" + (out.note ? " — " + out.note.slice(0, 140) : "");
    console.log(`\n${ok && relevant ? "✓" : "✗"} "${text}"`);
    console.log(`   ${srcLine}`);
    console.log(`   label="${g.label}" [${g.domains.join(", ")}] methods=[${g.methods}] targets=${g.targets.length}`);
    console.log(`   dyn: ${out.dynamicSkills.map((d) => d.name).join(", ") || "(none)"}`);
    console.log(`   route seeds: ${g.targets.map((t) => t.skillId).slice(0, 8).join(", ")}`);
    if (outOfDomain) console.log(`   out-of-domain handled by AI: ${relevant ? "yes" : "NO"}`);
    void isDynamicSkillId;
  }
  // Cleanup: the singleton row (pre-session-scoping global config — the privacy
  // leak) and this suite's own test rows go away after the run. Learner data
  // untouched. Real browser sessions keep their own rows.
  const p2 = new PrismaClient();
  const del = await p2.aiConfig.deleteMany({
    where: { OR: [{ id: "singleton" }, { id: { startsWith: "test-session-" } }] },
  });
  const remaining = await p2.aiConfig.count();
  await p2.$disconnect();
  console.log(`\nCLEANUP: deleted ${del.count} global/test aiConfig row(s); ${remaining} session row(s) remain`);

  const total = failures + setupFailures;
  console.log(total ? `\n❌ ${total} check(s) failed` : "\n✅ all checks passed");
  process.exit(total ? 1 : 0);
})().catch((e) => {
  console.error("ERR", String(e.message).slice(0, 600));
  process.exit(1);
});
