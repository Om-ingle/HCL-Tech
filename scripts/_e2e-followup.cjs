/** One-off: live LLM test — assistant resolves a follow-up using 2 prior turns. */
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.resolve(__dirname, "..", "src") } });
(async () => {
  const { buildAssistantContext } = jiti("../src/lib/server/service.ts");
  const { answerQuestion } = jiti("../src/lib/ai/aiService.ts");
  const { prisma } = jiti("../src/lib/db.ts");
  const row = await prisma.learnerProfile.findFirst({ orderBy: { createdAt: "desc" } });
  if (!row) { console.log("no profile in DB — skipped"); process.exit(0); }
  const ctx = await buildAssistantContext(row.id);
  console.log("learner context — role:", ctx.roleName, "| next action:", ctx.nextActionTitle, "| gaps:", ctx.topGaps.slice(2).join(", "));
  const history = [
    { role: "user", text: "What should I focus on first?" },
    { role: "assistant", text: `Start with "${ctx.nextActionTitle}" — it's your next best action toward ${ctx.roleName}.` },
  ];
  const a = await answerQuestion("Can I skip it?", ctx, history);
  console.log("\nfollow-up: 'Can I skip it?'");
  console.log("  source:", a.source, "| provider:", a.provider ?? "(none)");
  console.log("  text:", a.text);
  await prisma.$disconnect();
})().catch((e) => { console.error("ERR", String(e.message).slice(0, 300)); process.exit(1); });
