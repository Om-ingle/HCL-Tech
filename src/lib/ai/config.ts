import { prisma } from "@/lib/db";
import { PROVIDER_META, type AiMode, type ProviderId, type ResolvedAiConfig } from "./types";
import type { AiConfigInput } from "@/lib/validation/schemas";

function defaultModel(provider: ProviderId): string {
  return PROVIDER_META[provider]?.defaultModel ?? "";
}

/**
 * Resolve the effective AI config for ONE anonymous browser session, server-side
 * only. The AiConfig row id IS the session id (HttpOnly cookie set in
 * middleware) — config is never shared between visitors:
 *   session has a saved, enabled row with a key → that provider, live
 *   no session / no row / demo mode → unavailable (Demo/Fallback)
 * There is deliberately NO global or environment fallback: one visitor's saved
 * key must never become every anonymous visitor's provider.
 * The raw apiKey never leaves the server (see toPublicStatus).
 */
export async function resolveAiConfig(sessionId: string): Promise<ResolvedAiConfig> {
  if (!sessionId) return unavailable();

  const row = await prisma.aiConfig.findUnique({ where: { id: sessionId } }).catch(() => null);
  const mode = ((row?.mode as AiMode) || "hybrid") as AiMode;

  if (mode !== "demo" && row && row.enabled && row.provider && row.apiKey) {
    const provider = row.provider as ProviderId;
    if (PROVIDER_META[provider]) {
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
  }

  // Row exists (or is disabled/demo) — show its provider in the UI, but never
  // treat it as live without a valid key.
  return unavailable(row);
}

function unavailable(row?: { provider: string; model: string; mode?: string } | null): ResolvedAiConfig {
  const provider = (row?.provider as ProviderId) || "gemini";
  return {
    provider,
    model: row?.model || defaultModel(provider),
    apiKey: "",
    mode: ((row?.mode as AiMode) || "hybrid") as AiMode,
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

/** Upsert runtime config. If apiKey is omitted, the existing key is preserved —
 *  UNLESS the provider changed, in which case the old key belongs to the old
 *  provider and must never be silently reused (a Gemini key against OpenRouter
 *  401s forever and the UI would still claim the provider is configured). */
export async function saveAiConfig(input: AiConfigInput, sessionId: string): Promise<void> {
  // Without a session there is nowhere private to store the key — refuse rather
  // than fall back to any shared location.
  if (!sessionId) throw new Error("No session — cannot store AI configuration.");

  const existing = await prisma.aiConfig.findUnique({ where: { id: sessionId } }).catch(() => null);
  const providerChanged = !!existing && existing.provider !== input.provider && !!existing.apiKey;
  const apiKey =
    input.apiKey !== undefined && input.apiKey !== ""
      ? input.apiKey
      : providerChanged
        ? ""
        : (existing?.apiKey ?? "");
  // A key being saved means the provider is meant to be live. Older UIs could
  // persist enabled=false alongside a key, silently disabling every AI call.
  const enabled = apiKey ? true : (input.enabled ?? true);
  const model = input.model?.trim() || defaultModel(input.provider);
  await prisma.aiConfig.upsert({
    where: { id: sessionId },
    create: {
      id: sessionId,
      provider: input.provider,
      model,
      apiKey,
      mode: input.mode ?? "hybrid",
      enabled,
    },
    update: {
      provider: input.provider,
      model,
      apiKey,
      mode: input.mode ?? "hybrid",
      enabled,
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

/** The session's stored key, used only to test a connection without re-typing. */
export async function getStoredKey(sessionId: string): Promise<string> {
  if (!sessionId) return "";
  const row = await prisma.aiConfig.findUnique({ where: { id: sessionId } }).catch(() => null);
  return row?.apiKey ?? "";
}
