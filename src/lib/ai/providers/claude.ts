import type {
  LLMProvider,
  LLMRequest,
  LLMResult,
  ResolvedAiConfig,
  StructuredRequest,
} from "../types";
import {
  assertKey,
  errorBody,
  extractJson,
  fetchWithTimeout,
  joinSystem,
  pingWith,
  schemaInstruction,
} from "../util";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

async function generate(req: LLMRequest, cfg: ResolvedAiConfig): Promise<LLMResult> {
  assertKey(cfg);
  const res = await fetchWithTimeout(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: req.maxTokens ?? 1024,
      temperature: req.temperature ?? 0.4,
      ...(req.system ? { system: req.system } : {}),
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await errorBody(res)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  return { text, raw: data };
}

export const claudeProvider: LLMProvider = {
  id: "claude",
  label: "Anthropic Claude",
  generate,
  generateStructured: async (req: StructuredRequest, cfg) => {
    const augmented: LLMRequest = {
      ...req,
      system: joinSystem(req.system, schemaInstruction(req.schema)),
    };
    const r = await generate(augmented, cfg);
    return extractJson(r.text);
  },
  testConnection: (cfg) => pingWith(cfg, generate),
};
