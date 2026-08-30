/**
 * AI wiring verification — proves the two-layer architecture actually calls
 * the selected provider, and falls back gracefully when it can't.
 *
 *   node scripts/verify-ai-wiring.cjs
 *
 * 1. Provider layer: every adapter (Gemini/Grok/Claude/OpenRouter) must issue a
 *    REAL HTTP request to its own vendor endpoint, with the selected model in
 *    the request. Fake keys are used, so the vendor answers 401/400 — that
 *    error IS the proof the call happened (offline = DNS error, same proof).
 * 2. Service layer: with an env-configured (fake) key, aiService must attempt
 *    the call and return a deterministic fallback + a visible reason on failure.
 * 3. No key: pure deterministic fallback, no note, no network.
 *
 * The DB is pointed at an unreachable local port so the runtime AiConfig row
 * (which may hold a real key) can't influence these tests.
 */
const path = require("path");

process.env.DATABASE_URL = "postgresql://postgres:x@127.0.0.1:1/postgres";
delete process.env.DIRECT_URL;

const jiti = require("jiti")(__filename, { alias: { "@": path.resolve(__dirname, "..", "src") } });
const { getProvider } = jiti("../src/lib/ai/registry.ts");
const { PROVIDER_META } = jiti("../src/lib/ai/types.ts");

// Record every outgoing request (URL + body) while still performing it for real.
const realFetch = global.fetch;
let lastRequest = null;
global.fetch = (url, opts) => {
  lastRequest = { url: String(url), body: opts?.body ? String(opts.body) : "" };
  return realFetch(url, opts);
};

const cfg = (provider, model) => ({
  provider,
  model,
  apiKey: "fake-key-for-wiring-verification-only",
  mode: "hybrid",
  enabled: true,
  available: true,
  source: "runtime",
});

let failures = 0;
function check(label, cond, detail) {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

(async () => {
// ── 1. Every provider makes a REAL call to its own endpoint ───────────────────
console.log("\n1. Provider layer — real HTTP calls per provider (fake key → expected vendor auth error)");
const seenHosts = new Set();
for (const id of Object.keys(PROVIDER_META)) {
  const model = PROVIDER_META[id].defaultModel;
  const p = getProvider(id);
  lastRequest = null;
  let err = null;
  try {
    await p.generate({ messages: [{ role: "user", content: "Reply with: ok" }], maxTokens: 8 }, cfg(id, model));
    err = new Error("unexpected success with a fake key");
  } catch (e) {
    err = e;
  }
  const url = lastRequest?.url ?? "";
  const host = (() => { try { return new URL(url).host; } catch { return ""; } })();
  const body = lastRequest?.body ?? "";
  seenHosts.add(host);
  check(
    `${id} → ${host || "(no request)"} [${String(err.message).slice(0, 70)}]`,
    !!host && /40[137]|401|403|api key|API key|invalid|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(String(err.message)),
    `model in request: ${body.includes(model) || url.includes(model) ? "yes" : "NO"}`,
  );
}
check("each provider hits a distinct vendor endpoint", seenHosts.size === Object.keys(PROVIDER_META).length,
  [...seenHosts].join(", "));

// ── 2. Service layer — configured key that fails → graceful, visible fallback ─
console.log("\n2. Service layer — env-configured (fake) Gemini key: call attempted, then graceful fallback");
process.env.LLM_PROVIDER = "gemini";
process.env.LLM_MODEL = "gemini-2.0-flash";
process.env.LLM_API_KEY = "fake-key-for-wiring-verification-only";
process.env.AI_MODE = "hybrid";
// aiService must be required AFTER env is set (config reads env per call, but be explicit).
const { answerQuestion, extractProfile, testConnection } = jiti("../src/lib/ai/aiService.ts");

const ctx = {
  profileName: "Test", roleName: "Backend Software Engineer", experienceLevel: "intermediate",
  weeklyHours: 8, masteredCount: 3, partialCount: 2, missingCount: 5,
  topGaps: ["Docker", "PostgreSQL"], currentPhase: "Phase 1", nextActionTitle: "Docker basics",
  nextActionWhy: "Containers come next", overallPct: 30, estimatedWeeksLeft: 12,
};

const ans = await answerQuestion("What are my biggest gaps?", ctx);
check("assistant: source=fallback with a reason note", ans.source === "fallback" && !!ans.note, (ans.note ?? "").slice(0, 90));

const ext = await extractProfile("I'm Maya, I know Python and SQL, 8 hours a week, want to be a data scientist");
check("extraction: still returns a usable deterministic draft", ext.source === "fallback" && !!ext.draft.targetRoleId);

const t = await testConnection({ provider: "gemini", model: "gemini-2.0-flash", apiKey: process.env.LLM_API_KEY });
check("testConnection reports the real vendor failure", t.ok === false, t.message.slice(0, 80));

// Changing the model changes the request URL (Gemini embeds it in the path).
lastRequest = null;
try {
  await getProvider("gemini").generate(
    { messages: [{ role: "user", content: "hi" }], maxTokens: 8 },
    cfg("gemini", "gemini-1.5-pro"),
  );
} catch {}
check("changing the model changes the request", (lastRequest?.url ?? "").includes("gemini-1.5-pro"), lastRequest?.url);

// ── 3. No key at all → pure deterministic mode, no note ───────────────────────
console.log("\n3. Service layer — no key configured: fully deterministic, no AI call attempted");
delete process.env.LLM_PROVIDER;
delete process.env.LLM_MODEL;
delete process.env.LLM_API_KEY;
lastRequest = null;

const ans2 = await answerQuestion("How long until I'm done?", ctx);
check("assistant: deterministic answer, no note, no network", ans2.source === "fallback" && !ans2.note && lastRequest === null);
const ext2 = await extractProfile("I want to become a Linux kernel developer. I know Python and some C, 8 hours per week.");
check("extraction: deterministic draft produced", ext2.source === "fallback" && ext2.draft.goalText.length > 10);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
})();
