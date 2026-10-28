import test from "node:test";
import assert from "node:assert/strict";
import { handleVolunteers, upgradePlanner, meetingReadiness, emptyVolunteers } from "../worker/volunteers.mjs";
import { readFileSync } from "node:fs";
const demo = JSON.parse(
  readFileSync(new URL("./fixtures/weekly-demo.json", import.meta.url), "utf8"),
);
const admin = { id: "admin", name: "Test administrator", admin: true };
function setup(seed = demo) {
  let state = structuredClone(seed);
  const store = {
    getState: async () => structuredClone(state),
    saveState: async (value) => {
      state = structuredClone(value);
    },
    getKey: async () => null,
    putKey: async () => {},
  };
  return {
    get: () => state,
    read: async (actor = admin, path = "") => {
      const response = await handleVolunteers(new Request("https://church.test/api/volunteers" + path), store, actor);
      return { status: response.status, body: await response.json() };
    },
    call: async (input, actor = admin) => {
      const r = await handleVolunteers(
        new Request("https://church.test/api/volunteers/action", {
          method: "POST",
          headers: { origin: "https://church.test" },
          body: JSON.stringify({ ...input, revision: input.revision ?? state.revision }),
        }),
        store,
        actor,
      );
      return { status: r.status, body: await r.json() };
    },
  };
}
test("One-off meetings create exactly one paired date and never repeat in later weeks", async () => {
  const h=setup(emptyVolunteers());
  const meeting={name:'Family day',branch:'Main Church',team:'English',recurrence:'once',startDate:'2032-04-10',time:'10:00',duration:120};
  assert.equal((await h.call({action:'meeting',meeting})).status,200);
  assert.equal(h.get().sessions.length,2);
  assert.deepEqual(new Set(h.get().sessions.map(s=>s.kind)),new Set(['ministry','service']));
  assert(h.get().sessions.every(s=>s.date==='2032-04-10'));
  for(const start of ['2032-04-05','2032-04-12','2032-05-03']) assert.equal((await h.call({action:'ensure-week',start})).status,200);
  assert.equal(h.get().sessions.length,2);
});

test("Daily fasting series create 3, 7 or 21 inclusive dates across weeks and stop at the end", async () => {
  for(const days of [3,7,21]) {
    const h=setup(emptyVolunteers());
    const startDate='2032-02-25', end=new Date(startDate+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+days-1);
    const endDate=end.toISOString().slice(0,10);
    assert.equal((await h.call({action:'meeting',meeting:{name:days+' days fasting',branch:'Main Church',team:'Malayalam',recurrence:'daily',startDate,endDate,time:'19:30',duration:90}})).status,200);
    const saved=h.get().sessions;
    assert.equal(saved.length,days*2);assert.equal(new Set(saved.map(s=>s.date)).size,days);
    for(const date of new Set(saved.map(s=>s.date))) assert.equal(saved.filter(s=>s.date===date).length,2);
    assert.equal(saved.map(s=>s.date).sort()[0],startDate);assert.equal(saved.map(s=>s.date).sort().at(-1),endDate);
    const before=structuredClone(saved);
    for(const start of ['2032-02-23','2032-03-01','2032-03-08','2032-03-15','2032-03-22']) await h.call({action:'ensure-week',start});
    assert.deepEqual(h.get().sessions,before);
  }
});

test("Dated series validate dates, limits and permissions without saving partial calendars", async () => {
  const h=setup(emptyVolunteers());
  const meeting={name:'Prayer',branch:'Main Church',team:'English',recurrence:'daily',startDate:'2032-04-01',endDate:'2032-04-07',time:'19:30',duration:60};
  for(const changes of [{recurrence:'monthly'},{startDate:'2032-02-30'},{endDate:'2032-03-31'},{endDate:'2032-07-01'}]) {
    assert.equal((await h.call({action:'meeting',meeting:{...meeting,...changes}})).status,400);
    assert.equal(h.get().sessions.length,0);assert.equal(h.get().meetings.length,0);
  }
  assert.equal((await h.call({action:'meeting',meeting},{id:'choir',name:'Choir coordinator',manage:['service']})).status,403);
  assert.equal((await h.call({action:'meeting',meeting})).status,200);
  const m=h.get().meetings[0],before=structuredClone(h.get());
  for(const changes of [{recurrence:'weekly',day:1},{startDate:'2032-04-02'},{endDate:'2032-04-10'}]) {
    assert.equal((await h.call({action:'meeting',meeting:{...m,...changes}})).status,400);
    assert.deepEqual(h.get(),before);
  }
});

test("Editing a daily series preserves shifted dates, assignments and cancellations; ending it prevents regeneration", async () => {
  const h=setup();await h.call({action:'upgrade-planner'});
  const meetingInput={name:'Fasting prayer',branch:'Main Church',team:'Malayalam',recurrence:'daily',startDate:'2032-04-01',endDate:'2032-04-03',time:'19:30',duration:60};
  assert.equal((await h.call({action:'meeting',meeting:meetingInput})).status,200);
  const meeting=h.get().meetings.find(m=>m.name===meetingInput.name);
  const original=h.get().sessions.find(s=>s.meetingId===meeting.id&&s.kind==='ministry');
  const pastor=h.get().members.find(m=>m.username==='pastor.test');original.slots[0].main=pastor.id;
  assert.equal((await h.call({action:'meeting-occurrence',sessionId:original.id,date:'2032-04-05',time:'20:00',cancelled:true,comment:'Moved date'})).status,200);
  assert.equal((await h.call({action:'meeting',meeting:{...meeting,name:'Fasting and family prayer',time:'18:30'}})).status,200);
  const edited=h.get().sessions.find(s=>s.id===original.id);
  assert.equal(edited.date,'2032-04-05');assert.equal(edited.scheduledDate,'2032-04-01');assert.equal(edited.slots[0].main,pastor.id);assert.equal(edited.cancelled,true);
  assert.equal((await h.call({action:'ensure-week',start:'2032-03-29'})).status,200);
  assert.equal(h.get().sessions.filter(s=>s.meetingId===meeting.id).length,6);
  assert.equal((await h.call({action:'delete-meeting-series',meetingId:meeting.id,confirm:true})).status,200);
  await h.call({action:'ensure-week',start:'2032-03-29'});
  assert.equal(h.get().sessions.filter(s=>s.meetingId===meeting.id).length,0);
});

