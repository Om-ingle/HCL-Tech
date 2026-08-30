import { aiConfigSchema } from "@/lib/validation/schemas";
import { getAiStatus } from "@/lib/ai/aiService";
import { saveAiConfig } from "@/lib/ai/config";
import { aiScopeId } from "@/lib/server/auth";
import { PROVIDER_META, PROVIDER_IDS } from "@/lib/ai/types";
import { ok, parseBody, route } from "@/lib/server/http";

export const runtime = "nodejs";

// GET → current (key-free) AI status + provider metadata for the settings UI.
export const GET = route(async () => {
  const status = await getAiStatus(await aiScopeId());
  return ok({ status, providers: PROVIDER_META, providerIds: PROVIDER_IDS });
});

// POST → persist provider/model/key/mode for THIS browser session only.
// The raw key is never returned.
export const POST = route(async (req) => {
  const input = await parseBody(req, aiConfigSchema);
  const sid = await aiScopeId();
  await saveAiConfig(input, sid);
  const status = await getAiStatus(sid);
  return ok({ status });
});
