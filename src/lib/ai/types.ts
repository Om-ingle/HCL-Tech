// ── Provider-agnostic AI abstraction ─────────────────────────────────────────
// The rest of the application talks ONLY to these types + aiService.
// Provider adapters (gemini/openrouter/claude/grok) translate this common
// request/response shape into each vendor's HTTP API. Adding a provider means
// adding one adapter file — no domain/recommend/path code changes.

export type ProviderId = "gemini" | "openrouter" | "claude" | "grok";
export type AiMode = "hybrid" | "ai" | "demo";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  system?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResult {
  text: string;
  raw?: unknown;
}

export type JsonSchema = Record<string, unknown>;

export interface StructuredRequest extends LLMRequest {
  schema: JsonSchema;
  schemaName: string;
}

export interface ResolvedAiConfig {
  provider: ProviderId;
  model: string;
  apiKey: string;
  mode: AiMode;
  enabled: boolean;
  /** true when a usable key+provider is present */
  available: boolean;
  /** where the config came from — for display only */
  source: "runtime" | "env" | "none";
}

export interface TestResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
  model?: string;
}

// Each provider implements this. Stateless — config is passed per call so
// runtime settings changes take effect immediately.
export interface LLMProvider {
  id: ProviderId;
  label: string;
  generate(req: LLMRequest, cfg: ResolvedAiConfig): Promise<LLMResult>;
  generateStructured(req: StructuredRequest, cfg: ResolvedAiConfig): Promise<unknown>;
  testConnection(cfg: ResolvedAiConfig): Promise<TestResult>;
}

// Metadata that drives the AI Settings UI. `models` are suggestions only —
// the model field is free-form so a stale default never blocks the user.
export const PROVIDER_META: Record<
  ProviderId,
  {
    label: string;
    models: string[];
    defaultModel: string;
    keyHint: string;
    keyUrl: string;
    note: string;
  }
> = {
  gemini: {
    label: "Google Gemini",
    models: ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"],
    defaultModel: "gemini-2.0-flash",
    keyHint: "AIza…",
    keyUrl: "https://aistudio.google.com/app/apikey",
    note: "Fast & inexpensive. Native JSON schema output.",
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      "google/gemini-3.5-flash-lite",
      "google/gemini-3.7-flash",
      "minimax/minimax-m3:free",
      "z-ai/glm-5.2:free",
      "openai/gpt-4o-mini",
    ],
    defaultModel: "google/gemini-3.5-flash-lite",
    keyHint: "sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
    note: "Gateway — pick almost any model by its slug. Free slugs rotate; check openrouter.ai/models if one 404s.",
  },
  claude: {
    label: "Anthropic Claude",
    models: [
      "claude-3-5-haiku-latest",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-latest",
    ],
    defaultModel: "claude-3-5-haiku-latest",
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    note: "Structured output via tool use.",
  },
  grok: {
    label: "xAI Grok",
    models: ["grok-2-latest", "grok-beta"],
    defaultModel: "grok-2-latest",
    keyHint: "xai-…",
    keyUrl: "https://console.x.ai",
    note: "OpenAI-compatible chat API.",
  },
};

export const PROVIDER_IDS: ProviderId[] = ["gemini", "openrouter", "claude", "grok"];
