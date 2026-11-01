import test from "node:test";
import assert from "node:assert/strict";
import { handleVolunteers, emptyVolunteers } from "../worker/volunteers.mjs";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const admin = { id: "admin", name: "Administrator", admin: true };
function harness() {
  let state = emptyVolunteers();
  const keys = new Map();
  const store = {
    getState: async () => structuredClone(state),
    saveState: async (next, revision) => {
      assert.equal(revision, state.revision);
      state = structuredClone(next);
    },
    getKey: async (k) => keys.get(k),
    putKey: async (k, v) => keys.set(k, v),
  };
  return { store, state: () => state };
}
test("Volunteer permissions, scheduling, cover and exchange workflows", async (t) => {
  const h = harness();
  const call = async (
    action,
    actor = admin,
    cookie = "",
    method = "POST",
    origin = "https://lpc.test",
  ) => {
    const url = action?.path || "/action";
    const response = await handleVolunteers(
      new Request("https://lpc.test/api/volunteers" + url, {
        method,
        headers: { origin, cookie, "content-type": "application/json" },
        ...(method === "POST"
          ? {
              body: JSON.stringify(
                url === "/action"
                  ? { revision: h.state().revision, ...action }
                  : action,
              ),
            }
          : {}),
      }),
      h.store,
      actor,
    );
    return {
      status: response.status,
      value: await response.json(),
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  };
  let a, b, lead, scheduler, s1, s2, cookieA, cookieB, cookieLead;
  await t.test(
    "Private data requires sign-in and mutations reject other origins",
    async () => {
      assert.equal((await call({ path: "/" }, null, "", "GET")).status, 401);
      assert.equal(
        (
          await call(
            { action: "roles", roles: ["Sound operator"] },
            admin,
            "",
            "POST",
            "https://evil.test",
          )
        ).status,
        403,
      );
    },
  );
  await t.test(
    "Administrator creates individual accounts, skills and schedulers",
    async () => {
      for (const [name, manage] of [
        ["Alice", []],
        ["Bob", []],
        ["Lead", ["service"]],
        ["Scheduler", ["service"]],
      ]) {
        const result = await call({
          action: "member",
          member: {
            name,
            username: name.toLowerCase(),
            password: "test-password-123",
            skills: ["Sound operator"],
            teams: ["Malayalam", "English"],
            branches: ["Main Church"],
            manage,
            active: true,
          },
        });
        assert.equal(result.status, 200, JSON.stringify(result.value));
        assert(!JSON.stringify(result.value).includes("passwordHash"));
      }
      [a, b, lead, scheduler] = h.state().members;
      const login = async (username) => {
        const r = await call(
          { path: "/login", username, password: "test-password-123" },
          null,
        );
        assert.equal(r.status, 200);
        return r.cookie;
      };
      cookieA = await login("alice");
      cookieB = await login("bob");
      cookieLead = await login("lead");
      assert.equal(
        (await call({ action: "roles", roles: ["X"] }, null, cookieA)).status,
        403,
      );
    },
  );
  await t.test(
    "Recurring settings create dates without duplicates",
    async () => {
      const result = await call({
        action: "service",
        service: {
          name: "Malayalam service",
          kind: "service",
          branch: "Main Church",
          team: "Malayalam",
          day: 0,
          time: "09:30",
          duration: 120,
          leadId: lead.id,
          roles: [{ role: "Sound operator", count: 1 }],
        },
        start: "2026-11-01",
        weeks: 2,
      });
      assert.equal(result.status, 200, JSON.stringify(result.value));
      [s1, s2] = h.state().sessions;
      assert.equal(s1.date, "2026-11-01");
      assert.equal(s2.date, "2026-11-08");
      await call({
        action: "generate",
        serviceId: h.state().services[0].id,
        start: "2026-11-01",
        weeks: 2,
      });
      assert.equal(h.state().sessions.length, 2);
    },
  );
  const allocate = (
    s,
    main,
    backup = "",
    status = "confirmed",
    actor = admin,
    cookie = "",
  ) =>
    call(
      {
        action: "allocation",
        sessionId: s.id,
        status,
        slots: [{ id: s.slots[0].id, main, backup }],
        comment: "Agreed duty list",
      },
      actor,
      cookie,
    );
  await t.test(
    "Only authorised schedulers edit, with coverage and overlap checks",
    async () => {
      assert.equal(
        (await allocate(s1, a.id, "", "confirmed", null, cookieB)).status,
        403,
      );
      assert.equal((await allocate(s1, "")).status, 200, "Optional choir/media vacancies can be confirmed");
      assert.equal((await allocate(s1, a.id, a.id)).status, 400);
      assert.equal(
        (await allocate(s1, a.id, "", "confirmed", null, cookieLead)).status,
        200,
      );
      assert.equal((await allocate(s2, b.id)).status, 200);
      const r = await call({
        action: "service",
        service: {
          name: "English service",
          kind: "service",
          branch: "Main Church",
          team: "English",
          day: 0,
          time: "10:00",
          duration: 120,
          leadId: lead.id,
          roles: [{ role: "Sound operator", count: 1 }],
        },
        start: "2026-11-01",
        weeks: 1,
      });
      assert.equal(r.status, 200);
      assert.equal((await allocate(h.state().sessions[2], a.id)).status, 400);
      const wrong = await call({
        action: "allocation",
        sessionId: s1.id,
        revision: 0,
        status: "draft",
        slots: [],
      });
      assert.equal(wrong.status, 409);
    },
  );
  await t.test(
    "Reciprocal swap waits for recipient, updates both duties and notifies scheduler",
    async () => {
      let r = await call(
        {
          action: "swap",
          sessionId: s1.id,
          slotId: s1.slots[0].id,
          position: "main",
          targetId: b.id,
          exchangeSessionId: s2.id,
          exchangeSlotId: s2.slots[0].id,
          exchangePosition: "main",
          comment: "Agreed to exchange our Sundays.",
        },
        null,
        cookieA,
      );
      assert.equal(r.status, 200, JSON.stringify(r.value));
      const swap = h.state().swaps[0];
      assert.equal(h.state().sessions[0].slots[0].main, a.id);
      assert.equal((await allocate(s1, a.id)).status, 409);
      assert.equal(
        (
          await call(
            { action: "swap-response", swapId: swap.id, response: "accept" },
            null,
            cookieA,
          )
        ).status,
        403,
      );
      r = await call(
        { action: "swap-response", swapId: swap.id, response: "accept" },
        null,
        cookieB,
      );
      assert.equal(r.status, 200, JSON.stringify(r.value));
      assert.equal(h.state().sessions[0].slots[0].main, b.id);
      assert.equal(h.state().sessions[1].slots[0].main, a.id);
      assert(
        h
          .state()
          .notifications.some(
            (n) =>
              n.recipient === scheduler.id &&
              n.message.includes("Swap accepted"),
          ),
      );
      assert(
        h
          .state()
          .history.some(
            (h) =>
              h.before &&
              h.after &&
              h.comment === "Agreed to exchange our Sundays.",
          ),
      );
    },
  );
  await t.test(
    "Unavailable assigned volunteer resets rota to draft and flags scheduler",
    async () => {
      assert.equal(
        (
          await call(
            { action: "availability", sessionId: s1.id, value: "unavailable" },
            null,
            cookieB,
          )
        ).status,
        200,
      );
      assert.equal(h.state().sessions[0].status, "draft");
      assert.equal((await allocate(s1, b.id)).status, 400);
    },
  );
  await t.test(
    "Cover request can be declined, and cancellation preserves assignment",
    async () => {
      await call(
        { action: "availability", sessionId: s1.id, value: "available" },
        null,
        cookieB,
      );
      await call(
        {
          action: "swap",
          sessionId: s2.id,
          slotId: s2.slots[0].id,
          position: "main",
          targetId: b.id,
          comment: "Can you cover this date?",
        },
        null,
        cookieA,
      );
      let swap = h.state().swaps.at(-1);
      assert.equal(
        (
          await call(
            { action: "swap-response", swapId: swap.id, response: "decline" },
            null,
            cookieB,
          )
        ).status,
        200,
      );
      assert.equal(h.state().sessions[1].slots[0].main, a.id);
      await call(
        {
          action: "swap",
          sessionId: s2.id,
          slotId: s2.slots[0].id,
          position: "main",
          targetId: b.id,
          comment: "Please cover if possible.",
        },
        null,
        cookieA,
      );
      swap = h.state().swaps.at(-1);
      assert.equal(
        (
          await call(
            { action: "swap-response", swapId: swap.id, response: "cancel" },
            null,
            cookieA,
          )
        ).status,
        200,
      );
      assert.equal(h.state().sessions[1].slots[0].main, a.id);
    },
  );
  await t.test("Password reset invalidates prior login sessions", async () => {
    const m = structuredClone(h.state().members[0]);
    const r = await call({
      action: "member",
      member: { ...m, password: "new-password-12345" },
    });
    assert.equal(r.status, 200);
    assert.equal((await call({ path: "/" }, null, cookieA, "GET")).status, 401);
    const view = await call({ path: "/" }, null, cookieB, "GET");
    assert(!JSON.stringify(view.value).includes("passwordHash"));
    assert(view.value.notifications.every((n) => n.recipient === b.id));
  });
});
test("Node HTTP adapter persists private data and protects static paths", async () => {
  const data = await mkdtemp(join(tmpdir(), "lpc-volunteers-"));
  const port = 4196,
    base = "http://127.0.0.1:" + port;
  let child;
  async function start() {
    child = spawn(process.execPath, ["preview-server.mjs"], {
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        DATA_DIR: data,
        LPC_ADMIN_USERNAME: "testadmin",
        LPC_ADMIN_PASSWORD: "adapter-test-password",
        LPC_ADMIN_SESSION_SECRET: "test-session-secret",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("Server timeout")), 10000);
      child.stdout.once("data", () => {
        clearTimeout(timer);
        resolve();
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(Error("Server exited"));
      });
    });
  }
  async function stop() {
    const c = child;
    child = null;
    if (c && c.exitCode === null) {
      c.kill();
      await new Promise((resolve) => c.once("exit", resolve));
    }
  }
  try {
    await start();
    const login = await fetch(base + "/api/admin/login", {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: JSON.stringify({
        username: "testadmin",
        password: "adapter-test-password",
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const r = await fetch(base + "/api/volunteers/action", {
      method: "POST",
      headers: { origin: base, cookie, "content-type": "application/json" },
      body: JSON.stringify({
        revision: 0,
        action: "member",
        member: {
          name: "Test volunteer",
          username: "test",
          password: "a-long-test-password",
          skills: ["Sound operator"],
          teams: ["Malayalam"],
          branches: ["Main Church"],
          manage: [],
          active: true,
        },
      }),
    });
    assert.equal(r.status, 200, await r.text());
    const reportQuery='?kind=service&start=2032-01-01&end=2032-02-01';
    const reportResponse=await fetch(base+'/api/volunteers/report'+reportQuery,{headers:{cookie}});
    assert.equal(reportResponse.status,200);
    assert.equal((await reportResponse.json()).start,'2032-01-01');
    const workbookResponse=await fetch(base+'/api/volunteers/report'+reportQuery+'&format=xlsx',{headers:{cookie}});
    assert.equal(workbookResponse.status,200);
    const workbook=new DataView(await workbookResponse.arrayBuffer());
    assert.equal(workbook.getUint32(0,true),0x04034b50);
    assert.equal(workbook.getUint32(workbook.byteLength-22,true),0x06054b50);
    const centralOffset=workbook.getUint32(workbook.byteLength-6,true);
    assert.equal(workbook.getUint32(centralOffset,true),0x02014b50,'HTTP adapter must preserve binary workbook bytes');
    assert.equal(
      (await fetch(base + "/.private-volunteers/state.json")).status,
      404,
    );
    assert.equal(
      (await fetch(base + "/assets/data/volunteer-private/state.json")).status,
      404,
    );
    await stop();
    await start();
    const result = await fetch(base + "/api/volunteers", {
      headers: { cookie },
    });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).members[0].name, "Test volunteer");
  } finally {
    await stop();
    await rm(data, { recursive: true, force: true });
  }
});

test("Recovery codes are private, replaceable, single-use and invalidate existing sessions", async () => {
  const h = harness();
  const call = async (path, input, { cookie = "", actor = null, method = "POST", origin = "https://lpc.test" } = {}) => {
    const response = await handleVolunteers(new Request("https://lpc.test/api/volunteers" + path, { method, headers: { origin, cookie, "cf-connecting-ip": "192.0.2.9" }, ...(method === "POST" ? { body: JSON.stringify(input) } : {}) }), h.store, actor);
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
  };
  const original = "Original-passphrase-2026";
  const replacement = "Replacement-passphrase-2026";
  await call("/action", { action: "member", revision: 0, member: { name: "Recovery test", username: "recovery.test", password: original, active: true, skills: [], teams: [], branches: [], manage: [] } }, { actor: admin });
  const memberId = h.state().members[0].id;
  const login = await call("/login", { username: "recovery.test", password: original });
  assert.equal(login.status, 200);
  const cookie = login.cookie;
  assert.equal((await call("/recovery-code", { current: original, revision: h.state().revision })).status, 401);
  assert.equal((await call("/recovery-code", { current: "incorrect", revision: h.state().revision }, { cookie })).status, 400);
  const first = await call("/recovery-code", { current: original, revision: h.state().revision }, { cookie });
  assert.equal(first.status, 200);
  assert.match(first.body.code, /^[A-F0-9]{8}(-[A-F0-9]{8}){3}$/);
  const second = await call("/recovery-code", { current: original, revision: h.state().revision }, { cookie });
  assert.equal(second.status, 200);
  assert.notEqual(first.body.code, second.body.code);
  const stored = JSON.stringify(h.state());
  assert(!stored.includes(second.body.code));
  assert(!stored.includes(second.body.code.replaceAll("-", "")));
  const view = await call("/", null, { cookie, method: "GET" });
  assert.equal(view.body.actor.hasRecoveryCode, true);
  assert(!JSON.stringify(view.body).includes("recoveryHash"));
  assert(!JSON.stringify(view.body).includes(h.state().members[0].recoveryHash));
  const reset = { username: "recovery.test", code: second.body.code.toLowerCase().replaceAll("-", " "), password: replacement };
  const before = structuredClone(h.state());
  assert.equal((await call("/recover", { ...reset, code: first.body.code })).status, 400);
  assert.deepEqual(h.state(), before);
  assert.equal((await call("/recover", reset, { origin: "https://evil.test" })).status, 403);
  assert.equal((await call("/recover", reset)).status, 200);
  assert.equal(h.state().members[0].recoveryHash, undefined);
  assert.equal((await call("/session", null, { cookie, method: "GET" })).body.actor, null);
  assert.equal((await call("/recover", reset)).status, 400);
  assert.equal((await call("/login", { username: "recovery.test", password: original })).status, 401);
  const signedIn = await call("/login", { username: "recovery.test", password: replacement });
  assert.equal(signedIn.status, 200);
  assert(h.state().history.some(entry => entry.action === "Password recovered"));
  assert(h.state().notifications.some(entry => entry.recipient === memberId && entry.message.includes("password was reset")));
  const third = await call("/recovery-code", { current: replacement, revision: h.state().revision }, { cookie: signedIn.cookie });
  assert.equal(third.status, 200);
  const member = h.state().members[0];
  assert.equal((await call("/action", { action: "member", revision: h.state().revision, member: { ...member, password: "Admin-reset-passphrase-2026" } }, { actor: admin })).status, 200);
  assert.equal(h.state().members[0].recoveryHash, undefined, "Administrator resets invalidate recovery codes too");
  const bad = { username: "missing", code: "incorrect", password: replacement };
  for (let i = 0; i < 10; i++) await call("/recover", bad);
  assert.equal((await call("/recover", bad)).status, 429);
});
