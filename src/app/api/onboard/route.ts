import { extractProfile, getAiStatus } from "@/lib/ai/aiService";
import { onboardSchema } from "@/lib/validation/schemas";
import { ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Conversational onboarding: free text → structured profile draft (LLM or fallback).
export const POST = route(async (req) => {
  const { text } = await parseBody(req, onboardSchema);
  const [result, aiStatus] = await Promise.all([extractProfile(text), getAiStatus()]);
  return ok({ ...result, aiStatus });
});
