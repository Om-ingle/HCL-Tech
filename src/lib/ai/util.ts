import type { JsonSchema, LLMRequest, LLMResult, ResolvedAiConfig, TestResult } from "./types";

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs = 22000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function errorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "";
  }
}

/** Best-effort JSON extraction from a model's text response. */
export function extractJson(text: string): unknown {
  if (!text || !text.trim()) throw new Error("Empty model response");
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    /* fall through to bracket scan */
  }
  const firstObj = s.indexOf("{");
  const firstArr = s.indexOf("[");
  let start = firstObj;
  let close = "}";
  if (firstArr >= 0 && (firstArr < firstObj || firstObj < 0)) {
    start = firstArr;
    close = "]";
  }
  if (start < 0) throw new Error("No JSON found in response");
  const last = s.lastIndexOf(close);
  if (last <= start) throw new Error("Malformed JSON in response");
  return JSON.parse(s.slice(start, last + 1));
}

export function schemaInstruction(schema: JsonSchema): string {
  return `Respond with ONLY a single valid JSON value conforming to this JSON schema. No prose, no code fences.\nSchema: ${JSON.stringify(schema)}`;
}

export function joinSystem(base: string | undefined, extra: string): string {
  return base ? `${base}\n\n${extra}` : extra;
}

export function assertKey(cfg: { apiKey?: string }): void {
  if (!cfg.apiKey) throw new Error("Missing API key");
}

type GenFn = (req: LLMRequest, cfg: ResolvedAiConfig) => Promise<LLMResult>;

export async function pingWith(cfg: ResolvedAiConfig, gen: GenFn): Promise<TestResult> {
  const start = Date.now();
  try {
    const r = await gen(
      { messages: [{ role: "user", content: "Reply with the single word: ok" }], maxTokens: 8, temperature: 0 },
      cfg,
    );
    const ok = !!r.text;
    return {
      ok,
      message: ok ? "Connected successfully" : "Connected, but no text returned",
      latencyMs: Date.now() - start,
      model: cfg.model,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Connection failed",
      latencyMs: Date.now() - start,
    };
  }
}
