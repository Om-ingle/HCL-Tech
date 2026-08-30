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
// the field is free-form (Custom model), so a stale saved id never blocks the
// user: the service layer retries on the provider's default when a vendor
// reports the saved model as retired/not found.
export interface ModelOption {
  id: string;
  label: string;
  /** "free" = a genuinely free endpoint/slug · "free-tier" = free usage tier
   *  with rate limits · "paid" = no free API access. Never guess "free". */
  cost: "free" | "free-tier" | "paid";
}

export const PROVIDER_META: Record<
  ProviderId,
  {
    label: string;
    models: ModelOption[];
    defaultModel: string;
    keyHint: string;
    keyUrl: string;
    note: string;
  }
> = {
  gemini: {
    label: "Google Gemini",
    models: [
      { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", cost: "free-tier" },
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", cost: "free-tier" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", cost: "free-tier" },
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", cost: "free-tier" },
    ],
    defaultModel: "gemini-3.7-flash",
    keyHint: "AIza…",
    keyUrl: "https://aistudio.google.com/app/apikey",
    note: "Free tier in AI Studio (rate-limited per day). Native JSON schema output.",
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      { id: "google/gemini-3.5-flash-lite:free", label: "Gemini 3.5 Flash-Lite", cost: "free" },
      { id: "z-ai/glm-5.2:free", label: "GLM 5.2", cost: "free" },
      { id: "minimax/minimax-m3:free", label: "MiniMax M3", cost: "free" },
      { id: "google/gemini-3.7-flash", label: "Gemini 3.7 Flash", cost: "paid" },
      { id: "openai/gpt-4o-mini", label: "GPT-4o mini", cost: "paid" },
    ],
    defaultModel: "google/gemini-3.5-flash-lite:free",
    keyHint: "sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
    note: "Gateway — pick almost any model by its slug. Free slugs support JSON output but rotate; check openrouter.ai/models if one 404s.",
  },
  claude: {
    label: "Anthropic Claude",
    models: [
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", cost: "paid" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", cost: "paid" },
      { id: "claude-opus-5", label: "Claude Opus 5", cost: "paid" },
    ],
    defaultModel: "claude-haiku-4-5-20251001",
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
    note: "Structured output via tool use. No free API tier — all models are paid.",
  },
  grok: {
    label: "xAI Grok",
    models: [
      { id: "grok-4-fast", label: "Grok 4 Fast", cost: "paid" },
      { id: "grok-4", label: "Grok 4", cost: "paid" },
      { id: "grok-3-mini", label: "Grok 3 Mini", cost: "paid" },
    ],
    defaultModel: "grok-4-fast",
    keyHint: "xai-…",
    keyUrl: "https://console.x.ai",
    note: "OpenAI-compatible chat API. No free API tier — all models are paid.",
  },
};

export const PROVIDER_IDS: ProviderId[] = ["gemini", "openrouter", "claude", "grok"];
