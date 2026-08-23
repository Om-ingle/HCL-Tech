import { aiConfigSchema } from "@/lib/validation/schemas";
import { testConnection } from "@/lib/ai/aiService";
import { ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Test a provider/key without persisting. Uses the stored key if none supplied.
export const POST = route(async (req) => {
  const input = await parseBody(req, aiConfigSchema);
  const result = await testConnection(input);
  return ok(result);
});
