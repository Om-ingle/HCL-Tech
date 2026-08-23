import type {
  LLMProvider,
  LLMRequest,
  LLMResult,
  ProviderId,
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

// Shared adapter for OpenAI-compatible chat APIs (OpenRouter, xAI Grok).
// We deliberately DON'T force response_format json — support varies by model,
// and prompt-instruction + tolerant extraction is more reliable across the board.
export function makeOpenAICompatProvider(opts: {
  id: ProviderId;
  label: string;
  baseUrl: string;
  extraHeaders?: () => Record<string, string>;
}): LLMProvider {
  async function generate(req: LLMRequest, cfg: ResolvedAiConfig): Promise<LLMResult> {
    assertKey(cfg);
    const messages: { role: string; content: string }[] = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    for (const m of req.messages) messages.push({ role: m.role, content: m.content });

    const res = await fetchWithTimeout(`${opts.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        ...(opts.extraHeaders?.() ?? {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxTokens ?? 1024,
      }),
    });
    if (!res.ok) throw new Error(`${opts.label} ${res.status}: ${await errorBody(res)}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = String(data.choices?.[0]?.message?.content ?? "").trim();
    return { text, raw: data };
  }

  return {
    id: opts.id,
    label: opts.label,
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
}
