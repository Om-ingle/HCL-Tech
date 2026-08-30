import { assistantSchema } from "@/lib/validation/schemas";
import { answerQuestion, getAiStatus } from "@/lib/ai/aiService";
import { buildAssistantContext } from "@/lib/server/service";
import { aiSessionId } from "@/lib/server/session";
import { ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Grounded Q&A assistant. Uses the learner's real context when a profile is given.
export const POST = route(async (req) => {
  const { profileId, question, history } = await parseBody(req, assistantSchema);
  const sid = aiSessionId();

  if (profileId) {
    const ctx = await buildAssistantContext(profileId);
    if (ctx) {
      const [answer, aiStatus] = await Promise.all([
        answerQuestion(question, ctx, history ?? [], sid),
        getAiStatus(sid),
      ]);
      return ok({ ...answer, aiStatus });
    }
  }

  return ok({
    text: "Tell me your goal on the home page first — once you have a path, I can answer questions about your gaps, timeline, and next steps.",
    source: "fallback",
    aiStatus: await getAiStatus(sid),
  });
});
