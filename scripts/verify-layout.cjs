/**
 * Layout verification — renders every main page in headless Edge at each
 * support width and FAILS on page-level horizontal overflow or any content
 * extending past the viewport. No new dependencies: talks to Chrome DevTools
 * Protocol over a hand-rolled localhost WebSocket.
 *
 *   node scripts/verify-layout.cjs
 *
 * Spawns `next dev` on :3111 and headless Edge on :9333, seeds a demo learner,
 * injects the persisted profileId into localStorage (exactly the shape the
 * zustand persist middleware writes), then measures:
 *   - documentElement.scrollWidth vs clientWidth  (page-level overflow)
 *   - every element with text/interactive content whose rect leaves the
 *     viewport (clipped cards, trapped columns, rogue fixed widths)
 */
const { spawn } = require("child_process");
const net = require("net");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Random ports per run: an orphaned dev server or Edge from an unclean
// previous teardown must not silently steal the fixed port (next dev would
// just pick another port and the readiness probe would never pass).
const PORT = 3100 + Math.floor(Math.random() * 400);
const CDP = 9300 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const WIDTHS = [375, 430, 600, 768, 1024, 1280, 1440];

let failures = 0;
function check(label, cond, detail) {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

/* ── minimal WebSocket client (localhost, small text frames) ─────────────── */
class Ws {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.handlers = new Map();
    this.listeners = [];
    this.nextId = 1;
    socket.on("data", (d) => {
      this.buf = Buffer.concat([this.buf, d]);
      for (let f = this.parse(); f; f = this.parse()) this.handle(f);
    });
  }
  parse() {
    const b = this.buf;
    if (b.length < 2) return null;
    const fin = (b[0] & 0x80) !== 0;
    const op = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (b.length < 4) return null;
      len = b.readUInt16BE(2);
      off = 4;
    } else if (len === 127) {
      if (b.length < 10) return null;
      len = Number(b.readBigUInt64BE(2));
      off = 10;
    }
    let mask = null;
    if (masked) {
      if (b.length < off + 4) return null;
      mask = b.subarray(off, off + 4);
      off += 4;
    }
    if (b.length < off + len) return null;
    let payload = b.subarray(off, off + len);
    if (mask) {
      const out = Buffer.alloc(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
      payload = out;
    }
    this.buf = b.subarray(off + len);
    return { fin, op, payload };
  }
  handle(f) {
    if (f.op === 0x9) return this.frame(0xa, f.payload); // ping → pong
    if (f.op === 0x8) return this.socket.end();
    if (f.op !== 0x1 && f.op !== 0x0) return;
    this.frags.push(f);
    if (!f.fin) return;
    const msg = JSON.parse(Buffer.concat(this.frags.map((x) => x.payload)).toString("utf8"));
    this.frags = [];
    if (msg.id && this.handlers.has(msg.id)) {
      const h = this.handlers.get(msg.id);
      this.handlers.delete(msg.id);
      msg.error ? h.reject(new Error(msg.error.message)) : h.resolve(msg.result);
    } else if (msg.method) {
      this.listeners.forEach((cb) => cb(msg));
    }
  }
  frame(op, payload) {
    const mask = Buffer.from([0x11, 0x22, 0x33, 0x44]);
    const len = payload.length;
    const header =
      len < 126 ? Buffer.from([0x80 | op, 0x80 | len]) : Buffer.from([0x80 | op, 0x80 | 126, len >> 8, len & 255]);
    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
    this.socket.write(Buffer.concat([header, mask, masked]));
  }
  send(method, params = {}) {
    const id = this.nextId++;
    const p = new Promise((resolve, reject) => this.handlers.set(id, { resolve, reject }));
    this.frame(0x1, Buffer.from(JSON.stringify({ id, method, params })));
    return p;
  }
  on(cb) {
    this.listeners.push(cb);
  }
}

function wsConnect(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = http.request({
      host: "127.0.0.1",
      port: u.port,
      path: u.pathname + u.search,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Key": Buffer.from(`key-${Math.random()}`).toString("base64"),
        "Sec-WebSocket-Version": "13",
      },
    });
    req.on("upgrade", (res, socket) => resolve(new Ws(socket)));
    req.on("error", reject);
    req.end();
  });
}

