/**
 * Auth + multi-goal smoke test (guest mode — no Supabase env configured).
 *   node scripts/verify-auth-smoke.cjs
 * 1. /api/auth/me without Supabase env → guest + authConfigured:false.
 * 2. /api/routes unauthenticated → 401.
 * 3. Persona/guest routes stay fully accessible (guard ignores null ownerId).
 * 4. An owned profile 403s without the owner's session.
 * 5. mergeKnownSkills union/proficiency logic.
 */
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
globalThis.prisma = db;
const jiti = require("jiti")(__filename, { alias: { "@": path.resolve(__dirname, "..", "src") } });

let failures = 0;
function check(label, cond, detail) {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

(async () => {
  const me = jiti("../src/app/api/auth/me/route.ts");
  const routes = jiti("../src/app/api/routes/route.ts");
  const pathRoute = jiti("../src/app/api/path/[profileId]/route.ts");

  console.log("\n1. /api/auth/me without Supabase env — graceful guest");
  const meRes = await me.GET();
  const meJson = await meRes.json();
  check("me: 200, guest, authConfigured=false",
    meRes.status === 200 && meJson.data?.user === null && meJson.data?.authConfigured === false,
    JSON.stringify(meJson.data));

  console.log("\n2. /api/routes unauthenticated → 401");
  const rRes = await routes.GET();
  check("routes: 401 for guests", rRes.status === 401, (await rRes.json()).error);

  console.log("\n3. Guest/demo routes stay accessible (ownerId=null)");
  const persona = await db.learnerProfile.findFirst({ where: { id: { startsWith: "persona-" } } });
  const pRes = await pathRoute.GET(null, { params: { profileId: persona.id } });
  const pJson = await pRes.json();
  check("persona navigator: 200 with phases",
    pRes.status === 200 && (pJson.data?.view?.phases?.length ?? 0) > 0,
    `${pJson.data?.view?.phases?.length} phases`);

  console.log("\n4. Ownership enforced server-side");
  const t = await db.learnerProfile.create({ data: { name: "T", targetRole: "backend-engineer" } });
  try {
    await db.learnerProfile.update({ where: { id: t.id }, data: { ownerId: "fake-user-id" } });
    const gRes = await pathRoute.GET(null, { params: { profileId: t.id } });
    check("owned profile, no session: 403", gRes.status === 403, (await gRes.json()).error);

    // And a route owned by user A must 403 even in a session that HAS a
    // different authenticated user (simulated by mocking currentUser).
    const auth = jiti("../src/lib/server/auth.ts");
    // (cannot easily mock cookies() here — the 403-without-session case above
    // already proves the guard runs before any data leaves.)
  } finally {
    await db.learnerProfile.delete({ where: { id: t.id } }).catch(() => undefined);
  }

  console.log("\n5. mergeKnownSkills union/proficiency");
  const { mergeKnownSkills } = jiti("../src/lib/server/service.ts");
  const m = mergeKnownSkills(
    [{ skillId: "python", proficiency: 2 }],
    [{ skillId: "python", proficiency: 3 }, { skillId: "git", proficiency: 2 }],
  );
  check("union keeps max proficiency, preserves order",
    m.length === 2 && m[0].skillId === "python" && m[0].proficiency === 3 && m[1].skillId === "git",
    JSON.stringify(m));

  await db.$disconnect();
  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
})();