test("Shared weekly planner migration preserves all prior duties", () => {
  const before = structuredClone(demo);
  const migrated = upgradePlanner(structuredClone(demo));
  assert.equal(migrated.meetings.length, 3);
  assert.equal(migrated.services.length, 6);
  assert.equal(migrated.sessions.length, 24);
  for (const session of before.sessions) {
    const after = migrated.sessions.find((s) => s.id === session.id);
    assert.deepEqual(after.slots, session.slots);
    assert.equal(after.status, session.status);
    assert(after.occurrenceId);
    const pair = migrated.sessions.filter(
      (s) => s.occurrenceId === after.occurrenceId,
    );
    assert.equal(pair.length, 2);
    assert.deepEqual(
      new Set(pair.map((s) => s.kind)),
      new Set(["ministry", "service"]),
    );
  }
  assert.deepEqual(upgradePlanner(structuredClone(migrated)), migrated);
});
test("One recurring meeting creates both team calendars and shared date changes", async () => {
  const h = setup();
  assert.equal((await h.call({ action: "upgrade-planner" })).status, 200);
  const pastor = h.get().members.find((m) => m.username === "pastor.test");
  const choir = h.get().members.find((m) => m.username === "lead.test");
  const create = {
    action: "meeting",
    meeting: {
      name: "Wednesday Prayer",
      branch: "Main Church",
      team: "Malayalam",
      day: 3,
      time: "19:30",
      duration: 90,
      pastorLeadId: pastor.id,
      choirLeadId: choir.id,
    },
    start: "2026-10-26",
    weeks: 2,
  };
  assert.equal((await h.call(create, choir)).status, 403);
  assert.equal((await h.call(create, pastor)).status, 200);
  const meeting = h.get().meetings.find((m) => m.name === "Wednesday Prayer");
  let sessions = h.get().sessions.filter((s) => s.meetingId === meeting.id);
  assert.equal(sessions.length, 4);
  assert.equal(new Set(sessions.map((s) => s.occurrenceId)).size, 2);
  const pair = sessions.filter((s) => s.date === "2026-10-28");
  const edit = {
    action: "meeting-occurrence",
    sessionId: pair[0].id,
    date: "2026-10-29",
    time: "20:00",
    cancelled: false,
    comment: "Moved by agreement with both teams.",
  };
  assert.equal((await h.call(edit, choir)).status, 403);
  assert.equal((await h.call(edit, pastor)).status, 200);
  sessions = h
    .get()
    .sessions.filter((s) => s.occurrenceId === pair[0].occurrenceId);
  assert(sessions.every((s) => s.date === "2026-10-29" && s.time === "20:00"));
  assert.equal(
    h.get().notifications.filter((n) => n.recipient === choir.id).length,
    1,
  );
  const count = h.get().sessions.length;
  await h.call(
    {
      action: "generate-meeting",
      meetingId: meeting.id,
      start: "2026-10-26",
      weeks: 2,
    },
    pastor,
  );
  assert.equal(
    h.get().sessions.length,
    count,
    "Regenerating weeks must not recreate a moved meeting",
  );
  const cancellation = await h.call({ ...edit, cancelled: true }, pastor);
  assert.equal(cancellation.status, 200);
  assert(
    h
      .get()
      .sessions.filter((s) => s.occurrenceId === pair[0].occurrenceId)
      .every((s) => s.cancelled),
  );
  const individual = await h.call(
    {
      action: "session",
      sessionId: pair[0].id,
      date: "2026-10-30",
      time: "18:00",
    },
    pastor,
  );
  assert.equal(individual.status, 400);
});
test("Pastoral and choir requirements stay separate, with duplicate week prevention", async () => {
  const h = setup();
  await h.call({ action: "upgrade-planner" });
  const choir = h.get().members.find((m) => m.username === "lead.test");
  const meeting = h.get().meetings[0];
  const pastoral = h
    .get()
    .services.find((s) => s.meetingId === meeting.id && s.kind === "ministry");
  const service = h
    .get()
    .services.find((s) => s.meetingId === meeting.id && s.kind === "service");
  assert.equal(
    (
      await h.call(
        {
          action: "team-settings",
          serviceId: pastoral.id,
          leadId: choir.id,
          roles: [{ role: "Ministry volunteer", count: 1 }],
        },
        choir,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await h.call(
        {
          action: "team-settings",
          serviceId: service.id,
          leadId: choir.id,
          roles: [{ role: "Sound operator", count: 1 }],
        },
        choir,
      )
    ).status,
    200,
  );
  const before = h.get().sessions.length;
  const generate = {
    action: "generate-meeting",
    meetingId: meeting.id,
    start: "2027-01-04",
    weeks: 2,
  };
  assert.equal((await h.call(generate, choir)).status, 200);
  assert.equal(h.get().sessions.length, before + 4);
  assert.equal((await h.call(generate, choir)).status, 200);
  assert.equal(h.get().sessions.length, before + 4);
  const upcoming = h
    .get()
    .sessions.filter(
      (s) => s.meetingId === meeting.id && s.date >= "2027-01-04",
    );
  assert(
    upcoming
      .filter((s) => s.kind === "ministry")
      .every((s) => s.slots[0].role === "Ministry volunteer"),
  );
  assert(
    upcoming
      .filter((s) => s.kind === "service")
      .every(
        (s) => s.slots.length === 1 && s.slots[0].role === "Sound operator",
      ),
  );
});
test("Team setup preserves assigned people and refuses removal of their duty", async () => {
  const h = setup();
  await h.call({ action: "upgrade-planner" });
  const lead = h.get().members.find((m) => m.username === "lead.test");
  const start = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  assert.equal(
    (
      await h.call({
        action: "meeting",
        meeting: {
          name: "Future team setup test",
          branch: "Main Church",
          team: "Malayalam",
          day: 3,
          time: "21:45",
          duration: 60,
          choirLeadId: lead.id,
        },
        start,
        weeks: 1,
      })
    ).status,
    200,
  );
  const meeting = h
    .get()
    .meetings.find((m) => m.name === "Future team setup test");
  const service = h
    .get()
    .services.find((s) => s.meetingId === meeting.id && s.kind === "service");
  const session = h.get().sessions.find((s) => s.serviceId === service.id);
  const first = session.slots[0];
  assert.equal(
    (
      await h.call({
        action: "allocation",
        sessionId: session.id,
        status: "draft",
        slots: session.slots.map((slot) => ({
          id: slot.id,
          main: slot.id === first.id ? lead.id : "",
          backup: "",
        })),
      })
    ).status,
    200,
  );
  const edit = {
    action: "team-settings",
    serviceId: service.id,
    leadId: lead.id,
    applyDrafts: true,
    roles: [
      { role: "Lead singer", count: 1 },
      { role: "Sound operator", count: 1 },
    ],
  };
  assert.equal((await h.call(edit, lead)).status, 200);
  let saved = h.get().sessions.find((s) => s.id === session.id);
  assert.equal(saved.slots.length, 2);
  assert.equal(saved.slots.find((s) => s.role === "Lead singer").main, lead.id);
  assert.equal(
    (
      await h.call(
        { ...edit, roles: [{ role: "Sound operator", count: 1 }] },
        lead,
      )
    ).status,
    400,
  );
  saved = h.get().sessions.find((s) => s.id === session.id);
  assert.equal(saved.slots.find((s) => s.role === "Lead singer").main, lead.id);
  assert.equal(
    (
      await h.call(
        { ...edit, roles: [{ role: "Ministry volunteer", count: 1 }] },
        lead,
      )
    ).status,
    400,
  );
});
test('Preparing a future week creates both plans for only the chosen meeting team',async()=>{const h=setup();await h.call({action:'upgrade-planner'});const lead=h.get().members.find(m=>m.username==='lead.test');const before=h.get().sessions.length;const request={action:'generate-week',start:'2030-02-11',branch:'Main Church',team:'English'};assert.equal((await h.call(request,lead)).status,200);const added=h.get().sessions.slice(before);assert.equal(added.length,2);assert(added.every(s=>s.team==='English'&&s.date>='2030-02-11'&&s.date<='2030-02-17'));assert.deepEqual(new Set(added.map(s=>s.kind)),new Set(['ministry','service']));assert.equal((await h.call(request,lead)).status,200);assert.equal(h.get().sessions.length,before+2);});
test('Pastor eligibility and pastoral/media admin access are independent',async()=>{
 const h=setup();await h.call({action:'upgrade-planner'});
 const input={name:'Eligible pastor test',username:'eligible.pastor',password:'test-only-password-2026',skills:['Ministry volunteer'],teams:['Malayalam'],branches:['Main Church'],manage:[],active:true};
 assert.equal((await h.call({action:'member',member:input})).status,200);
 let member=h.get().members.find(m=>m.username===input.username);
 assert.deepEqual(member.manage,[]);
 const meeting={action:'meeting',meeting:{name:'Permission test',branch:'Main Church',team:'Malayalam',day:0,time:'08:00',duration:60}};
 assert.equal((await h.call(meeting,member)).status,403,'Being a pastor must not grant pastoral admin rights');
 assert.equal((await h.call({action:'member',member:{...input,id:member.id,manage:['ministry']}},member)).status,403,'A volunteer cannot grant themselves admin rights');
 assert.equal((await h.call({action:'member',member:{...input,id:member.id,manage:['ministry']}})).status,200);
 member=h.get().members.find(m=>m.id===member.id);
 assert.equal((await h.call(meeting,member)).status,200);
 const choir=h.get().services.find(s=>s.kind==='service');
 assert.equal((await h.call({action:'team-settings',serviceId:choir.id,leadId:'',roles:[{role:'Sound operator',count:1}]},member)).status,403,'Pastoral admin must not imply media admin');
 assert.equal((await h.call({action:'member',member:{...input,id:member.id,manage:['service']}})).status,200);
 member=h.get().members.find(m=>m.id===member.id);
 assert.equal((await h.call(meeting,member)).status,403);
 assert.equal((await h.call({action:'team-settings',serviceId:choir.id,leadId:'',roles:[{role:'Sound operator',count:1}]},member)).status,200);
 assert(member.skills.includes('Ministry volunteer'),'Changing admin access must preserve the serving skill');
});
test('One save applies volunteer edits atomically, preserving identities and rejecting partial or unauthorised changes',async()=>{
 const h=setup();const before=structuredClone(h.get());const [first,second]=before.members;
 const patch=(m,change={})=>({id:m.id,skills:m.skills,teams:m.teams,branches:m.branches,manage:m.manage,active:m.active,...change});
 let result=await h.call({action:'members-bulk',members:[patch(first,{manage:['ministry']}),patch(second,{skills:['Made up role']})]});
 assert.equal(result.status,400);assert.deepEqual(h.get(),before,'A bad row must prevent all changes');
 result=await h.call({action:'members-bulk',members:[patch(first,{manage:['ministry']}),patch(second,{teams:['English']})]},first);
 assert.equal(result.status,403);assert.deepEqual(h.get(),before);
 result=await h.call({action:'members-bulk',members:[patch(first,{manage:['ministry']}),patch(second,{teams:['English']})]});
 assert.equal(result.status,200);assert.equal(h.get().revision,before.revision+1,'All edits share a single revision');
 const savedFirst=h.get().members.find(m=>m.id===first.id),savedSecond=h.get().members.find(m=>m.id===second.id);
 assert.deepEqual(savedFirst.manage,['ministry']);assert.deepEqual(savedSecond.teams,['English']);assert.equal(savedFirst.name,first.name);assert.equal(savedFirst.username,first.username);assert.deepEqual(savedFirst.availability,first.availability);assert.deepEqual(h.get().sessions,before.sessions);
 result=await h.call({action:'members-bulk',revision:before.revision,members:[patch(first)]});assert.equal(result.status,409,'Stale bulk edits must not overwrite newer changes');
});

test("Assignment choices exclude the opposite person in the same role, while allowing other roles", async () => {
  const { runInNewContext } = await import("node:vm");
  const ui = readFileSync(new URL("../assets/js/volunteers.js", import.meta.url), "utf8");
  const source = ui.slice(ui.indexOf("  function sameMeetingOccurrence("), ui.indexOf("  function memberOptions("));
  const select = value => ({ value, parentElement: { querySelector: () => null }, options: ["", "a", "b", "c"].map(value => ({ value, hasAttribute: () => false })) });
  const primary = select("a"), reserve = select("b"), other = select("");
  const row = {}, otherRow = {};
  primary.closest = reserve.closest = () => row;
  other.closest = () => otherRow;
  const refresh = runInNewContext(source + ";refreshAssignmentChoices", { state: { sessions: [] }, selected: "", root: { querySelector: () => null, querySelectorAll: () => [primary, reserve, other] } });
  refresh();
  assert.equal(reserve.options[1].hidden, true);
  assert.equal(primary.options[2].disabled, true);
  assert.equal(primary.options[1].disabled, false);
  assert.equal(other.options[3].disabled, false);
  assert.equal(other.options[1].disabled, false, "A primary in another role remains selectable");
  assert.equal(other.options[2].disabled, false, "A reserve in another role remains selectable");
  primary.value = "";
  refresh();
  assert.equal(reserve.options[1].hidden, false);
  assert.equal(other.options[1].disabled, false);
});

test("Deleting a whole meeting series is authorised, confirmed and removes both planners atomically", async () => {
  const seed = upgradePlanner(structuredClone(demo));
  const meeting = seed.meetings[0];
  const removed = seed.sessions.filter(s => s.meetingId === meeting.id);
  for (const session of removed) session.date = "2035-06-03";
  const ids = new Set(removed.map(s => s.id));
  const other = seed.sessions.find(s => !ids.has(s.id));
  const member = seed.members[0];
  removed[0].slots[0].main = member.id;
  member.availability = { ...member.availability, [removed[0].id]: "available", [other.id]: "available" };
  seed.swaps.push({ id: "cross-series", sessionId: other.id, exchangeSessionId: removed[0].id, from: member.id, to: seed.members[1].id, status: "pending" });
  const h = setup(seed);
  const input = { action: "delete-meeting-series", meetingId: meeting.id, confirm: true };
  assert.equal((await h.call(input, { ...member, admin: false, manage: ["service"] })).status, 403);
  assert.deepEqual(h.get(), seed);
  assert.equal((await h.call({ ...input, confirm: false })).status, 400);
  assert.deepEqual(h.get(), seed);
  assert.equal((await h.call({ ...input, revision: seed.revision - 1 })).status, 409);
  assert.deepEqual(h.get(), seed);
  assert.equal((await h.call(input)).status, 200);
  const after = h.get();
  assert(after.meetings.find(m => m.id === meeting.id).archived);
  assert(after.services.filter(s => s.meetingId === meeting.id).every(s => s.archived));
  assert(!after.sessions.some(s => ids.has(s.id)));
  assert.deepEqual(after.sessions, seed.sessions.filter(s => !ids.has(s.id)));
  assert(!after.swaps.some(s => s.id === "cross-series"));
  assert.equal(after.members[0].availability[removed[0].id], undefined);
  assert.equal(after.members[0].availability[other.id], "available");
  assert(after.notifications.some(n => n.recipient === member.id && n.message.includes("upcoming dates were removed")));
  assert(after.history.some(h => h.action === "Upcoming meeting series deleted"));
  assert.equal(after.revision, seed.revision + 1);
  assert.equal((await h.call(input)).status, 404);
});

test("Scheduler choices and permissions use Scheduling access, independently of serving skills", async () => {
  const seed = upgradePlanner(structuredClone(demo));
  const media = seed.members[0];
  media.skills = ["Ministry volunteer", "Sound operator"];
  media.manage = ["service"];
  const pastoral = seed.members[1];
  pastoral.skills = [];
  pastoral.manage = ["ministry"];
  const service = seed.services.find(s => s.kind === "ministry");
  const session = seed.sessions.find(s => s.kind === "ministry");
  session.leadId = media.id;
  const h = setup(seed);
  const setupInput = { action: "team-settings", serviceId: service.id, roles: service.roles, leadId: media.id };
  assert.equal((await h.call(setupInput)).status, 400);
  assert.deepEqual(h.get(), seed);
  const allocation = { action: "allocation", sessionId: session.id, status: "draft", slots: session.slots, leadId: media.id };
  assert.equal((await h.call(allocation)).status, 400);
  assert.equal((await h.call({ ...allocation, leadId: "" }, { ...media, admin: false })).status, 403);
  assert.deepEqual(h.get(), seed);
  assert.equal((await h.call({ action: "meeting", meeting: { name: "New meeting", branch: "Main Church", team: "Malayalam", day: 0, time: "09:30", duration: 120, pastorLeadId: media.id } })).status, 400);
  assert.deepEqual(h.get(), seed);
  assert.equal((await h.call({ ...setupInput, leadId: pastoral.id })).status, 200);
  assert.deepEqual(h.get().members.find(m => m.id === pastoral.id).skills, []);
  const { runInNewContext } = await import("node:vm");
  const ui = readFileSync(new URL("../assets/js/volunteers.js", import.meta.url), "utf8");
  const source = ui.slice(ui.indexOf("  function eligibleLead("), ui.indexOf("  function memberOptions("));
  const eligible = runInNewContext(source + ";eligibleLead");
  assert.equal(eligible(media, "ministry"), false);
  assert.equal(eligible(media, "service"), true);
  assert.equal(eligible(pastoral, "ministry"), true);
  assert.equal(eligible(pastoral, "service"), false);
  assert.equal(eligible({ ...pastoral, active: false }, "ministry"), false);
  assert.equal(eligible({ ...media, manage: [] }, "service"), false);
});

function rulesFixture(kind = "service") {
  const seed = upgradePlanner(structuredClone(demo));
  const session = seed.sessions.find(s => s.kind === kind);
  session.date = "2031-06-01";
  session.slots = [{ id: "test-duty", role: kind === "ministry" ? "Ministry volunteer" : "Sound operator", main: "", backup: "" }];
  seed.sessions = [session];
  for (const member of seed.members) Object.assign(member, { active: true, skills: [session.slots[0].role], teams: [session.team], branches: [session.branch], manage: [], availability: {} });
  return { seed, session };
}
test("Duty and scheduler selectors obey all five membership fields independently", async () => {
  const { runInNewContext } = await import("node:vm");
  const ui = readFileSync(new URL("../assets/js/volunteers.js", import.meta.url), "utf8");
  const source = ui.slice(ui.indexOf("  function participates("), ui.indexOf("  function leadOptions("));
  const functions = runInNewContext(source + ";({ canServe, eligibleLead })");
  for (const kind of ["ministry", "service"]) {
    for (const [change, patch, dutyAllowed, schedulerAllowed] of [
      ["no admin rights", {}, true, false],
      ["admin with role", { manage: [kind] }, true, true],
      ["admin without serving skill", { manage: [kind], skills: [] }, false, true],
      ["wrong admin area", { manage: [kind === "service" ? "ministry" : "service"] }, true, false],
      ["wrong team", { manage: [kind], teams: ["Other team"] }, false, false],
      ["wrong branch", { manage: [kind], branches: ["Other branch"] }, false, false],
      ["inactive", { manage: [kind], active: false }, false, false],
      ["no teams", { manage: [kind], teams: [] }, false, false],
      ["no branches", { manage: [kind], branches: [] }, false, false],
    ]) {
      const { seed, session } = rulesFixture(kind);
      const member = Object.assign(seed.members[0], patch);
      assert.equal(functions.canServe(member, session, session.slots[0].role), dutyAllowed, `${kind}: ${change} UI duty`);
      assert.equal(functions.eligibleLead(member, kind, session), schedulerAllowed, `${kind}: ${change} UI scheduler`);
      for (const position of ["main", "backup"]) {
        const h = setup(seed);
        const result = await h.call({ action: "allocation", sessionId: session.id, status: "draft", slots: [{ ...session.slots[0], [position]: member.id }] });
        assert.equal(result.status, dutyAllowed ? 200 : 400, `${kind}: ${change} API ${position}`);
        if (!dutyAllowed) assert.deepEqual(h.get(), seed);
      }
      const h = setup(seed);
      const result = await h.call({ action: "allocation", sessionId: session.id, status: "draft", slots: session.slots, leadId: member.id });
      assert.equal(result.status, schedulerAllowed ? 200 : 400, `${kind}: ${change} API scheduler`);
      if (!schedulerAllowed) assert.deepEqual(h.get(), seed);
    }
  }
});
test("Cover acceptance rechecks active, role, team and branch after profile edits", async () => {
  for (const patch of [{ skills: [] }, { teams: [] }, { branches: [] }, { active: false }]) {
    const { seed, session } = rulesFixture();
    const [requester, replacement] = seed.members;
    session.slots[0].main = requester.id;
    const h = setup(seed);
    assert.equal((await h.call({ action: "swap", sessionId: session.id, slotId: session.slots[0].id, position: "main", targetId: replacement.id, comment: "Agreed cover" }, requester)).status, 200);
    const swap = h.get().swaps.at(-1);
    const updated = { ...replacement, ...patch };
    assert.equal((await h.call({ action: "members-bulk", members: [updated] })).status, 200);
    const before = structuredClone(h.get());
    assert.equal((await h.call({ action: "swap-response", swapId: swap.id, response: "accept" }, updated)).status, 400);
    assert.deepEqual(h.get(), before);
    assert.equal(h.get().sessions[0].slots[0].main, requester.id);
  }
});
test("Membership changes preserve access to existing own duties and avoid copying invalid schedulers to new dates", async () => {
  const { seed, session } = rulesFixture();
  const member = seed.members[0];
  session.slots[0].main = member.id;
  member.teams = [];
  member.branches = [];
  const service = seed.services.find(s => s.id === session.serviceId);
  service.leadId = member.id;
  const h = setup(seed);
  const view = await h.read(member);
  assert.equal(view.status, 200);
  assert(view.body.sessions.some(s => s.id === session.id));
  const past = structuredClone(h.get().sessions[0]);
  assert.equal((await h.call({ action: "generate", serviceId: service.id, start: "2032-06-01", weeks: 1 })).status, 200);
  assert.deepEqual(h.get().sessions[0], past);
  assert(h.get().sessions.slice(1).every(s => s.leadId !== member.id));
});

test("Audit retention defaults to 30 days, exports before deletion, and never deletes schedules", async () => {
  const seed = upgradePlanner(structuredClone(demo));
  delete seed.auditRetentionDays;
  const entry = (id, days) => ({ id, at: new Date(Date.now() - days * 86400000).toISOString(), action: "Allocation updated", by: "Test scheduler", sessionId: seed.sessions[0].id });
  seed.history = [entry("old", 31), entry("recent", 29), entry("new", 0)];
  const h = setup(seed);
  const view = await h.read();
  assert.equal(view.body.auditRetentionDays, 30);
  assert.equal(view.body.expiredAuditCount, 1);
  assert.deepEqual(view.body.history.map(h => h.id), ["recent", "new"]);
  assert.deepEqual(h.get(), seed, "Read does not delete anything");
  const exported = await h.read(admin, "/audit-export");
  assert.equal(exported.status, 200);
  assert.deepEqual(exported.body.history, seed.history);
  assert(!JSON.stringify(exported.body).includes("passwordHash"));
  assert(!JSON.stringify(exported.body).includes("authVersion"));
  assert.equal((await h.read(seed.members[0], "/audit-export")).status, 403);
  assert.equal((await h.call({ action: "audit-cleanup", confirm: false })).status, 400);
  assert.deepEqual(h.get(), seed);
  assert.equal((await h.call({ action: "audit-cleanup", confirm: true })).status, 200);
  assert(!h.get().history.some(h => h.id === "old"));
  assert(h.get().history.some(h => h.id === "recent"));
  assert(h.get().history.some(h => h.action === "Expired audit history deleted" && h.removed === 1));
  for (const key of ["meetings", "services", "sessions", "members", "swaps", "notifications"]) assert.deepEqual(h.get()[key], seed[key]);
});
test("Audit retention is configurable by website admin only and cleanup runs after successful updates", async () => {
  const seed = upgradePlanner(structuredClone(demo));
  const entry = (id, days) => ({ id, at: new Date(Date.now() - days * 86400000).toISOString(), action: "Test", by: "Test" });
  seed.history = [entry("45days", 45), entry("90days", 90)];
  const h = setup(seed);
  for (const actor of [{ ...seed.members[0], manage: ["ministry", "service"], admin: false }]) {
    assert.equal((await h.call({ action: "audit-settings", days: 60, confirm: true }, actor)).status, 403);
    assert.equal((await h.call({ action: "audit-cleanup", confirm: true }, actor)).status, 403);
  }
  for (const days of [0, -1, 1.5, "30", 3651]) assert.equal((await h.call({ action: "audit-settings", days, confirm: true })).status, 400);
  assert.deepEqual(h.get(), seed);
  assert.equal((await h.call({ action: "audit-settings", days: 60, confirm: true })).status, 200);
  assert.equal(h.get().auditRetentionDays, 60);
  assert(h.get().history.some(h => h.id === "45days"));
  assert(!h.get().history.some(h => h.id === "90days"));
  assert.equal((await h.call({ action: "audit-settings", days: 30, confirm: true })).status, 200);
  assert(!h.get().history.some(h => h.id === "45days"));
  const h2 = setup(seed);
  assert.equal((await h2.call({ action: "read-notifications" })).status, 200);
  assert(!h2.get().history.some(h => ["45days", "90days"].includes(h.id)));
});

test("Reserve overlaps are permitted while overlapping primary duties name the conflicting meeting", async () => {
  const { seed, session } = rulesFixture("ministry");
  const [primary, reserve] = seed.members;
  const other = { ...structuredClone(session), id: "other-meeting", name: "Other branch service", branch: "Other branch", slots: [{ ...session.slots[0], id: "other-slot", main: reserve.id, backup: "" }] };
  seed.sessions.push(other);
  const h = setup(seed);
  const input = { action: "allocation", sessionId: session.id, status: "confirmed", slots: [{ ...session.slots[0], main: primary.id, backup: reserve.id }] };
  assert.equal((await h.call(input)).status, 200, "Reserve may already be primary elsewhere");
  const before = structuredClone(h.get());
  const result = await h.call({ ...input, slots: [{ ...session.slots[0], main: reserve.id, backup: "" }] });
  assert.equal(result.status, 400);
  assert.equal(result.body.conflict.sessionId, "other-meeting");
  assert(result.body.error.includes("Other branch service"));
  assert(result.body.error.includes("Other branch"));
  assert.deepEqual(h.get(), before);
  const seed2 = structuredClone(seed);
  seed2.sessions[1].slots[0] = { ...other.slots[0], main: "", backup: primary.id };
  const h2 = setup(seed2);
  assert.equal((await h2.call(input)).status, 200, "Primary may be a reserve elsewhere");
});

test("Deleted or orphaned meetings never block assignments or appear as live meetings", async () => {
  for (const remove of ["service", "meeting", "deleted-service", "deleted-meeting", "deleted-session", "cancelled"]) {
    const { seed, session } = rulesFixture("ministry");
    const member = seed.members[0];
    const template = seed.services.find(s => s.id === session.serviceId);
    const meeting = { ...seed.meetings.find(m => m.id === template.meetingId), id: "old-series" };
    const service = { ...structuredClone(template), id: "old-service", meetingId: meeting.id };
    const other = { ...structuredClone(session), id: "old-session", serviceId: service.id, meetingId: meeting.id, name: "DEMO - retained record", slots: [{ ...session.slots[0], id: "old-slot", main: member.id }] };
    seed.meetings.push(meeting); seed.services.push(service); seed.sessions.push(other);
    if (remove === "service") seed.services = seed.services.filter(s => s.id !== service.id);
    if (remove === "meeting") seed.meetings = seed.meetings.filter(m => m.id !== meeting.id);
    if (remove === "deleted-service") service.deleted = true;
    if (remove === "deleted-meeting") meeting.deleted = true;
    if (remove === "deleted-session") other.deleted = true;
    if (remove === "cancelled") other.cancelled = true;
    const h = setup(seed);
    const view = await h.read();
    assert.equal(view.body.sessions.some(s => s.id === other.id), remove === "cancelled");
    assert.equal((await h.call({ action: "allocation", sessionId: session.id, status: "confirmed", slots: [{ ...session.slots[0], main: member.id }] })).status, 200, remove);
    if (remove !== "cancelled") assert.equal((await h.call({ action: "allocation", sessionId: other.id, status: "draft", slots: other.slots })).status, 404);
  }
});

test("Series edits amend both future planners, preserve past records and do not recreate duplicate weeks", async () => {
  const { seed, session } = rulesFixture("ministry");
  const meeting = seed.meetings.find(m => m.id === session.meetingId);
  const media = seed.services.find(s => s.meetingId === meeting.id && s.kind === "service");
  session.scheduledDate = session.date;
  session.time = "13:00"; session.status = "confirmed";
  session.slots[0].main = seed.members[0].id;
  const sibling = { ...structuredClone(session), id: "future-media", serviceId: media.id, kind: "service", slots: [{ id: "media-slot", role: "Sound operator", main: "", backup: "" }], cancelled: true };
  const past = { ...structuredClone(session), id: "past-date", date: "2020-01-05", scheduledDate: "2020-01-05", occurrenceId: meeting.id + ":2020-01-05" };
  seed.sessions = [past, session, sibling];
  seed.members[0].availability = { [session.id]: "available", [past.id]: "available" };
  seed.swaps.push({ id: "future-cover", sessionId: session.id, from: seed.members[0].id, to: seed.members[1].id, status: "pending" });
  const h = setup(seed);
  const edit = { action: "meeting", meeting: { ...meeting, name: "Corrected regular meeting", time: "09:30" } };
  assert.equal((await h.call(edit)).status, 200);
  assert.deepEqual(h.get().sessions.find(s => s.id === past.id), past);
  for (const id of [session.id, sibling.id]) {
    const saved = h.get().sessions.find(s => s.id === id);
    assert.equal(saved.time, "09:30");
    assert.equal(saved.name, "Corrected regular meeting");
    assert.equal(saved.status, "draft");
  }
  assert.equal(h.get().sessions.find(s => s.id === sibling.id).cancelled, true);
  assert.equal(h.get().sessions.find(s => s.id === session.id).slots[0].main, seed.members[0].id);
  assert.equal(h.get().members[0].availability[session.id], undefined);
  assert.equal(h.get().members[0].availability[past.id], "available");
  assert.equal(h.get().swaps[0].status, "cancelled");
  assert.equal((await h.call({ ...edit, meeting: { ...edit.meeting, day: 1 } })).status, 200);
  const future = h.get().sessions.filter(s => s.id !== past.id);
  assert(future.every(s => new Date(s.date + "T12:00:00Z").getUTCDay() === 1));
  assert.equal(new Set(future.map(s => s.occurrenceId)).size, 1);
  const count = h.get().sessions.length;
  assert.equal((await h.call({ action: "generate-meeting", meetingId: meeting.id, start: session.date, weeks: 1 })).status, 200);
  assert.equal(h.get().sessions.length, count);
});
test("Ending a series removes only upcoming dates; only explicit website-admin cleansing removes its past", async () => {
  const { seed, session } = rulesFixture("ministry");
  const meeting = seed.meetings.find(m => m.id === session.meetingId);
  const past = { ...structuredClone(session), id: "preserved-past", date: "2020-01-05", scheduledDate: "2020-01-05", status: "confirmed" };
  seed.sessions.push(past);
  seed.members[0].availability[past.id] = "available";
  const h = setup(seed);
  assert.equal((await h.call({ action: "delete-meeting-series", meetingId: meeting.id, confirm: true })).status, 200);
  assert.deepEqual(h.get().sessions.find(s => s.id === past.id), past);
  assert(!h.get().sessions.some(s => s.id === session.id));
  const view = (await h.read()).body;
  assert(view.sessions.some(s => s.id === past.id));
  assert(!view.meetings.some(m => m.id === meeting.id));
  assert(view.archivedSeries.some(m => m.id === meeting.id && m.pastDates === 1));
  assert.equal((await h.call({ action: "generate-meeting", meetingId: meeting.id, start: "2032-06-01", weeks: 1 })).status, 400);
  const purge = { action: "cleanse-meeting-series", meetingId: meeting.id, confirm: true, confirmTestData: true, reason: "Remove test series at administrator request" };
  assert.equal((await h.call(purge, { ...seed.members[0], admin: false, manage: ["ministry"] })).status, 403);
  assert.equal((await h.call({ ...purge, confirmTestData: false })).status, 400);
  assert.equal((await h.call({ ...purge, reason: "" })).status, 400);
  assert.equal((await h.call(purge)).status, 200);
  assert(!h.get().sessions.some(s => s.id === past.id));
  assert(!h.get().meetings.some(m => m.id === meeting.id));
  assert(!h.get().services.some(s => s.meetingId === meeting.id));
  assert.equal(h.get().members[0].availability[past.id], undefined);
  assert(h.get().history.some(h => h.action === "Past series data cleansed" && h.reason === purge.reason));
});

test("Recurring weeks fill automatically for signed-in volunteers without duplicates, past fabrication or resurrecting ended series", async () => {
  const seed = upgradePlanner(structuredClone(demo));
  const h = setup(seed);
  const volunteer = { ...seed.members[0], manage: [], admin: false };
  const request = { action: "ensure-week", start: "2033-03-07" };
  assert.equal((await h.call(request, volunteer)).status, 200);
  const added = h.get().sessions.slice(seed.sessions.length);
  assert.equal(added.length, seed.meetings.length * 2);
  for (const meeting of seed.meetings) assert.deepEqual(new Set(added.filter(s => s.meetingId === meeting.id).map(s => s.kind)), new Set(["ministry", "service"]));
  const saved = structuredClone(h.get());
  assert.equal((await h.call(request, volunteer)).status, 200);
  assert.deepEqual(h.get(), saved, "Viewing a prepared week does not write another revision");
  assert.equal((await h.call({ action: "ensure-week", start: "2001-01-01" }, volunteer)).status, 200);
  assert.deepEqual(h.get(), saved, "Browsing old weeks never creates historical meetings");
  const meeting = seed.meetings[0];
  assert.equal((await h.call({ action: "delete-meeting-series", meetingId: meeting.id, confirm: true })).status, 200);
  assert.equal((await h.call({ action: "ensure-week", start: "2033-04-04" }, volunteer)).status, 200);
  assert(!h.get().sessions.some(s => s.meetingId === meeting.id && s.date >= "2033-04-04"));
});

test("Reinstatement restores both planners as drafts even when old volunteers are no longer eligible", async () => {
  const { seed, session } = rulesFixture("ministry");
  const media = seed.services.find(s => s.meetingId === session.meetingId && s.kind === "service");
  session.cancelled = true;
  session.status = "confirmed";
  session.slots[0].main = seed.members[0].id;
  seed.members[0].skills = [];
  const sibling = { ...structuredClone(session), id: "cancelled-media", serviceId: media.id, kind: "service", slots: [{ id: "media-old", role: "Sound operator", main: seed.members[0].id, backup: "" }] };
  seed.sessions.push(sibling);
  const h = setup(seed);
  const restore = { action: "meeting-occurrence", sessionId: session.id, date: session.date, time: session.time, cancelled: false, comment: "Meeting reinstated for review." };
  assert.equal((await h.call(restore)).status, 200);
  assert(h.get().sessions.every(s => !s.cancelled && s.status === "draft"));
  assert(h.get().sessions.every(s => s.slots[0].main === seed.members[0].id));
  const allocation = { action: "allocation", sessionId: session.id, status: "confirmed", slots: session.slots };
  assert.equal((await h.call(allocation)).status, 400, "Old invalid assignments still cannot be confirmed");
  assert.equal((await h.call({ ...allocation, slots: [{ ...session.slots[0], main: seed.members[1].id }] })).status, 200, "The reinstated draft can be corrected and confirmed");
});


test("Self and paired or legacy copies do not clash, while different meetings still do", async () => {
  for (const variant of ["self", "paired", "legacy", "different"]) {
    const { seed, session } = rulesFixture("ministry");
    const member = seed.members[0];
    session.slots[0].main = member.id;
    if (variant !== "self") {
      const other = { ...structuredClone(session), id: "other-record" };
      if (variant === "paired") other.kind = "service";
      if (variant === "legacy") { other.meetingId = "legacy-series"; other.occurrenceId = "legacy-occurrence"; other.name = "DEMO - " + session.name.replace(/^DEMO\s*[-·]\s*/i, ""); seed.meetings.push({ ...seed.meetings[0], id: other.meetingId }); }
      if (variant === "different") { other.name = "Different service"; other.occurrenceId = "different-occurrence"; }
      seed.sessions.push(other);
    }
    const h = setup(seed);
    const result = await h.call({ action: "allocation", sessionId: session.id, status: "confirmed", slots: session.slots });
    assert.equal(result.status, variant === "different" ? 400 : 200, variant);
  }
});

function coverageFixture() {
  const { seed, session: pastoral } = rulesFixture("ministry");
  const service = seed.services.find(s => s.meetingId === pastoral.meetingId && s.kind === "service");
  const choir = { ...structuredClone(pastoral), id: "coverage-choir", serviceId: service.id, kind: "service", emergencyCover: undefined, slots: [{ id: "choir-lead", role: "Lead singer", main: "", backup: "" }, { id: "sound", role: "Sound operator", main: "", backup: "" }] };
  seed.sessions.push(choir);
  seed.members.forEach(m => m.skills = ["Ministry volunteer", "Lead singer", "Sound operator", "Branch prayer leader"]);
  return { seed, pastoral, choir };
}
test("Meeting readiness needs one available pastor; choir lead and other vacancies are separate priorities", async () => {
  const { seed, pastoral, choir } = coverageFixture();
  const pastor = seed.members[0], lead = seed.members[1];
  choir.slots[0].main = lead.id; choir.slots[1].main = lead.id;
  assert.equal(meetingReadiness(seed, choir).code, "pastor-needed", "A full media plan cannot replace pastoral cover");
  pastoral.slots[0].backup = pastor.id;
  assert.equal(meetingReadiness(seed, choir).code, "pastor-needed", "A reserve is not the allocated pastor");
  pastoral.slots[0].backup = ""; pastoral.slots[0].main = pastor.id;
  choir.slots.forEach(slot => slot.main = "");
  let status = meetingReadiness(seed, choir);
  assert.equal(status.code, "ready"); assert.equal(status.pastorId, pastor.id); assert.equal(status.choirLeadId, ""); assert.equal(status.otherVacancies, 1);
  assert.deepEqual(meetingReadiness(seed, pastoral), status, "Both planners and shared meeting show the same readiness");
  choir.slots[0].main = lead.id;
  assert.equal(meetingReadiness(seed, choir).choirLeadId, lead.id);
  pastor.availability[pastoral.id] = "unavailable";
  assert.equal(meetingReadiness(seed, choir).code, "pastor-needed");
  delete pastor.availability[pastoral.id]; pastor.skills = ["Sound operator"];
  assert.equal(meetingReadiness(seed, choir).code, "pastor-needed", "An invalid pastoral assignment never counts");
});
test("Plans can be confirmed with local cover pending and the scheduler can record the name later", async () => {
  const { seed, pastoral, choir } = coverageFixture(); const h = setup(seed);
  assert.equal((await h.call({ action: "allocation", sessionId: choir.id, slots: choir.slots, status: "confirmed" })).status, 200);
  assert.equal((await h.call({ action: "allocation", sessionId: pastoral.id, slots: pastoral.slots, status: "confirmed" })).status, 200);
  assert.equal(meetingReadiness(h.get(), h.get().sessions.find(s => s.id === pastoral.id)).label, "Pastor needed");
  const allocated = [{ ...pastoral.slots[0], main: seed.members[0].id }];
  assert.equal((await h.call({ action: "allocation", sessionId: pastoral.id, slots: allocated, status: "confirmed" })).status, 200);
  const view = await h.read();
  assert(view.body.sessions.every(s => s.readiness.code === "ready"));
  assert.equal(view.body.sessions.find(s => s.id === choir.id).readiness.otherVacancies, 1);
});
test("Local prayer-leader names can be recorded later with optional notes", async () => {
  const { seed, pastoral, choir } = coverageFixture(); const leader = seed.members[1]; const h = setup(seed);
  const input = { action: "allocation", sessionId: pastoral.id, slots: pastoral.slots, status: "confirmed", emergencyCover: { memberId: leader.id, reason: "Pastor delayed by a road closure" } };
  assert.equal((await h.call(input, { ...leader, manage: ["service"] })).status, 403);
  assert.equal((await h.call({ ...input, emergencyCover: { ...input.emergencyCover, reason: "" } })).status, 200);
  assert.equal((await h.call({ ...input, slots: [{ ...pastoral.slots[0], main: seed.members[0].id }] })).status, 400);
  assert.equal((await h.call(input)).status, 200);
  assert.equal(h.get().sessions[0].slots[0].main, "", "Prayer leader is not silently recorded as a pastor");
  const view = await h.read();
  assert(view.body.sessions.every(s => s.readiness.code === "pastor-needed"));
  assert.equal(view.body.sessions.find(s => s.id === choir.id).readiness.emergencyMemberId, leader.id);
  assert(h.get().history.some(entry => entry.after?.emergencyCover?.reason === input.emergencyCover.reason));
  assert(h.get().notifications.some(entry => entry.recipient === leader.id));
  assert.equal((await h.call({ action: "availability", sessionId: pastoral.id, value: "unavailable" }, leader)).status, 200);
  assert.equal(meetingReadiness(h.get(), h.get().sessions[0]).code, "pastor-needed");
});
test("Emergency cover obeys active, serving role, branch, team, availability and other-meeting clash rules", async () => {
  for (const invalid of ["inactive", "role", "branch", "team", "unavailable", "clash"]) {
    const { seed, pastoral } = coverageFixture(); const leader = seed.members[1];
    if (invalid === "inactive") leader.active = false;
    if (invalid === "role") leader.skills = ["Ministry volunteer"];
    if (invalid === "branch") leader.branches = ["Another branch"];
    if (invalid === "team") leader.teams = ["Another team"];
    if (invalid === "unavailable") leader.availability[pastoral.id] = "unavailable";
    if (invalid === "clash") seed.sessions.push({ ...structuredClone(pastoral), id: "another-event", occurrenceId: "another-occurrence", name: "Another meeting", slots: [{ ...pastoral.slots[0], main: leader.id }] });
    const h = setup(seed);
    assert.equal((await h.call({ action: "allocation", sessionId: pastoral.id, slots: pastoral.slots, status: "confirmed", emergencyCover: { memberId: leader.id, reason: "Emergency cover" } })).status, 400, invalid);
  }
});

test("Availability responses preserve assignments and visibly notify schedulers only when the response changes", async () => {
  const { seed, pastoral } = coverageFixture(); const member = seed.members[0];
  pastoral.slots[0].main = member.id; pastoral.status = "confirmed";
  const h = setup(seed); const beforeSlots = structuredClone(pastoral.slots);
  const response = { action: "availability", sessionId: pastoral.id, value: "available" };
  assert.equal((await h.call(response, member)).status, 200);
  assert.equal(h.get().members[0].availability[pastoral.id], "available");
  assert.deepEqual(h.get().sessions[0].slots, beforeSlots);
  assert.equal(h.get().sessions[0].status, "confirmed");
  const notifications = h.get().notifications.length;
  assert(h.get().notifications.some(n => n.message.includes("confirmed they are available")));
  assert.equal((await h.call(response, member)).status, 200);
  assert.equal(h.get().notifications.length, notifications, "Repeated clicks do not send duplicate availability notifications");
  assert.equal((await h.call({ ...response, value: "unavailable" }, member)).status, 200);
  assert.equal(h.get().sessions[0].status, "draft");
  assert.equal(meetingReadiness(h.get(), h.get().sessions[0]).code, "pastor-needed");
});

test("One skilled volunteer can cover several roles at one meeting without bypassing same-role reserves or other meetings", async () => {
  const { seed, choir } = coverageFixture(); const person = seed.members[0];
  const h = setup(seed), slots = choir.slots.map(slot => ({ ...slot, main: person.id }));
  const input = { action: "allocation", sessionId: choir.id, slots, status: "confirmed" };
  assert.equal((await h.call(input)).status, 200);
  assert(h.get().sessions.find(s => s.id === choir.id).slots.every(slot => slot.main === person.id));
  assert.equal((await h.call({ ...input, slots: slots.map((slot,i) => i ? slot : { ...slot, backup: person.id }) })).status, 400);
  const invalid = structuredClone(seed); invalid.members[0].skills = ["Lead singer"];
  assert.equal((await setup(invalid).call(input)).status, 400, "Every role still needs its own serving skill");
  const clashSeed = structuredClone(seed);
  clashSeed.sessions.push({ ...structuredClone(choir), id: "other-event", name: "Another event", occurrenceId: "other-event-occurrence", slots: [{ ...choir.slots[0], main: person.id }] });
  assert.equal((await setup(clashSeed).call(input)).status, 400, "A different overlapping meeting is still blocked");
});
test("A volunteer already serving another role can accept cover, but cannot be both main and reserve of that role", async () => {
  const { seed, choir } = coverageFixture(); const [target, requester] = seed.members;
  choir.slots[0].main = target.id; choir.slots[1].main = requester.id;
  const input = { action: "swap", sessionId: choir.id, slotId: choir.slots[1].id, position: "main", targetId: target.id, comment: "Agreed to cover sound as well" };
  const h = setup(seed);
  assert.equal((await h.call(input, requester)).status, 200);
  const swap = h.get().swaps.at(-1);
  assert.equal((await h.call({ action: "swap-response", swapId: swap.id, response: "accept" }, target)).status, 200);
  assert(h.get().sessions.find(s => s.id === choir.id).slots.every(slot => slot.main === target.id));
  const duplicate = structuredClone(seed); duplicate.sessions.find(s => s.id === choir.id).slots[1].backup = target.id;
  assert.equal((await setup(duplicate).call(input, requester)).status, 400);
});
test("An exchange cannot hide a retained primary role when one person covers multiple duties", async () => {
  const { seed, choir } = coverageFixture(); const [requester, target] = seed.members;
  choir.slots.forEach(slot => slot.main = requester.id);
  const other = { ...structuredClone(choir), id: "exchange-event", occurrenceId: "exchange-occurrence", name: "Other simultaneous meeting", slots: [{ ...choir.slots[0], id: "exchange-duty", main: target.id }] };
  seed.sessions.push(other);
  const h = setup(seed);
  assert.equal((await h.call({ action: "swap", sessionId: choir.id, slotId: choir.slots[0].id, position: "main", targetId: target.id, exchangeSessionId: other.id, exchangeSlotId: other.slots[0].id, exchangePosition: "main", comment: "Attempt to exchange while retaining sound" }, requester)).status, 400);
  assert.equal(h.get().swaps.length, seed.swaps.length);
});

test("Inline volunteer creation is scoped to the managed meeting and does not create login/admin access or save allocations", async () => {
  const { seed, choir } = coverageFixture(); const scheduler = { ...seed.members[0], manage: ["service"] };
  const before = structuredClone(seed.sessions); const h = setup(seed);
  const input = { action: "quick-volunteer", sessionId: choir.id, name: "New Local Volunteer", role: "Sound operator", qualified: true, manage: ["ministry", "service"], branches: ["Arbitrary branch"], password: "not-an-account-password" };
  assert.equal((await h.call({ ...input, qualified: false }, scheduler)).status, 400);
  assert.equal((await h.call(input, { ...scheduler, manage: ["ministry"] })).status, 403);
  assert.equal((await h.call({ ...input, role: "Guitarist" }, scheduler)).status, 400);
  const result = await h.call(input, scheduler); assert.equal(result.status, 200);
  const member = h.get().members.find(m => m.id === result.body.quickVolunteerId);
  assert.equal(member.name, input.name); assert.deepEqual(member.skills, ["Sound operator"]);
  assert.deepEqual(member.teams, [choir.team]); assert.deepEqual(member.branches, [choir.branch]); assert.deepEqual(member.manage, []);
  assert.equal(member.username, ""); assert.equal(member.passwordHash, undefined); assert.equal(member.active, true);
  assert.deepEqual(h.get().sessions, before, "Inline creation does not submit or overwrite the team's unsaved assignments");
  assert.equal((await h.call(input, scheduler)).status, 400, "A duplicate name requires explicitly choosing an existing person");
  assert.equal((await h.call({ ...input, memberId: member.id, name: "" }, scheduler)).status, 200);
  const edit = { ...member, name: "New Local Volunteer Updated" };
  assert.equal((await h.call({ action: "member", member: edit })).status, 200, "The admin can edit a no-login profile without inventing a password");
});
test("Inline updates of existing eligibility require website admin and keep all unrelated skills and permissions", async () => {
  const { seed, choir } = coverageFixture(); const member = seed.members[1];
  member.skills = ["Guitarist"]; member.teams = ["Another team"]; member.branches = ["Another branch"]; member.manage = ["ministry"];
  const h = setup(seed), input = { action: "quick-volunteer", sessionId: choir.id, role: "Sound operator", memberId: member.id, qualified: true };
  assert.equal((await h.call(input, { ...seed.members[0], manage: ["service"] })).status, 403);
  assert.equal((await h.call(input)).status, 200);
  const updated = h.get().members.find(m => m.id === member.id);
  assert.deepEqual(new Set(updated.skills), new Set(["Guitarist", "Sound operator"]));
  assert(updated.branches.includes(choir.branch)); assert(updated.teams.includes(choir.team)); assert.deepEqual(updated.manage, member.manage);
  const inactive = structuredClone(seed); inactive.members[1].active = false;
  assert.equal((await setup(inactive).call(input)).status, 400, "Inactive people are not silently reactivated");
});

test("Inline creation records explicitly selected skills and scoped choir schedulers can enable another service role", async () => {
  const { seed, choir } = coverageFixture(); const scheduler = { ...seed.members[0], manage: ["service"] }; const h = setup(seed);
  const base = { action: "quick-volunteer", sessionId: choir.id, name: "Anu Example", role: "Sound operator", qualified: true };
  const result = await h.call({ ...base, roles: ["Sound operator", "Lead singer"] }, scheduler);
  assert.equal(result.status, 200);
  assert.deepEqual(new Set(h.get().members.find(m => m.id === result.body.quickVolunteerId).skills), new Set(["Sound operator", "Lead singer"]));
  assert.equal((await h.call({ ...base, name: "Invalid Scope", roles: ["Sound operator", "Ministry volunteer"] }, scheduler)).status, 400);
  const member = seed.members[1];
  const separate = structuredClone(seed); separate.members[1].skills = ["Sound operator"];
  const scoped = setup(separate);
  assert.equal((await scoped.call({ action: "quick-volunteer", sessionId: choir.id, role: "Lead singer", memberId: member.id, qualified: false }, scheduler)).status, 400);
  assert.equal((await scoped.call({ action: "quick-volunteer", sessionId: choir.id, role: "Lead singer", memberId: member.id, qualified: true }, scheduler)).status, 200);
  assert(scoped.get().members[1].skills.includes("Lead singer"));
  assert.deepEqual(scoped.get().members[1].manage, separate.members[1].manage);
  assert.deepEqual(scoped.get().members[1].branches, separate.members[1].branches);
  assert.deepEqual(scoped.get().members[1].teams, separate.members[1].teams);
});
test("Other-role dropdowns immediately include a new person with an explicit enable-skill option until qualified", async () => {
  const { runInNewContext } = await import("node:vm");
  const ui = readFileSync(new URL("../assets/js/volunteers.js", import.meta.url), "utf8");
  const source = ui.slice(ui.indexOf("  function memberOptions("), ui.indexOf("  function updates("));
  const member = { id: "anu-example", name: "Anu Example", active: true, skills: ["Camera operator"], teams: ["English"], branches: ["Main Church"], availability: {} };
  const context = { state: { members: [member] }, esc: value => String(value), name: () => member.name, roleLabel: value => value,
    participates: (m,s) => m.active && m.teams.includes(s.team) && m.branches.includes(s.branch),
    canServe: (m,s,role) => m.active && m.skills.includes(role) && m.teams.includes(s.team) && m.branches.includes(s.branch),
    options: rows => rows.map(([id,label]) => `<option value="${id}">${label}</option>`).join("") };
  const renderOptions = runInNewContext(source + ";memberOptions", context);
  const meeting = { id: "meeting", kind: "service", team: "English", branch: "Main Church" };
  assert(renderOptions(meeting, { role: "Camera operator" }, "").includes('value="anu-example"'));
  const screen = renderOptions(meeting, { role: "Screen operator" }, "");
  assert(screen.includes('value="__enable_role__:anu-example"')); assert(!screen.includes('value="anu-example"'));
  member.skills.push("Screen operator");
  const qualified = renderOptions(meeting, { role: "Screen operator" }, "");
  assert(qualified.includes('value="anu-example"')); assert(!qualified.includes('__enable_role__:anu-example'));
  assert(!renderOptions({ ...meeting, kind: "ministry" }, { role: "Ministry volunteer" }, "").includes('anu-example'));
});

test("Website administrator explicitly links a serving identity without changing duties or volunteer access", async () => {
  const app = setup();
  const before = (await app.read()).body;
  assert.equal(before.personalMemberId, null);
  const member = before.members.find(m => m.active);
  const linked = await app.call({ action: "link-admin-volunteer", memberId: member.id });
  assert.equal(linked.status, 200);
  assert.equal(linked.body.personalMemberId, member.id);
  assert.equal(linked.body.actor.id, "admin");
  assert.deepEqual(linked.body.sessions, before.sessions);
  assert.deepEqual(linked.body.members, before.members);
  assert.equal((await app.read()).body.personalMemberId, member.id);
  assert.equal((await app.call({ action: "link-admin-volunteer", memberId: "missing" })).status, 400);
  assert.equal((await app.call({ action: "link-admin-volunteer", memberId: member.id }, member)).status, 403);
  assert.equal((await app.read(member)).body.personalMemberId, member.id);
});

test("My Week includes all serving identities, languages and branches regardless of planner filters", async () => {
  const { runInNewContext } = await import("node:vm");
  const js = readFileSync(new URL("../assets/js/volunteers.js", import.meta.url), "utf8");
  const identities = js.slice(js.indexOf("  let viewedMemberId ="), js.indexOf("  function render()"));
  const selection = js.slice(js.indexOf("  function selectedSessions()"), js.indexOf("  function weekly()"));
  const sessions = [
    {id:"english", date:"2035-06-03", time:"09:30", branch:"Main", team:"English", slots:[{main:"francis",backup:"other"}]},
    {id:"malayalam", date:"2035-06-03", time:"11:30", branch:"Other", team:"Malayalam", slots:[{main:"other",backup:"francis"}]},
    {id:"next-week", date:"2035-06-10", time:"11:30", branch:"Other", team:"Malayalam", slots:[{main:"francis"}]}
  ];
  const context = {state:{actor:admin,personalMemberId:"francis",sessions},weekStart:"2035-05-28",tab:"my-week",branch:"Unrelated",team:"Unrelated",addDays:()=>"2035-06-03"};
  const f = runInNewContext(identities+selection+";({selectedSessions,ownDuties})",context);
  assert.deepEqual(Array.from(f.selectedSessions().filter(s=>f.ownDuties(s).length),s=>s.id),["english","malayalam"]);
  context.state.personalMemberId = null;
  assert.equal(f.ownDuties(sessions[0]).length,0);
  context.state.actor = {id:"francis"};
  assert.equal(f.ownDuties(sessions[1]).length,1);
});

test("Admin home identity matches an exact unique login and temporary viewing never changes it", async () => {
  const seed = structuredClone(demo);
  const member = seed.members.find(m => m.active);
  member.username = "personal-admin";
  const app = setup(seed);
  const result = await app.read({id:"admin",name:"personal-admin",admin:true});
  assert.equal(result.body.personalMemberId, member.id);
  const {runInNewContext} = await import("node:vm");
  const js = readFileSync(new URL("../assets/js/volunteers.js", import.meta.url), "utf8");
  const code = js.slice(js.indexOf("  let viewedMemberId ="), js.indexOf("  function render()"));
  const state = {actor:admin,personalMemberId:member.id};
  const f = runInNewContext(code+";({personalId,ownMemberId,view:id=>{viewedMemberId=id}})",{state});
  f.view("another-volunteer");
  assert.equal(f.personalId(),"another-volunteer");
  assert.equal(f.ownMemberId(),member.id);
  assert.equal(state.personalMemberId,member.id);
  f.view(null);
  assert.equal(f.personalId(),member.id);
});

test("Personal cards show the assigned pastoral and media team together, including reserves", async () => {
  const {runInNewContext} = await import("node:vm");
  const js = readFileSync(new URL("../assets/js/volunteers.js", import.meta.url), "utf8");
  const code = js.slice(js.indexOf("  function serviceTeamSummary("),js.indexOf("  function weekAgenda("));
  const event = {id:"pastoral",occurrenceId:"one",slots:[{role:"Pastor",main:"pastor",backup:"reserve"}],leadId:"scheduler"};
  const media = {id:"media",occurrenceId:"one",slots:[{role:"Camera",main:"camera"}]};
  const other = {id:"unrelated",occurrenceId:"two",slots:[{role:"Camera",main:"unrelated-person"}]};
  const f = runInNewContext(code+";serviceTeamSummary",{state:{sessions:[event,media,other]},sameMeetingOccurrence:(a,b)=>a.occurrenceId===b.occurrenceId,esc:String,name:String,roleLabel:String});
  const html = f(event);
  for (const expected of ["pastor","reserve","camera","scheduler"]) assert(html.includes(expected));
  assert(!html.includes("unrelated-person"));
});

test("A login mapped to Francis overrides a stale Sam selection and cannot be replaced by viewing another rota", async () => {
  const seed = structuredClone(demo);
  const active = seed.members.filter(m => m.active);
  const francis = active[0], sam = active[1];
  francis.username = "yesfra";
  sam.username = "sam-test";
  seed.adminVolunteerId = sam.id;
  seed.adminVolunteerLinks = {yesfra:sam.id};
  const app = setup(seed);
  const actor = {id:"admin",name:"yesfra",admin:true};
  const result = await app.read(actor);
  assert.equal(result.body.personalMemberId,francis.id);
  assert.equal(result.body.personalIdentityFromLogin,true);
  assert.equal((await app.call({action:"link-admin-volunteer",memberId:sam.id},actor)).status,400);
  assert.equal((await app.read(actor)).body.personalMemberId,francis.id);
  const other = await app.read({id:"admin",name:"another-admin",admin:true});
  assert.equal(other.body.personalMemberId,null);
  assert.equal((await app.call({action:"link-admin-volunteer",memberId:sam.id},{id:"admin",name:"another-admin",admin:true})).status,200);
  assert.equal((await app.read(actor)).body.personalMemberId,francis.id);
});

test("My Week combines the same service into one card and highlights every allocated role", async () => {
  const {runInNewContext} = await import("node:vm");
  const js = readFileSync(new URL("../assets/js/volunteers.js", import.meta.url), "utf8");
  const code = js.slice(js.indexOf("  function personalMeetings("),js.indexOf("  function personalProfileControl(")) + js.slice(js.indexOf("  function meetingTile("),js.indexOf("  function meetingCard("));
  const sessions = [
    {id:"english-media",occurrenceId:"english",kind:"service",name:"English",branch:"Main",team:"English",date:"2035-06-03",time:"09:30",slots:[{role:"Sound operator",main:"francis"}]},
    {id:"english-pastor",occurrenceId:"english",kind:"ministry",name:"English",branch:"Main",team:"English",date:"2035-06-03",time:"09:30",slots:[{role:"Pastor",main:"francis",backup:"sam"}]},
    {id:"malayalam-media",occurrenceId:"malayalam",kind:"service",name:"Malayalam",branch:"Main",team:"Malayalam",date:"2035-06-03",time:"11:00",slots:[{role:"Sound operator",main:"francis"}]}
  ];
  const ownDuties = s => s.slots.filter(d => d.main === "francis" || d.backup === "francis");
  const f = runInNewContext(code+";({personalMeetings,personalMeetingCard})",{state:{actor:admin,sessions},ownDuties,ownDuty:s=>ownDuties(s)[0],tab:"my-week",plannerBadge:()=>({label:"Can go ahead",className:"vs-green"}),personalId:()=>"francis",sameMeetingOccurrence:(a,b)=>a.occurrenceId===b.occurrenceId,readiness:()=>({code:"ready",label:"Can go ahead"}),canEdit:()=>true,branchStyle:()=>"",date:String,shortDate:String,esc:String,meetingTitle:String,roleLabel:String,viewedMemberId:null,coverageSummary:()=>"",serviceTeamSummary:()=>"Full team",availabilityLabel:()=>"",needsReview:()=>false,btn:(label,action,attrs)=>`<button ${attrs} data-action="${action}">${label}</button>`});
  const cards = f.personalMeetings(sessions);
  assert.deepEqual(Array.from(cards,s=>s.id),["english-media","malayalam-media"]);
  const html = f.personalMeetingCard(cards[0]);
  assert(html.includes("Your duties"));
  assert(html.includes("Sound operator"));
  assert(html.includes("Pastor"));
  assert.equal((html.match(/wp-duty-line/g)||[]).length,2);
  assert(html.includes("open-personal-team"));
  assert.equal(sessions.length,3);
});


test('Volunteers see their own meeting lineups, not unrelated branch schedules; scheduler lanes remain separate', async () => {
  const {seed,pastoral,choir} = coverageFixture();
  const volunteer=seed.members[0]; volunteer.manage=[]; pastoral.slots[0].main=volunteer.id;
  const unrelated=structuredClone(choir); unrelated.id='unrelated-private-meeting'; unrelated.date='2039-12-25'; unrelated.occurrenceId='unrelated-occurrence'; unrelated.slots.forEach(slot=>{slot.main='';slot.backup='';});
  seed.sessions.push(unrelated);
  const outsider={id:'outsider-private',name:'Unrelated Person',active:true,skills:[],branches:['Another Branch'],teams:['Another Team'],manage:[],availability:{}}; seed.members.push(outsider);
  const h=setup(seed); const view=await h.read(volunteer);
  assert.equal(view.status,200); assert(view.body.sessions.some(s=>s.id===pastoral.id)); assert(view.body.sessions.some(s=>s.id===choir.id),'Linked choir lineup is visible');
  assert(!view.body.sessions.some(s=>s.id===unrelated.id),'Same branch and team do not grant unrelated schedule access');
  assert(!view.body.members.some(m=>m.id===outsider.id)); assert.deepEqual(view.body.services,[]); assert.deepEqual(view.body.history,[]);
  assert.equal((await h.call({action:'allocation',sessionId:choir.id,slots:choir.slots,status:'confirmed'},volunteer)).status,403);
  const scheduler={...volunteer,manage:['service']};
  assert((await h.read(scheduler)).body.sessions.some(s=>s.id===unrelated.id));
  assert.equal((await h.call({action:'allocation',sessionId:pastoral.id,slots:pastoral.slots,status:'confirmed'},scheduler)).status,403);
  const pastoralScheduler={...volunteer,manage:['ministry']};
  assert.equal((await h.call({action:'allocation',sessionId:choir.id,slots:choir.slots,status:'confirmed'},pastoralScheduler)).status,403);
});