function jget(port, p, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, path: p, method }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => {
        try {
          resolve(JSON.parse(b));
        } catch {
          reject(new Error(`bad json from ${p}: ${b.slice(0, 120)}`));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, ms, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if (await fn()) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`timeout waiting for ${label}`);
}

function findEdge() {
  const roots = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles];
  for (const root of roots) {
    if (!root) continue;
    for (const p of [
      path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
    ]) {
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error("no Edge/Chrome found");
}

/* ── page driving ─────────────────────────────────────────────────────────── */
async function evalJs(ws, expression) {
  const r = await ws.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

async function navigate(ws, url) {
  const loaded = new Promise((r) => {
    const cb = (m) => {
      if (m.method === "Page.loadEventFired") {
        ws.listeners.splice(ws.listeners.indexOf(cb), 1);
        r();
      }
    };
    ws.on(cb);
  });
  await ws.send("Page.navigate", { url });
  await Promise.race([loaded, sleep(20000)]);
  // Client components: wait for hydration + data fetch (spinner gone), like a user would.
  await waitFor(
    () => evalJs(ws, `!document.querySelector(".animate-spin") && !!document.querySelector("main")`),
    25000,
    `page idle ${url}`,
  ).catch(() => {});
  await sleep(300);
}

const MEASURE = `(() => {
  const de = document.documentElement, vw = de.clientWidth;
  const bad = [];
  const clipped = [];
  const name = (el) => "<" + el.tagName.toLowerCase() + "." +
    String(el.getAttribute("class") || "").split(" ").filter(Boolean).slice(0, 3).join(".") + ">";
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    const interactive = el.matches("button,a,input,select,textarea,svg,img,header,nav");
    if (!interactive && !(el.innerText || "").trim()) continue; // skip decorative absolutes
    if (r.right > vw + 1 || r.left < -1) bad.push(name(el) + " R=" + Math.round(r.right) + " vw=" + vw);
  }
  // Deepest offenders — the leaf elements that actually impose the width.
  const leaves = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.right <= vw + 1) continue;
    const interactive = el.matches("button,a,input,select,textarea,svg,img,header,nav");
    if (!interactive && !(el.innerText || "").trim()) continue;
    const childWider = [...el.children].some((c) => c.getBoundingClientRect().right > vw + 1);
    if (!childWider) leaves.push(name(el) + ' "' + (el.innerText || "").trim().slice(0, 40) + '"');
  }
  // Content wider than its own card — the "card clipped on the right" case that
  // page-level overflow misses when the card sits mid-viewport.
  for (const card of document.querySelectorAll('[class*="shadow-card"]')) {
    const cr = card.getBoundingClientRect();
    for (const el of card.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || getComputedStyle(el).position !== "static") continue;
      if (r.right > cr.right + 1)
        clipped.push(name(el) + " R=" + Math.round(r.right) + " card=" + Math.round(cr.right));
    }
  }
  // Empirical culprit hunt: hide each element in turn; whichever element's
  // removal collapses the overflow is the one imposing the min-content.
  // Ancestors of a culprit trivially match too, so keep only the deepest.
  let culprits = [];
  if (de.scrollWidth > vw + 1) {
    const before = de.scrollWidth;
    const reducers = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("script,style,noscript")) continue;
      if (el.getBoundingClientRect().width === 0) continue;
      const prev = el.style.display;
      el.style.display = "none";
      const now = de.scrollWidth;
      el.style.display = prev;
      if (before - now > 30) reducers.push(el);
    }
    const deepest = reducers.filter((el) => !reducers.some((o) => o !== el && el.contains(o)));
    culprits = deepest.slice(0, 5).map((el) => name(el) + ' "' + (el.innerText || "").trim().slice(0, 40) + '"');
  }
  const h1 = document.querySelector("h1");
  let pid = null;
  try { pid = (JSON.parse(localStorage.getItem("skill-atlas") || "{}").state || {}).profileId; } catch {}
  return { vw, sw: de.scrollWidth, bad: bad.slice(0, 4), leaves: leaves.slice(0, 4), clipped: clipped.slice(0, 4),
           culprits, marker: h1 ? h1.innerText.slice(0, 40) : "(no h1)", path: location.pathname, pid };
})()`;

;(async () => {
  // A previous run's hard teardown (taskkill /T /F) can leave .next with a
  // stale chunk manifest — the browser then 404s a chunk and parses the HTML
  // error page as JS ("SyntaxError: Invalid or unexpected token"). Start clean.
  fs.rmSync(path.join(__dirname, "..", ".next"), { recursive: true, force: true });

  // 1. Dev server
  const dev = spawn("npm.cmd", ["run", "dev"], {
    cwd: path.join(__dirname, ".."),
    shell: true,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
    detached: false,
  });
  try {
    await waitFor(() => fetch(BASE + "/api/seed").then((r) => r.ok), 300000, "dev server");

    // 2. Demo learner + a step id to open
    const seed = await (await fetch(BASE + "/api/seed", { method: "POST" })).json();
    const persona = seed.data.personas[0];
    const nav = await (await fetch(`${BASE}/api/path/${persona.id}`)).json();
    const step = nav.data.view.phases.flatMap((p) => p.steps).find((s) => s.status === "available") || nav.data.view.phases[0].steps[0];
    // Warm the step route's dev compile — a cold first navigation dies on a
    // ChunkLoadError and leaves a blank page (harness artifact, not app bug).
    const warm = await fetch(`${BASE}/step/${encodeURIComponent(step.id)}`).catch(() => null);
    console.log(`  warm  GET /step/${step.id} → ${warm ? warm.status : "fetch failed"}`);

    // A freshly onboarded learner with a realistic long goal — closer to what a
    // real user's route looks like than the hand-tuned demo personas.
    const onb = await (await fetch(BASE + "/api/onboard", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "final year student, know python and a bit of pandas, want to become an AI/ML engineer with strong MLOps and deployment skills, 10 hrs a week" }),
    })).json();
    const draft = onb.data?.draft ?? {};
    const probe = await (await fetch(BASE + "/api/profile", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Layout Probe", goalText: draft.goalText ?? "",
        targetRole: draft.targetRole ?? "AI/ML Engineer",
        experienceLevel: draft.experienceLevel ?? "beginner", learningStyle: "mixed",
        weeklyHours: 10, timelineWeeks: 24, careerOutcome: "", interests: [],
        knownSkillIds: draft.knownSkillIds ?? [],
        targetSkillIds: (onb.data?.targets ?? []).map((t) => t.skillId),
        dynamicSkills: onb.data?.dynamicSkills ?? [],
      }),
    })).json();
    const probeId = probe.data?.profile?.id;

    // Each page must actually render its real content — an error/spinner page
    // measures clean and would silently pass the layout check. Markers come
    // from the API data (role name / step title), never a substring that the
    // home page also contains.
    const role = nav.data.gap.roleName;
    const PAGES = [
      { path: "/", must: "Chart your route", widths: [375, 1440] },
      { path: "/navigator", must: role, widths: [320, 360, 375, 390, 412, 430, 600, 768, 820, 1024, 1280, 1440] },
      { path: "/gap", must: "Skill gap for", widths: [375, 768, 1440] },
      { path: "/dashboard", must: "progress", widths: [375, 768, 1440] },
      // Step pages are client-guarded; a direct full load loses the race with
      // zustand persist hydration and bounces to home (a real latent app bug,
      // out of layout scope) — so reach them the way a user does: click the
      // step's row on the Navigator.
      { path: `/step/${encodeURIComponent(step.id)}`, must: step.title, widths: [375, 768, 1440], viaNavigator: true },
    ];

    // 3. Headless Edge
    const edgePath = findEdge();
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-edge-"));
    const edge = spawn(edgePath, [
      "--headless=new",
      `--remote-debugging-port=${CDP}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--disable-gpu",
      "--hide-scrollbars",
      "about:blank",
    ], { stdio: "ignore" });
    try {
      await waitFor(() => jget(CDP, "/json/version"), 20000, "edge cdp");

      const target = await jget(CDP, "/json/new?about:blank", "PUT");
      const ws = await wsConnect(target.webSocketDebuggerUrl);
      await ws.send("Page.enable");
      await ws.send("Runtime.enable");
      await ws.send("Log.enable").catch(() => {});

      // Browser console + soft navigations, for diagnosing redirects.
      const consoleLog = [];
      ws.on((m) => {
        if (m.method === "Runtime.consoleAPICalled")
          consoleLog.push((m.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 160));
        if (m.method === "Runtime.exceptionThrown")
          consoleLog.push("EXC " + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || ""));
      });
      const dumpConsole = () => consoleLog.slice(-4).join(" ⁋ ");

      // Seed the persisted learner exactly the way the app itself stores it.
      await navigate(ws, `${BASE}/`);
      await evalJs(
        ws,
        `localStorage.setItem("skill-atlas", ${JSON.stringify(JSON.stringify({ state: { profileId: persona.id }, version: 0 }))})`,
      );

      // Re-assert the persisted learner before every load: something during a
      // Navigator run can clear it (recovery path), and a redirected-to-home
      // render measures clean but tests nothing.
      const ensurePid = async (id) => {
        await evalJs(ws, `localStorage.setItem("skill-atlas", ${JSON.stringify(JSON.stringify({ state: { profileId: id }, version: 0 }))})`);
      };

      // A guarded page full-loaded before zustand persist hydrates bounces to
      // home (its !profileId effect wins the race) — so drive the app like a
      // user: full-load home, wait for the store to hydrate (nav links only
      // render with a profileId in memory), then click through client-side.
      const openHome = async (id) => {
        await ensurePid(id);
        await navigate(ws, `${BASE}/`);
        const hydrated = () =>
          evalJs(ws, `document.querySelectorAll('nav a[href^="/navigator"]').length > 0`);
        try {
          await waitFor(hydrated, 40000, "store hydration (nav links)");
        } catch {
          // One hard retry — an unclean kill of the previous dev server can
          // leave a stale chunk that a reload clears.
          await ensurePid(id);
          await navigate(ws, `${BASE}/`);
          await waitFor(hydrated, 40000, "store hydration (nav links, retry)");
        }
      };
      const clientNav = async (path, title) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          let sel = `nav a[href="${path}"]`;
          if (title) {
            // A step page is reached by clicking its row on the Navigator.
            await evalJs(ws, `document.querySelector('nav a[href="/navigator"]').click()`);
            await waitFor(
              () => evalJs(ws, `location.pathname === "/navigator" && !!document.querySelector("h1")`),
              20000, "navigator",
            ).catch(() => {});
            sel = `button[title="${title.replace(/"/g, '\\"')}"]`;
            await waitFor(() => evalJs(ws, `!!document.querySelector(${JSON.stringify(sel)})`), 10000, "step button");
          } else {
            await waitFor(() => evalJs(ws, `!!document.querySelector(${JSON.stringify(sel)})`), 10000, `link ${path}`);
          }
          await evalJs(ws, `document.querySelector(${JSON.stringify(sel)}).click()`);
          const landed = await waitFor(
            () =>
              evalJs(
                ws,
                `location.pathname === ${JSON.stringify(path)} && !!document.querySelector("h1") && !document.querySelector(".animate-spin")`,
              ),
            20000,
            "page content",
          ).then(() => true, () => false);
          if (landed) break;
          // Dev-server flake (chunk compile) — recover via a home reload.
          await openHome(persona.id);
        }
        await sleep(800);
      };

      for (const pg of PAGES) {
        const label = pg.path === "/" ? "home" : pg.path.slice(1).split("/")[0];
        for (const w of [...new Set(pg.widths)]) {
          await ws.send("Emulation.setDeviceMetricsOverride", {
            width: w,
            height: w >= 1024 ? 900 : w > 600 ? 1024 : 844,
            deviceScaleFactor: 1,
            mobile: false,
          });
          await openHome(persona.id);
          if (pg.path !== "/") {
            await clientNav(pg.path, pg.viaNavigator ? step.title : undefined);
          }
          const m = await evalJs(ws, MEASURE);
          const bodyText = pg.full ? await evalJs(ws, `document.body.innerText.replace(/\\s+/g," ").slice(0, 160)`) : "";
          if (pg.must && !m.marker.toLowerCase().includes(pg.must.toLowerCase())) {
            check(`${w}px ${label} renders "${pg.must.slice(0, 24)}"`, false, `shows "${m.marker}" path=${m.path} pid=${m.pid} body="${bodyText}" | ${dumpConsole()}`);
            continue;
          }
          const ok = m.sw <= m.vw + 1 && m.bad.length === 0 && m.clipped.length === 0;
          check(
            `${w}px ${label}`,
            ok,
            m.sw > m.vw
              ? `page overflow ${m.sw}>${m.vw}; culprits: ${m.culprits.join(" | ")}; ${[...m.leaves, ...m.bad].join(" | ")}`
              : (m.bad.join(" | ") || "") + (m.clipped.join(" | ") ? " clipped: " + m.clipped.join(" | ") : "") || `${m.vw}px used`,
          );
        }
      }

      // The freshly onboarded learner (long goal, dynamic skills) on the
      // Navigator — the realistic-content case.
      if (probeId) {
        for (const w of [320, 390, 430, 768, 1024, 1440]) {
          await ws.send("Emulation.setDeviceMetricsOverride", { width: w, height: w > 600 ? 1024 : 844, deviceScaleFactor: 1, mobile: false });
          await openHome(probeId);
          await clientNav("/navigator");
          const m = await evalJs(ws, MEASURE);
          const ok = /Route to|Data|Engineer|developer|scientist/i.test(m.marker) && m.sw <= m.vw + 1 && m.bad.length === 0 && m.clipped.length === 0;
          check(`probe ${w}px navigator`, ok,
            m.sw > m.vw ? `overflow ${m.sw}>${m.vw}; ${m.bad.join(" | ")}` : m.marker.startsWith("(no h1)") ? `no content, path=${m.path} | ${dumpConsole()}` : m.clipped.join(" | ") || `${m.vw}px used — "${m.marker}"`);
        }
      }

      // Screenshots for human eyes: Navigator at 375 for both learners.
      fs.mkdirSync(path.join(__dirname, "shots"), { recursive: true });
      for (const [id, tag] of [[persona.id, "persona"], [probeId, "probe"]]) {
        if (!id) continue;
        await ws.send("Emulation.setDeviceMetricsOverride", { width: 375, height: 844, deviceScaleFactor: 2, mobile: false });
        await openHome(id);
        await clientNav("/navigator");
        await sleep(800);
        const shot = await ws.send("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(path.join(__dirname, "shots", `navigator-375-${tag}.png`), Buffer.from(shot.data, "base64"));
        console.log(`  shot  scripts/shots/navigator-375-${tag}.png`);
      }

      // Landscape phone aspect: 740×360.
      await ws.send("Emulation.setDeviceMetricsOverride", { width: 740, height: 360, deviceScaleFactor: 1, mobile: false });
      await openHome(persona.id);
      await clientNav("/navigator");
      const ls = await evalJs(ws, MEASURE);
      check(
        "740×360 landscape navigator",
        ls.sw <= ls.vw + 1 && ls.bad.length === 0 && ls.clipped.length === 0,
        `overflow ${ls.sw}>${ls.vw}; ${ls.bad.join(" | ")} ${ls.clipped.join(" | ")}`,
      );
      ws.socket.end();
      await jget(CDP, `/json/close/${target.id}`).catch(() => {});
    } finally {
      edge.kill();
    }
  } finally {
    // shell:true on Windows means kill() only hits the shell — take the tree,
    // and await it so the port is actually free before the process exits.
    if (process.platform === "win32") {
      await new Promise((r) =>
        spawn("taskkill", ["/pid", String(dev.pid), "/T", "/F"], { stdio: "ignore" }).on("exit", r),
      );
    } else dev.kill("SIGTERM");
  }

  console.log(`\n${failures === 0 ? "ALL LAYOUT CHECKS PASSED" : failures + " LAYOUT CHECK(S) FAILED"}\n`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("layout check crashed:", e.message);
  process.exit(1);
});
