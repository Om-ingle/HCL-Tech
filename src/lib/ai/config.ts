import { prisma } from "@/lib/db";
import { PROVIDER_META, type AiMode, type ProviderId, type ResolvedAiConfig } from "./types";
import type { AiConfigInput } from "@/lib/validation/schemas";

function defaultModel(provider: ProviderId): string {
  return PROVIDER_META[provider]?.defaultModel ?? "";
}

/**
 * Resolve the effective AI config, server-side only. Precedence:
 *   1. runtime config row (set via AI Settings), if enabled + has key
 *   2. environment variables
 *   3. none → Demo/Fallback mode (available: false)
 * The raw apiKey never leaves the server (see toPublicStatus for what the UI gets).
 */
export async function resolveAiConfig(): Promise<ResolvedAiConfig> {
  const row = await prisma.aiConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  const envProvider = (process.env.LLM_PROVIDER || "").trim() as ProviderId | "";
  const envKey = (process.env.LLM_API_KEY || "").trim();
  const envMode = ((process.env.AI_MODE as AiMode) || "hybrid") as AiMode;
  const mode: AiMode = (row?.mode as AiMode) || envMode || "hybrid";

  if (mode !== "demo" && row && row.enabled && row.provider && row.apiKey) {
    const provider = row.provider as ProviderId;
    return {
      provider,
      model: row.model || defaultModel(provider),
      apiKey: row.apiKey,
      mode,
      enabled: true,
      available: true,
      source: "runtime",
    };
  }

  if (mode !== "demo" && envProvider && envKey && PROVIDER_META[envProvider as ProviderId]) {
    const provider = envProvider as ProviderId;
    return {
      provider,
      model: (process.env.LLM_MODEL || "").trim() || defaultModel(provider),
      apiKey: envKey,
      mode,
      enabled: true,
      available: true,
      source: "env",
    };
  }

  const fallbackProvider = (row?.provider as ProviderId) || (envProvider as ProviderId) || "gemini";
  return {
    provider: fallbackProvider,
    model: row?.model || (process.env.LLM_MODEL || "").trim() || defaultModel(fallbackProvider),
    apiKey: "",
    mode,
    enabled: false,
    available: false,
    source: "none",
  };
}

export interface PublicAiStatus {
  provider: ProviderId;
  providerLabel: string;
  model: string;
  mode: AiMode;
  available: boolean;
  source: "runtime" | "env" | "none";
  hasKey: boolean;
  maskedKey: string;
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••";
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

export function toPublicStatus(cfg: ResolvedAiConfig): PublicAiStatus {
  return {
    provider: cfg.provider,
    providerLabel: PROVIDER_META[cfg.provider]?.label ?? cfg.provider,
    model: cfg.model,
    mode: cfg.mode,
    available: cfg.available,
    source: cfg.source,
    hasKey: !!cfg.apiKey,
    maskedKey: maskKey(cfg.apiKey),
  };
}

/** Upsert runtime config. If apiKey is omitted, the existing key is preserved. */
export async function saveAiConfig(input: AiConfigInput): Promise<void> {
  const existing = await prisma.aiConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  const apiKey =
    input.apiKey !== undefined && input.apiKey !== "" ? input.apiKey : existing?.apiKey ?? "";
  await prisma.aiConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      provider: input.provider,
      model: input.model ?? "",
      apiKey,
      mode: input.mode ?? "hybrid",
      enabled: input.enabled ?? true,
    },
    update: {
      provider: input.provider,
      model: input.model ?? "",
      apiKey,
      mode: input.mode ?? "hybrid",
      enabled: input.enabled ?? true,
    },
  });
}

/** Build a ResolvedAiConfig from an input for a one-off connection test (not persisted). */
export function configForTest(input: AiConfigInput, existingKey: string): ResolvedAiConfig {
  const provider = input.provider;
  return {
    provider,
    model: input.model || defaultModel(provider),
    apiKey: input.apiKey && input.apiKey !== "" ? input.apiKey : existingKey,
    mode: input.mode ?? "hybrid",
    enabled: true,
    available: true,
    source: "runtime",
  };
}

export async function getStoredKey(): Promise<string> {
  const row = await prisma.aiConfig.findUnique({ where: { id: "singleton" } }).catch(() => null);
  return row?.apiKey ?? "";
}
