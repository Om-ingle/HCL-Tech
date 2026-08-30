/** One-off: end-to-end proof that the configured provider (from the DB row) is
 *  really called for goal resolution and the assistant. Uses the saved key. */
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.resolve(__dirname, "..", "src") } });

(async () => {
  const { resolveGoalText, answerQuestion } = jiti("../src/lib/ai/aiService.ts");
  const r = await resolveGoalText(
    "I want to become a Linux kernel developer. I know Python and some C, and I have 8 hours per week.",
  );
  console.log("GOAL RESOLUTION");
  console.log("  source:", r.source, "| provider:", r.provider ?? "(none)");
  console.log("  label:", r.resolution.label, "| confidence:", r.resolution.confidence);
  console.log("  methods:", r.resolution.methods.join(", "));
  console.log("  targets (" + r.resolution.targets.length + "):", r.resolution.targets.slice(0, 10).map((t) => t.skillId).join(", "));
  console.log("  notes:", r.resolution.notes.slice(0, 3).join(" | "));

  const ctx = {
    profileName: "Test", roleName: "Linux Kernel Developer", experienceLevel: "intermediate",
    weeklyHours: 8, masteredCount: 2, partialCount: 1, missingCount: 6,
    topGaps: ["Operating Systems", "Device Drivers"], currentPhase: "Systems foundations",
    nextActionTitle: "C pointers & memory", nextActionWhy: "Kernel code assumes fluency here",
    overallPct: 22, estimatedWeeksLeft: 40,
  };
  const a = await answerQuestion("Why is C pointers & memory my next step?", ctx);
  console.log("ASSISTANT");
  console.log("  source:", a.source, "| provider:", a.provider ?? "(none)");
  console.log("  text:", (a.text || "").slice(0, 250));
  if (a.note) console.log("  note:", a.note.slice(0, 140));
})().catch((e) => { console.error("ERR", String(e.message).slice(0, 300)); process.exit(1); });
