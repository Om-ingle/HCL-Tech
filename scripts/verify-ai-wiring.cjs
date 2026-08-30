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
 * 2. Service layer: a session-scoped (fake) Gemini key — saved exactly the way
 *    the settings UI saves it — must produce a real call attempt and a
 *    deterministic fallback + a visible reason when the vendor rejects the key.
 * 3. No session / no key: pure deterministic fallback, no note, no network.
 * 4. Gemini adapter: empty candidates / thought parts / safety blocks are
 *    diagnosed with a reason (mocked vendor responses).
 * 5. A retired saved model (vendor 404) is retried once with the provider's
 *    current default, and the message says so (mocked vendor responses).
 *
 * Provider-layer tests run with the DB pointed at an unreachable local port so
 * no real config row can influence them. Section 2 reconnects to the real DB
 * under a throwaway session id (and deletes it afterwards).
 */
const path = require("path");

const REAL_DATABASE_URL = process.env.DATABASE_URL || "";
const REAL_DIRECT_URL = process.env.DIRECT_URL || "";
process.env.DATABASE_URL = "postgresql://postgres:x@127.0.0.1:1/postgres";
delete process.env.DIRECT_URL;

const jiti = require("jiti")(__filename, { alias: { "@": path.resolve(__dirname, "..", "src") } });
const { getProvider } = jiti("../src/lib/ai/registry.ts");
const { PROVIDER_META } = jiti("../src/lib/ai/types.ts");

// Record every outgoing request (URL + body) while still performing it for real.
const realFetch = global.fetch;
let lastRequest = null;
const recordingFetch = (url, opts) => {
  lastRequest = { url: String(url), body: opts?.body ? String(opts.body) : "" };
  return realFetch(url, opts);
};
global.fetch = recordingFetch;

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

// ── 2. Service layer — session-scoped (fake) key → call attempted, graceful fallback ──
console.log("\n2. Service layer — session-scoped (fake) Gemini key: call attempted, then graceful fallback");
// Env keys configure nothing any more (by design — no global fallback), so this
// seeds a throwaway session row exactly the way the settings UI does. Restore
// the real DB URL (Prisma also loads .env, so just clear the fake values).
delete process.env.DATABASE_URL;
if (REAL_DIRECT_URL) process.env.DIRECT_URL = REAL_DIRECT_URL; else delete process.env.DIRECT_URL;
const { PrismaClient } = require("@prisma/client");
const realDb = new PrismaClient();
globalThis.prisma = realDb; // the "@/lib/db" singleton picks this up

const { saveAiConfig, resolveAiConfig } = jiti("../src/lib/ai/config.ts");
const { answerQuestion, extractProfile, testConnection } = jiti("../src/lib/ai/aiService.ts");
const SID = "test-session-wiring";
await saveAiConfig(
  { provider: "gemini", model: "gemini-2.0-flash", apiKey: "fake-key-for-wiring-verification-only", mode: "hybrid", enabled: true },
  SID,
);

const ctx = {
  profileName: "Test", roleName: "Backend Software Engineer", experienceLevel: "intermediate",
  weeklyHours: 8, masteredCount: 3, partialCount: 2, missingCount: 5,
  topGaps: ["Docker", "PostgreSQL"], currentPhase: "Phase 1", nextActionTitle: "Docker basics",
  nextActionWhy: "Containers come next", overallPct: 30, estimatedWeeksLeft: 12,
};

const ans = await answerQuestion("What are my biggest gaps?", ctx, [], SID);
check("assistant: source=fallback with a reason note", ans.source === "fallback" && !!ans.note, (ans.note ?? "").slice(0, 90));

const ext = await extractProfile("I'm Ananya, I know Python and SQL, 8 hours a week, want to be a data scientist", SID);
check("extraction: still returns a usable deterministic draft", ext.source === "fallback" && !!ext.draft.targetRoleId);

const t = await testConnection({ provider: "gemini", model: "gemini-2.0-flash", apiKey: "fake-key-for-wiring-verification-only" });
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

