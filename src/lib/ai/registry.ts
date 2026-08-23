import type { LLMProvider, ProviderId } from "./types";
import { geminiProvider } from "./providers/gemini";
import { openrouterProvider } from "./providers/openrouter";
import { grokProvider } from "./providers/grok";
import { claudeProvider } from "./providers/claude";

// The ONLY place that knows the concrete provider set. Add a provider by
// adding one adapter file and one line here — nothing else in the app changes.
const REGISTRY: Record<ProviderId, LLMProvider> = {
  gemini: geminiProvider,
  openrouter: openrouterProvider,
  grok: grokProvider,
  claude: claudeProvider,
};

export function getProvider(id: ProviderId): LLMProvider | undefined {
  return REGISTRY[id];
}
