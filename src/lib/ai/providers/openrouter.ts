import { makeOpenAICompatProvider } from "./openaiCompat";

export const openrouterProvider = makeOpenAICompatProvider({
  id: "openrouter",
  label: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  // Optional attribution headers OpenRouter recommends; harmless if unused.
  extraHeaders: () => ({
    "HTTP-Referer": "https://learning-navigator.app",
    "X-Title": "Learning Navigator",
  }),
});
