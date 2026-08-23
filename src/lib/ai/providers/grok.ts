import { makeOpenAICompatProvider } from "./openaiCompat";

export const grokProvider = makeOpenAICompatProvider({
  id: "grok",
  label: "xAI Grok",
  baseUrl: "https://api.x.ai/v1",
});
