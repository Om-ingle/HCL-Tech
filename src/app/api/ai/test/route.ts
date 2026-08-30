import { aiConfigSchema } from "@/lib/validation/schemas";
import { testConnection } from "@/lib/ai/aiService";
import { aiScopeId } from "@/lib/server/auth";
import { ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// Test a provider/key without persisting. Uses this session's stored key if none supplied.
export const POST = route(async (req) => {
  const input = await parseBody(req, aiConfigSchema);
  const result = await testConnection(input, await aiScopeId());
  return ok(result);
});