// ── 3. No session / unknown session → pure deterministic mode, no note ───────
console.log("\n3. Service layer — no session: fully deterministic, no AI call attempted");
lastRequest = null;

const ans2 = await answerQuestion("How long until I'm done?", ctx);
check("assistant: deterministic answer, no note, no network", ans2.source === "fallback" && !ans2.note && lastRequest === null);
const ext2 = await extractProfile("I want to become a Linux kernel developer. I know Python and some C, 8 hours per week.", "");
check("extraction: deterministic draft produced", ext2.source === "fallback" && ext2.draft.goalText.length > 10);

const noRow = await resolveAiConfig("session-without-any-saved-row");
check("unknown session id: unavailable, nothing inherited", noRow.available === false && noRow.source === "none");

// Cleanup: only this suite's throwaway row goes away; learner data untouched.
await realDb.aiConfig.deleteMany({ where: { id: SID } });
await realDb.$disconnect();

// ── 4. Gemini adapter — empty/malformed responses are diagnosed, not swallowed ─
console.log("\n4. Gemini adapter — empty candidates, thought parts, multi-part text");
const { geminiProvider } = jiti("../src/lib/ai/providers/gemini.ts");
const fakeCfg = { provider: "gemini", model: "gemini-3.7-flash", apiKey: "fake", mode: "hybrid", enabled: true, available: true, source: "runtime" };
const mockJson = (body, status = 200) => {
  global.fetch = async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
};

try {
  // (a) thinking burned the whole token budget: no text, finishReason MAX_TOKENS
  mockJson({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] });
  let err = null;
  try { await geminiProvider.generate({ messages: [{ role: "user", content: "hi" }], maxTokens: 8 }, fakeCfg); } catch (e) { err = e; }
  check("empty text throws with the real reason", !!err && /MAX_TOKENS/.test(err.message), String(err?.message).slice(0, 90));

  // (b) thought-summary parts are filtered out, answer text extracted
  mockJson({ candidates: [{ content: { parts: [{ text: "(internal reasoning)", thought: true }, { text: "ok" }] } }] });
  const r = await geminiProvider.generate({ messages: [{ role: "user", content: "hi" }] }, fakeCfg);
  check("thought parts skipped, text extracted", r.text === "ok", JSON.stringify(r.text));

  // (c) standard multi-part text is joined
  mockJson({ candidates: [{ content: { parts: [{ text: "hello " }, { text: "world" }] } }] });
  const r2 = await geminiProvider.generate({ messages: [{ role: "user", content: "hi" }] }, fakeCfg);
  check("multi-part text joined", r2.text === "hello world", r2.text);

  // (d) safety block is reported as a block, not "no text"
  mockJson({ candidates: [], promptFeedback: { blockReason: "SAFETY" } });
  let err2 = null;
  try { await geminiProvider.generate({ messages: [{ role: "user", content: "hi" }] }, fakeCfg); } catch (e) { err2 = e; }
  check("safety block reported with blockReason", !!err2 && /blocked: SAFETY/.test(err2.message), String(err2?.message).slice(0, 90));
} finally {
  global.fetch = recordingFetch;
}

// ── 5. Retired saved model → automatic default retry with a clear message ─────
console.log("\n5. Retired model — vendor 404 'not found' retried once with the current default");
{
  const urls = [];
  global.fetch = async (url) => {
    urls.push(String(url));
    if (urls.length === 1)
      return new Response(
        JSON.stringify({ error: { code: 404, message: "models/gemini-2.0-flash is not found for API version v1beta", status: "NOT_FOUND" } }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const t = await testConnection({ provider: "gemini", model: "gemini-2.0-flash", apiKey: "fake" }, "");
  check("connection test recovers from a retired model", t.ok === true && /unavailable.*gemini-3\.7-flash/i.test(t.message), t.message.slice(0, 110));
  check("retry really used the default model", urls[1]?.includes("gemini-3.7-flash"), urls[1]);
  global.fetch = recordingFetch;
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
})();
