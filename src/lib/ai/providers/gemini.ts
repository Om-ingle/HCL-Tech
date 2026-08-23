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

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function generate(req: LLMRequest, cfg: ResolvedAiConfig, jsonMode = false): Promise<LLMResult> {
  assertKey(cfg);
  const url = `${BASE}/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
  const body: Record<string, unknown> = {
    contents: req.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: req.temperature ?? 0.4,
      maxOutputTokens: req.maxTokens ?? 1024,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (req.system) body.systemInstruction = { parts: [{ text: req.system }] };

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await errorBody(res)}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  return { text, raw: data };
}

export const geminiProvider: LLMProvider = {
  id: "gemini",
  label: "Google Gemini",
  generate: (req, cfg) => generate(req, cfg, false),
  generateStructured: async (req: StructuredRequest, cfg) => {
    const augmented: LLMRequest = {
      ...req,
      system: joinSystem(req.system, schemaInstruction(req.schema)),
    };
    const r = await generate(augmented, cfg, true);
    return extractJson(r.text);
  },
  testConnection: (cfg) => pingWith(cfg, (rq, cf) => generate(rq, cf, false)),
};
