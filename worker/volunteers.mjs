// Shared scheduling API: used by the Node server and Worker adapter.
const roles = [
  "Lead singer",
  "Choir singer",
  "Keyboard player",
  "Guitarist",
  "Sound operator",
  "Camera operator",
  "Screen operator",
  "Ministry volunteer",
  "Branch prayer leader",
];
export const emptyVolunteers = () => ({
  revision: 0,
  meetings: [],
  plannerVersion: 2,
  roles: [...roles],
  members: [],
  services: [],
  sessions: [],
  swaps: [],
  notifications: [],
  history: [],
  auditRetentionDays: 30,
});
const fail = (message, status = 400, details = {}) => {
  throw Object.assign(new Error(message), { status, ...details });
};
const text = (v, max = 200) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    fail("Please complete the required fields.");
  return v.trim();
};
const id = () => crypto.randomUUID();
const hex = (bytes) =>
  [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
async function digest(value) {
  return hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: new TextEncoder().encode(salt),
          iterations: 100000,
          hash: "SHA-256",
        },
        key,
        256,
      ),
    ),
  );
}
const cleanMember = ({ passwordHash, salt, recoveryHash, recoveryCreatedAt, emailResetHash, emailResetExpires, ...member }) => ({ ...member, hasRecoveryCode: !!recoveryHash });
const normalRecovery = value => String(value || "").replace(/[\s-]/g, "").toUpperCase();
const validPassword = value => typeof value === "string" && value.length >= 12 && value.length <= 200;
async function limitRecovery(request, store, username, purpose) {
  const client = request.headers.get("cf-connecting-ip") || request.headers.get("x-volunteer-client") || "unknown";
  const keys = await Promise.all(["client:" + client, "account:" + username].map(value => digest(purpose + ":" + value)));
  const entries = await Promise.all(keys.map(key => store.getKey("recovery-attempt-" + key)));
  if (entries.some((entry, index) => entry?.until > Date.now() && entry.count >= (index === 0 ? 50 : 10))) fail("Too many attempts. Try again in 15 minutes.", 429);
  for (let i = 0; i < keys.length; i++) {
    const previous = entries[i];
    await store.putKey("recovery-attempt-" + keys[i], { count: previous?.until > Date.now() ? previous.count + 1 : 1, until: previous?.until > Date.now() ? previous.until : Date.now() + 900000 });
  }
}
const manager = (actor, kind) => actor.admin || actor.manage?.includes(kind);
const manages = (actor, session) =>
  manager(actor, session.kind);
const currentMember = (state, memberId) =>
  state.members.find((m) => m.id === memberId && m.active);
const participates = (member, context) => !!member?.active &&
  member.teams.includes(context.team) && member.branches.includes(context.branch);
const eligibleLead = (member, kind, context) => !!member?.active &&
  !!member.manage?.includes(kind) && (!context || participates(member, context));
function validateLead(state, kind, memberId, context) {
  if (!memberId) return;
  if (!eligibleLead(currentMember(state, memberId), kind, context))
    fail("Choose an active scheduler with the matching Scheduling access, service team and branch.");
}
const sessionOf = (state, key) =>
  state.sessions.find((s) => s.id === key && existingSession(state, s)) || fail("Service not found.", 404);
const eligible = (state, session, role, memberId) => {
  const member = currentMember(state, memberId);
  return participates(member, session) && member.skills.includes(role);
};
function available(state, session, memberId) {
  return currentMember(state, memberId)?.availability?.[session.id] || "unsure";
}
function londonNow() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const part = key => parts.find(p => p.type === key).value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
const upcoming = (session, now = londonNow()) => `${session.date}T${session.time}` >= now;
function syncUpcomingSeries(state, meeting, actor) {
  const changes = state.sessions.filter(s => s.meetingId === meeting.id && upcoming(s)).map(session => {
    const base = new Date((session.scheduledDate || session.date) + "T12:00:00Z");
    const weekly = !meeting.recurrence || meeting.recurrence === "weekly";
    if (weekly) base.setUTCDate(base.getUTCDate() + (meeting.day - base.getUTCDay() + 7) % 7);
    const date = weekly ? base.toISOString().slice(0, 10) : session.date;
    const scheduledDate = weekly ? date : session.scheduledDate || session.date;
    const next = { ...session, name: meeting.name, branch: meeting.branch, team: meeting.team, time: meeting.time, duration: meeting.duration, date, scheduledDate, occurrenceId: weekly ? meeting.id + ":" + date : session.occurrenceId || meeting.id + ":" + scheduledDate };
    if (!upcoming(next)) fail("This change would move an upcoming meeting into the past. Change that date individually instead.");
    return { session, next, before: structuredClone(session) };
  });
  const planned = new Map(changes.map(change => [change.session.id, change.next]));
  const dates = new Set();
  for (const original of state.sessions.filter(s => s.meetingId === meeting.id)) {
    const s = planned.get(original.id) || original;
    const key = s.serviceId + ":" + s.date;
    if (dates.has(key)) fail("This series change would put two meetings on the same date. Adjust the individual meeting first.");
    dates.add(key);
  }
  for (const { session, next, before } of changes) {
    if (["name", "branch", "team", "time", "duration", "date"].every(key => session[key] === next[key])) continue;
    const timeChanged = session.date !== next.date || session.time !== next.time || session.duration !== next.duration;
    Object.assign(session, next, { status: "draft" });
    if (!eligibleLead(currentMember(state, session.leadId), session.kind, session)) session.leadId = "";
    if (timeChanged) for (const member of state.members) delete member.availability?.[session.id];
    for (const swap of state.swaps.filter(swap => swap.status === "pending" && (swap.sessionId === session.id || swap.exchangeSessionId === session.id))) {
      swap.status = "cancelled"; swap.resolvedAt = new Date().toISOString();
      for (const recipient of [swap.from, swap.to]) notify(state, recipient, `${meeting.name}: your cover request was cancelled because the meeting series changed.`, session.id);
    }
    updateStamp(session, actor);
    audit(state, actor, "Upcoming meeting updated from series", { sessionId: session.id, meetingId: meeting.id, before, after: structuredClone(session) });
    notifySchedulers(state, session, `${actor.name} updated ${meeting.name} on ${session.date} to ${session.time}. Please review and confirm assignments.`);
    for (const memberId of new Set([session.emergencyCover?.memberId, ...session.slots.flatMap(slot => [slot.main, slot.backup])].filter(Boolean))) notify(state, memberId, `${meeting.name} on ${session.date} is now at ${session.time}. Please review your duty.`, session.id);
  }
}
function existingSession(state, session) {
  if (session.deleted || session.deletedAt) return false;
  const service = state.services.find(service => service.id === session.serviceId && !service.deleted && !service.deletedAt);
  if (!service) return false;
  const meetingId = session.meetingId || service.meetingId;
  const meeting = (state.meetings || []).find(meeting => meeting.id === meetingId && !meeting.deleted && !meeting.deletedAt);
  if ((service.archived || meeting?.archived) && upcoming(session)) return false;
  return !meetingId || !!meeting;
}
function sameMeetingOccurrence(a, b) {
  if (a.id === b.id) return true;
  const normal = value => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const title = value => normal(String(value || "").replace(/^DEMO\s*[-·]\s*/i, ""));
  const samePlaceAndTime = normal(a.branch) === normal(b.branch) && normal(a.team) === normal(b.team) && a.date === b.date && a.time === b.time;
  if (!samePlaceAndTime) return false;
  if (a.occurrenceId && a.occurrenceId === b.occurrenceId) return true;
  if (a.meetingId && a.meetingId === b.meetingId && title(a.name) === title(b.name)) return true;
  return !!title(a.name) && title(a.name) === title(b.name);
}
function conflicting(state, session, memberId, exclude = []) {
  const start = Date.parse(`${session.date}T${session.time}:00Z`),
    end = start + session.duration * 60000;
  return state.sessions.find(
    (s) =>
      !sameMeetingOccurrence(s, session) &&
      existingSession(state, s) &&
      !exclude.includes(s.id) &&
      !s.cancelled &&
      Date.parse(`${s.date}T${s.time}:00Z`) < end &&
      Date.parse(`${s.date}T${s.time}:00Z`) + s.duration * 60000 > start &&
      (s.emergencyCover?.memberId === memberId || s.slots.some(
        (slot) => slot.main === memberId,
      )),
  );
}
function releasedPrimaryExclusions(state, sessionId, slotId, position, memberId) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session || session.emergencyCover?.memberId === memberId || session.slots.some(slot => slot.main === memberId && !(slot.id === slotId && position === "main"))) return [];
  return [sessionId];
}
function validateSelection(state, session, slot, memberId, exclude = [], position = "main") {
  if (!memberId) return;
  if (!eligible(state, session, slot.role, memberId))
    fail(
      "Choose an active volunteer with the right role, branch and service team.",
    );
  if (available(state, session, memberId) === "unavailable")
    fail("This volunteer is unavailable for this service.");
  const clash = position === "main" && conflicting(state, session, memberId, exclude);
  if (clash) fail(`${currentMember(state, memberId).name} is already assigned as primary for ${clash.name} at ${clash.branch} on ${clash.date} at ${clash.time}. Choose another primary volunteer; reserve overlaps are allowed.`, 400, { conflict: { sessionId: clash.id } });
}
function notify(state, recipient, message, sessionId) {
  state.notifications.push({
    id: id(),
    recipient,
    message,
    sessionId,
    at: new Date().toISOString(),
    read: false,
  });
}
function notifySchedulers(state, session, message) {
  notify(state, "admin", message, session.id);
  for (const m of state.members)
    if (
      m.active &&
      m.manage.includes(session.kind)
    )
      notify(state, m.id, message, session.id);
}
function audit(state, actor, action, details) {
  state.history.push({
    id: id(),
    at: new Date().toISOString(),
    by: actor.name,
    actorId: actor.id,
    action,
    ...details,
  });
}
const retentionDays = state => Number.isInteger(state.auditRetentionDays) && state.auditRetentionDays >= 1 && state.auditRetentionDays <= 3650 ? state.auditRetentionDays : 30;
const expiredAudit = (state, entry, now = Date.now()) => Number.isFinite(Date.parse(entry.at)) && Date.parse(entry.at) < now - retentionDays(state) * 86400000;
function pruneAudit(state, actor) {
  const before = state.history.length;
  state.history = state.history.filter(entry => !expiredAudit(state, entry));
  const removed = before - state.history.length;
  if (removed) audit(state, actor, "Expired audit history deleted", { removed, retentionDays: retentionDays(state) });
}
function updateStamp(session, actor) {
  session.updatedAt = new Date().toISOString();
  session.updatedBy = actor.name;
}
function validDate(date) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date + "T12:00:00Z").toISOString().slice(0, 10) === date
  );
}
function pendingGuard(state, sessionId) {
  if (
    state.swaps.some(
      (s) =>
        s.status === "pending" &&
        (s.sessionId === sessionId || s.exchangeSessionId === sessionId),
    )
  )
    fail(
      "Resolve or cancel the pending swap before editing this service.",
      409,
    );
}
function createOccurrences(state, service, start, weeks, futureOnly = false) {
  if (service.archived || (state.meetings || []).some(m => m.id === service.meetingId && m.archived)) fail("This meeting series has ended; new dates cannot be created.");
  if (!validDate(start) || !Number.isInteger(weeks) || weeks < 1 || weeks > 26)
    fail("Choose a start date and between 1 and 26 weeks.");
  const bounded = service.recurrence === "once" || service.recurrence === "daily";
  const end = new Date(start + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + weeks * 7 - 1);
  let d = new Date((bounded && service.startDate > start ? service.startDate : start) + "T12:00:00Z");
  if (!bounded) d.setUTCDate(d.getUTCDate() + ((service.day - d.getUTCDay() + 7) % 7));
  for (; d <= end; d.setUTCDate(d.getUTCDate() + (bounded ? 1 : 7))) {
    const date = d.toISOString().slice(0, 10);
    if (bounded && (!validDate(service.startDate) || !validDate(service.endDate))) fail("This meeting needs valid start and end dates.");
    if (bounded && date > service.endDate) break;
    if (futureOnly && !upcoming({ date, time: service.time })) continue;
    if (
      !state.sessions.some(
        (s) =>
          s.serviceId === service.id &&
          (s.date === date || s.scheduledDate === date),
      )
    ) {
      state.sessions.push({
        id: id(),
        serviceId: service.id,
        ...(service.meetingId
          ? {
              meetingId: service.meetingId,
              occurrenceId: service.meetingId + ":" + date,
            }
          : {}),
        date,
        scheduledDate: date,
        name: service.name,
        kind: service.kind,
        branch: service.branch,
        team: service.team,
        time: service.time,
        duration: service.duration,
        leadId: eligibleLead(currentMember(state, service.leadId), service.kind, service) ? service.leadId : "",
        status: "draft",
        cancelled: false,
        slots: service.roles.flatMap((r) =>
          Array.from({ length: r.count }, () => ({
            id: id(),
            role: r.role,
            main: "",
            backup: "",
          })),
        ),
      });
    }
  }
}
const slotList = (service) =>
  service.roles.flatMap((r) =>
    Array.from({ length: r.count }, () => ({
      id: id(),
      role: r.role,
      main: "",
      backup: "",
    })),
  );
const validTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
const meetingManager = (actor) => actor.admin || manager(actor, "ministry");
export function upgradePlanner(state) {
  if (state.plannerVersion === 2 && state.services.every((s) => s.meetingId)) {
    state.meetings ||= [];
    return state;
  }
  state.meetings = [];
  const groups = new Map();
  for (const service of [...state.services]) {
    const key = JSON.stringify([
      service.branch,
      service.team,
      service.day,
      service.time,
      service.name.replace(/^DEMO\s*[-·]\s*/, ""),
    ]);
    let meeting = groups.get(key);
    if (!meeting) {
      meeting = {
        id: "meeting-" + service.id,
        name: service.name,
        branch: service.branch,
        team: service.team,
        day: service.day,
        time: service.time,
        duration: service.duration,
      };
      groups.set(key, meeting);
      state.meetings.push(meeting);
    }
    service.meetingId = meeting.id;
  }
  for (const meeting of state.meetings) {
    const linked = state.services.filter((x) => x.meetingId === meeting.id);
    const dated = state.sessions.filter((x) =>
      linked.some((t) => t.id === x.serviceId),
    );
    for (const kind of ["ministry", "service"]) {
      let service = linked.find((x) => x.kind === kind);
      if (!service) {
        service = {
          ...meeting,
          id: "team-" + meeting.id + "-" + kind,
          meetingId: meeting.id,
          kind,
          leadId:
            state.members.find((m) => eligibleLead(m, kind, meeting))
              ?.id || "",
          roles:
            kind === "ministry"
              ? [{ role: "Ministry volunteer", count: 1 }]
              : [
                  { role: "Sound operator", count: 1 },
                  { role: "Camera operator", count: 1 },
                  { role: "Screen operator", count: 1 },
                ],
        };
        state.services.push(service);
      }
      for (const original of dated) {
        let session = state.sessions.find(
          (x) => x.serviceId === service.id && x.date === original.date,
        );
        if (!session) {
          session = {
            id: "date-" + service.id + "-" + original.date,
            serviceId: service.id,
            date: original.date,
            name: original.name,
            kind,
            branch: original.branch,
            team: original.team,
            time: original.time,
            duration: original.duration,
            leadId: eligibleLead(currentMember(state, service.leadId), service.kind, service) ? service.leadId : "",
            status: "draft",
            cancelled: original.cancelled,
            slots: slotList(service),
          };
          state.sessions.push(session);
        }
        session.meetingId = meeting.id;
        session.scheduledDate ||= session.date;
        session.occurrenceId = meeting.id + ":" + original.date;
      }
    }
  }
  state.plannerVersion = 2;
  return state;
}
function validateRoles(state, roles) {
  if (
    !Array.isArray(roles) ||
    !roles.length ||
    roles.length > 30 ||
    roles.some(
      (r) =>
        !state.roles.includes(r.role) ||
        !Number.isInteger(r.count) ||
        r.count < 1 ||
        r.count > 20,
    ) ||
    roles.reduce((n, r) => n + r.count, 0) > 100
  )
    fail("Choose the required roles and number of places.");
}
export function meetingReadiness(state, session, activeSessions = state.sessions.filter(other => existingSession(state, other))) {
  const linked = activeSessions.filter(other => !other.cancelled && sameMeetingOccurrence(other, session));
  const pastoral = linked.filter(other => other.kind === "ministry");
  const valid = (s, role, memberId) => memberId && eligible(state, s, role, memberId) && available(state, s, memberId) !== "unavailable" && !conflicting(state, s, memberId);
  const pastor = pastoral.flatMap(s => s.slots.filter(slot => slot.role === "Ministry volunteer").map(slot => ({ session: s, memberId: slot.main }))).find(duty => valid(duty.session, "Ministry volunteer", duty.memberId));
  const emergency = pastoral.find(s => valid(s, "Branch prayer leader", s.emergencyCover?.memberId));
  const choir = linked.filter(s => s.kind === "service");
  const choirLead = choir.flatMap(s => s.slots.filter(slot => slot.role === "Lead singer").map(slot => ({ session: s, memberId: slot.main }))).find(duty => valid(duty.session, "Lead singer", duty.memberId));
  const otherVacancies = choir.reduce((total, s) => total + s.slots.filter(slot => slot.role !== "Lead singer" && !valid(s, slot.role, slot.main)).length, 0);
  const code = session.cancelled ? "cancelled" : pastor ? "ready" : "pastor-needed";
  return { code, label: { cancelled: "Cancelled", ready: "Can go ahead", "emergency-cover": "Can go ahead", "pastor-needed": "Pastor needed" }[code], pastorId: pastor?.memberId || "", emergencyMemberId: !pastor ? emergency?.emergencyCover.memberId || "" : "", choirLeadId: choirLead?.memberId || "", otherVacancies };
}
function sessionsForActor(state, actor, activeSessions = state.sessions.filter(s => existingSession(state, s))) {
  if (actor.admin) return activeSessions;
  const swapSessionIds = new Set(state.swaps
    .filter(swap => swap.from === actor.id || swap.to === actor.id)
    .flatMap(swap => [swap.sessionId, swap.exchangeSessionId]));
  const ownSessions = activeSessions.filter(session =>
    session.emergencyCover?.memberId === actor.id ||
    session.slots.some(slot => slot.main === actor.id || slot.backup === actor.id) ||
    swapSessionIds.has(session.id));
  const managedSessions = state.sessions.filter(session => manager(actor, session.kind));
  const relevantMeetings = [...ownSessions, ...managedSessions];
  return activeSessions.filter(session => manager(actor, session.kind) ||
    relevantMeetings.some(other => sameMeetingOccurrence(other, session)));
}
function view(state, actor) {
  const { registrations, adminVolunteerLinks, ...publicState } = state;
  const adminLogin = String(actor.name || "").trim().toLowerCase();
  const matchingMembers = actor.admin ? state.members.filter(m => m.active && [m.username, m.email].some(value => value && String(value).trim().toLowerCase() === adminLogin)) : [];
  const adminMemberId = matchingMembers.length === 1 ? matchingMembers[0].id : matchingMembers.length > 1 ? null : state.adminVolunteerLinks?.[adminLogin] || null;

  const activeSessions = state.sessions.filter(s => existingSession(state, s));
  const sessions = sessionsForActor(state, actor, activeSessions);
  const coordinator = actor.admin || actor.manage?.length;
  const memberVisible = m => coordinator || m.id === actor.id || sessions.some(s => s.leadId === m.id || s.emergencyCover?.memberId === m.id || s.slots.some(slot => slot.main === m.id || slot.backup === m.id) || (participates(m, s) && s.slots.some(slot => m.skills.includes(slot.role))));
  const visible = new Set(sessions.map((s) => s.id));
  return {
    ...publicState,
    personalIdentityFromLogin: actor.admin && matchingMembers.length === 1,
    personalMemberId: actor.admin ? (state.members.some(m => m.id === adminMemberId) ? adminMemberId : null) : actor.id,
    roles: [...new Set([...state.roles, "Branch prayer leader"])],
    pendingAccounts: actor.admin ? (registrations || []).filter(r => r.verifiedAt && r.expires > Date.now()).map(r => ({ id: r.id, name: r.name, email: r.email, verifiedAt: r.verifiedAt })) : [],
    members: state.members.filter(memberVisible).map((m) => {
      const c = cleanMember(m);
      if (!actor.admin) {
        delete c.username;
        delete c.email;

        c.availability = Object.fromEntries(
          Object.entries(c.availability || {}).filter(([key]) =>
            visible.has(key),
          ),
        );
      }
      return c;
    }),
    sessions: sessions.map(s => ({ ...s, readiness: meetingReadiness(state, s, activeSessions) })),
    meetings: (state.meetings || []).filter(
      (m) => !m.archived && (
        actor.admin ||
        manager(actor, "ministry") ||
        manager(actor, "service") ||
        sessions.some((s) => s.meetingId === m.id)),
    ),
    archivedSeries: actor.admin ? (state.meetings || []).filter(m => m.archived).map(m => ({ id: m.id, name: m.name, branch: m.branch, team: m.team, pastDates: new Set(state.sessions.filter(s => s.meetingId === m.id).map(s => s.date)).size })) : [],
    services: state.services.filter((s) => !s.archived && manager(actor, s.kind)),
    swaps: state.swaps.filter((s) => visible.has(s.sessionId) && (coordinator || s.from === actor.id || s.to === actor.id)),
    notifications: state.notifications.filter((n) => n.recipient === actor.id),
    auditRetentionDays: retentionDays(state),
    expiredAuditCount: actor.admin ? state.history.filter(entry => expiredAudit(state, entry)).length : 0,
    history: state.history.filter(
      h => !expiredAudit(state, h) && (actor.admin || (coordinator && h.sessionId && visible.has(h.sessionId))),
    ),
    actor,
  };
}
export async function handleVolunteers(request, store, adminActor = null) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/volunteers/, "") || "/";
  const reply = (value, status = 200, headers = {}) =>
    new Response(JSON.stringify(value), {
      status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        ...headers,
      },
    });
  const cookie = (value) =>
    `lpc_volunteer=${value}; HttpOnly; Path=/; Max-Age=${value ? 28800 : 0}${url.protocol === "https:" ? "; Secure; SameSite=None; Partitioned" : "; SameSite=Strict"}`;
  try {
    if (!["GET", "POST"].includes(request.method))
      return reply({ error: "Method not allowed" }, 405);
    if (
      request.method === "POST" &&
      (request.headers.get("origin") !== url.origin ||
        request.headers.get("sec-fetch-site") === "cross-site")
    )
      return reply({ error: "Invalid request origin" }, 403);
    let input = {};
    if (request.method === "POST") {
      const raw = await request.text();
      if (raw.length > 150000) fail("Request too large.", 413);
      try {
        input = JSON.parse(raw);
      } catch {
        fail("Invalid request.");
      }
    }
    let state = (await store.getState()) || emptyVolunteers();
    const token = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)lpc_volunteer=([^;]+)/)?.[1];
    const tokenKey = token ? await digest(token) : null;
    const session = tokenKey ? await store.getKey("session-" + tokenKey) : null;
    let actor =
      adminActor ||
      (session?.expires > Date.now() &&
        currentMember(state, session.memberId)?.authVersion ===
          session.authVersion &&
        currentMember(state, session.memberId));
    if (actor && !actor.admin)
      actor = { ...cleanMember(actor), name: actor.name };
    if (route === "/backup") {
      if (!actor?.admin) fail("Only the website administrator can export private planner data.", 403);
      if (request.method !== "GET") return reply({error:"Method not allowed"},405);
      if (request.headers.get("sec-fetch-site") === "cross-site") fail("Open backups from the website admin screen.",403);
      return reply({format:"lpc-private-planner",version:1,exportedAt:new Date().toISOString(),data:state},200,{
        "content-disposition":'attachment; filename="lpc-private-planner-backup.json"',
        "x-content-type-options":"nosniff", "x-robots-tag":"noindex, nofollow",
      });
    }
    if (route === "/account-options") return reply({ emailEnabled: !!store.emailReady, registrationEnabled: false });
    const emailAddress = value => {
      const email = String(value || "").trim().toLowerCase();
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email address.");
      return email;
    };
    const requireEmail = () => { if (!store.emailReady || !store.sendAccountMail) fail("Email account services are not available yet. Please contact the church administrator for help.", 503); };
    const writeAccountState = async () => { pruneAudit(state, { id: "account", name: "Account service" }); const expected = state.revision; state.revision++; await store.saveState(state, expected); };
    if (route === "/register" && request.method === "POST") {
      if (!actor?.admin) fail("Team access is invitation-only. Only a website administrator can invite an account.", 403);
      requireEmail();
      const email = emailAddress(input.email), fullName = text(input.name, 100);
      await limitRecovery(request, store, email, "registration");
      state.registrations = (state.registrations || []).filter(r => r.expires > Date.now());
      const known = state.members.some(m => m.emailVerifiedAt && m.email === email);
      const verified = state.registrations.some(r => r.email === email && r.verifiedAt);
      if (!known && !verified) {
        if (state.registrations.length >= 200) fail("Account requests are temporarily full. Please contact the church administrator.", 503);
        const token = hex(crypto.getRandomValues(new Uint8Array(32)));
        const record = { id: id(), name: fullName, email, tokenHash: await digest(token), expires: Date.now() + 86400000 };
        state.registrations = state.registrations.filter(r => r.email !== email); state.registrations.push(record);
        await writeAccountState();
        try { await store.sendAccountMail({ id: record.id, to: email, type: "verify", token }); }
        catch { fail("We could not send the email. Please try again later or contact the church administrator.", 503); }
      }
      return reply({ ok: true, message: "Invitation requested. The selected person receives a link to confirm their email and choose a password. After verification, approve their account and access in Members & Skills." });
    }
    if (route === "/verify-email" && request.method === "POST") {
      await limitRecovery(request, store, String(input.token || "").slice(0, 128), "verify");
      if (!validPassword(input.password)) fail("Use a password of 12–200 characters.");
      const hash = await digest(String(input.token || ""));
      const record = (state.registrations || []).find(r => r.tokenHash === hash && !r.verifiedAt && r.expires > Date.now());
      if (!record) fail("This link has expired or has already been used. Create an account again to receive a new link.");
      if (state.members.some(m => m.emailVerifiedAt && m.email === record.email)) fail("This account already exists. Use Sign in or Forgot password.");
      record.salt = id(); record.passwordHash = await passwordHash(input.password, record.salt);
      record.verifiedAt = new Date().toISOString(); record.expires = Date.now() + 30 * 86400000;
      delete record.tokenHash;
      await writeAccountState();
      return reply({ ok: true, message: "Email confirmed. Your church administrator will approve your account. We will email you when it is ready." });
    }
    if (route === "/forgot-password" && request.method === "POST") {
      requireEmail(); const email = emailAddress(input.email);
      await limitRecovery(request, store, email, "email-reset");
      const member = state.members.find(m => m.active && m.emailVerifiedAt && m.email === email);
      if (member) {
        const token = hex(crypto.getRandomValues(new Uint8Array(32)));
        member.emailResetHash = await digest(token); member.emailResetExpires = Date.now() + 1800000;
        await writeAccountState();
        try { await store.sendAccountMail({ id: id(), to: email, type: "reset", token }); }
        catch { /* Same response for known and unknown addresses. A retry generates a new link. */ }
      }
      return reply({ ok: true, message: "If there is an approved account for this email, a password reset link has been requested. Check your inbox and junk folder. If no email arrives, try again later or contact the church administrator." });
    }
    if (route === "/email-reset" && request.method === "POST") {
      await limitRecovery(request, store, String(input.token || "").slice(0, 128), "email-link-reset");
      if (!validPassword(input.password)) fail("Use a password of 12–200 characters.");
      const hash = await digest(String(input.token || ""));
      const member = state.members.find(m => m.active && m.emailVerifiedAt && m.emailResetHash === hash && m.emailResetExpires > Date.now());
      if (!member) fail("This link has expired or has already been used. Choose Forgot password to request another link.");
      member.salt = id(); member.passwordHash = await passwordHash(input.password, member.salt); member.authVersion = id();
      delete member.emailResetHash; delete member.emailResetExpires; delete member.recoveryHash; delete member.recoveryCreatedAt;
      audit(state, { id: member.id, name: member.name }, "Password reset by email", { memberId: member.id });
      notify(state, member.id, "Your password was reset using an email link. Contact your church administrator if this was not you.");
      await writeAccountState();
      return reply({ ok: true }, 200, { "set-cookie": cookie("") });
    }
    if (route === "/login" && request.method === "POST") {
      const key =
        "attempt-" +
        (await digest(
          request.headers.get("x-volunteer-client") ||
            request.headers.get("cf-connecting-ip") ||
            "unknown",
        ));
      const attempt = await store.getKey(key);
      if (attempt?.until > Date.now() && attempt.count >= 10)
        fail("Too many attempts. Try again in 15 minutes.", 429);
      const username = String(input.username || "")
        .trim()
        .toLowerCase();
      const m = state.members.find((m) => m.active && m.username === username);
      const computed = await passwordHash(
        String(input.password || ""),
        m?.salt || "invalid-user",
      );
      if (!m || computed !== m.passwordHash) {
        await store.putKey(key, {
          count: attempt?.until > Date.now() ? attempt.count + 1 : 1,
          until:
            attempt?.until > Date.now() ? attempt.until : Date.now() + 900000,
        });
        fail("Invalid username or password.", 401);
      }
      const next = id() + id();
      await store.putKey("session-" + (await digest(next)), {
        memberId: m.id,
        authVersion: m.authVersion,
        expires: Date.now() + 28800000,
      });
      await store.putKey(key, { count: 0, until: 0 });
      return reply({ ok: true }, 200, { "set-cookie": cookie(next) });
    }
    if (route === "/recover" && request.method === "POST") {
      const username = String(input.username || "").trim().toLowerCase().slice(0, 80);
      await limitRecovery(request, store, username, "reset");
      if (!validPassword(input.password)) fail("Use a password of 12–200 characters.");
      const m = state.members.find(m => m.active && m.username === username);
      const codeHash = await digest("recovery:" + (m?.id || "unknown") + ":" + normalRecovery(input.code));
      const salt = id();
      const nextHash = await passwordHash(input.password, salt);
      if (!m?.recoveryHash || codeHash !== m.recoveryHash) fail("Username or recovery code is incorrect, or the code has already been used. Ask your church administrator if you cannot recover access.", 400);
      m.salt = salt; m.passwordHash = nextHash; m.authVersion = id();
      delete m.recoveryHash; delete m.recoveryCreatedAt; delete m.emailResetHash; delete m.emailResetExpires;
      audit(state, { id: m.id, name: m.name }, "Password recovered", { memberId: m.id });
      notify(state, m.id, "Your password was reset using a recovery code. If this was not you, contact your church administrator immediately. Save a new recovery code from My account.");
      pruneAudit(state, { id: m.id, name: m.name });
      const expected = state.revision; state.revision++;
      await store.saveState(state, expected);
      return reply({ ok: true }, 200, { "set-cookie": cookie("") });
    }
    if (route === "/recovery-code" && request.method === "POST") {
      if (!actor || actor.admin) fail("Sign in with your volunteer account to create a recovery code.", 401);
      const m = currentMember(state, actor.id);
      await limitRecovery(request, store, m.username, "generate");
      if (await passwordHash(String(input.current || ""), m.salt) !== m.passwordHash) fail("Current password is incorrect.");
      if (input.revision !== state.revision) fail("Your account changed. Refresh and try again.", 409);
      const code = hex(crypto.getRandomValues(new Uint8Array(16))).toUpperCase().match(/.{8}/g).join("-");
      m.recoveryHash = await digest("recovery:" + m.id + ":" + normalRecovery(code));
      m.recoveryCreatedAt = new Date().toISOString();
      audit(state, actor, "Recovery code replaced", { memberId: m.id });
      pruneAudit(state, { id: m.id, name: m.name });
      const expected = state.revision; state.revision++;
      await store.saveState(state, expected);
      return reply({ code });
    }
    if (route === "/logout" && request.method === "POST") {
      if (tokenKey) await store.putKey("session-" + tokenKey, { expires: 0 });
      return reply({ ok: true }, 200, { "set-cookie": cookie("") });
    }
    if (route === "/session") return reply({ actor: actor || null, emailEnabled: !!store.emailReady, registrationEnabled: false });
    if (!actor) fail("Please sign in.", 401);
    if (route === "/audit-export" && request.method === "GET") {
      if (!actor.admin) fail("Only the website administrator can archive audit history.", 403);
      return reply({ format: "lpc-audit-archive-v1", exportedAt: new Date().toISOString(), revision: state.revision, retentionDays: retentionDays(state), volunteers: state.members.map(m => ({ id: m.id, name: m.name })), history: state.history });
    }
    if (route === "/" && request.method === "GET")
      return reply(view(state, actor));
    if (route !== "/action" || request.method !== "POST")
      fail("Not found.", 404);
    if (input.revision !== state.revision)
      fail("Someone updated this schedule. Reload before trying again.", 409);
    const action = input.action;
    if (!state.roles.includes("Branch prayer leader")) state.roles.push("Branch prayer leader");
    let accountApprovedEmail = null;
    let quickVolunteerId = null;
    if (action === "link-admin-volunteer") {
      if (!actor.admin) fail("Only the website administrator can link their volunteer profile.", 403);
      const memberId = text(input.memberId, 100);
      if (memberId && !state.members.some(m => m.id === memberId && m.active)) fail("Choose an active volunteer profile.");
      const login = String(actor.name || "").trim().toLowerCase();
      const matches = state.members.filter(m => m.active && [m.username, m.email].some(value => value && String(value).trim().toLowerCase() === login));
      if (matches.length && (matches.length !== 1 || matches[0].id !== memberId)) fail("Your login is already mapped to a volunteer. Use View someone else’s week to see other rotas.");
      state.adminVolunteerLinks = { ...(state.adminVolunteerLinks || {}), [login]: memberId || null };
      audit(state, actor, "Administrator linked own volunteer profile", { memberId: memberId || null });
    } else if (action === "quick-volunteer") {
      const session = sessionOf(state, input.sessionId);
      if (session.cancelled || !manages(actor, session)) fail("Only the matching scheduler can add a volunteer while allocating this meeting.", 403);
      const role = text(input.role, 80);
      const requestedRoles = Array.isArray(input.roles) ? [...new Set(input.roles)] : [role];
      const allowedRole = value => session.slots.some(slot => slot.role === value) || (session.kind === "ministry" && value === "Branch prayer leader");
      if (!requestedRoles.includes(role) || requestedRoles.length > 30 || requestedRoles.some(value => !allowedRole(value))) fail("Choose serving roles in this meeting.");
      if (input.qualified !== true) fail("Confirm that this person can carry out the selected role.");
      let member = input.memberId ? state.members.find(m => m.id === input.memberId) : null;
      if (input.memberId && !member?.active) fail("Choose an active volunteer. Inactive people must be reviewed by the website administrator.");
      if (member) {
        if (!actor.admin && (!participates(member, session) || (session.kind !== "service" && requestedRoles.some(role => !member.skills.includes(role))))) fail("Only the website administrator can extend an existing volunteer’s branches, service teams or pastoral capabilities.", 403);
        {
          member.skills = [...new Set([...member.skills, ...requestedRoles])];
          member.teams = [...new Set([...member.teams, session.team])];
          member.branches = [...new Set([...member.branches, session.branch])];
          audit(state, actor, "Volunteer eligibility updated during allocation", { memberId: member.id, roles: requestedRoles, branch: session.branch, team: session.team });
        }
      } else {
        const name = text(input.name, 100);
        const normal = value => value.trim().replace(/\s+/g, " ").toLowerCase();
        if (state.members.some(m => normal(m.name) === normal(name))) fail("That name is already on the volunteer list. Choose the existing person above. If they are not eligible or are inactive, ask the website administrator to review their details.");
        member = { id: id(), name, username: "", active: true, skills: requestedRoles, teams: [session.team], branches: [session.branch], manage: [], availability: {}, authVersion: id() };
        state.members.push(member);
        audit(state, actor, "Volunteer added during allocation", { memberId: member.id, roles: requestedRoles, branch: session.branch, team: session.team });
        notify(state, "admin", `${actor.name} added ${name} for ${role} at ${session.branch} (${session.team}). This is a volunteer profile without login or admin access.`, session.id);
      }
      quickVolunteerId = member.id;
    } else if (action === "approve-account" || action === "reject-account") {
      if (!actor.admin) fail("Only the website administrator can approve accounts.", 403);
      const record = (state.registrations || []).find(r => r.id === input.registrationId && r.verifiedAt && r.expires > Date.now());
      if (!record) fail("This request is no longer waiting for approval. Refresh the list.", 409);
      if (action === "approve-account") {
        const existing = input.memberId ? state.members.find(m => m.id === input.memberId) : null;
        if (state.members.some(m => m.id !== existing?.id && (m.email === record.email || m.username === record.email))) fail("This email already belongs to an account. Link the correct existing volunteer instead.");
        if (input.memberId && !existing) fail("Choose an existing volunteer or create a new volunteer.");
        if (existing?.emailVerifiedAt) fail("This volunteer already has a verified account. Ask them to sign in or reset their password.");
        if (!existing && (!Array.isArray(input.skills) || input.skills.some(role => !state.roles.includes(role)) || !Array.isArray(input.teams) || !Array.isArray(input.branches) || !Array.isArray(input.manage) || input.manage.some(k => !["ministry", "service"].includes(k)))) fail("Choose valid volunteer roles, teams, branches and scheduling access.");
        const member = { ...(existing || {}), id: existing?.id || id(), name: existing?.name || record.name, username: record.email, email: record.email, emailVerifiedAt: record.verifiedAt, salt: record.salt, passwordHash: record.passwordHash, authVersion: id(), skills: existing?.skills || [...new Set(input.skills)], teams: existing?.teams || [...new Set(input.teams.map(t => text(t, 100)))], branches: existing?.branches || [...new Set(input.branches.map(t => text(t, 100)))], manage: existing?.manage || [...new Set(input.manage)], active: true, availability: existing?.availability || {} };
        delete member.recoveryHash; delete member.recoveryCreatedAt; delete member.emailResetHash; delete member.emailResetExpires;
        if (existing) state.members[state.members.indexOf(existing)] = member; else state.members.push(member);
        audit(state, actor, "Volunteer account approved", { memberId: member.id });
        accountApprovedEmail = record.email;
      } else audit(state, actor, "Account request declined", {});
      state.registrations = state.registrations.filter(r => r.id !== record.id);
    } else if (action === "audit-settings" || action === "audit-cleanup") {
      if (!actor.admin) fail("Only the website administrator can manage audit retention.", 403);
      if (input.confirm !== true) fail("Confirm that expired audit entries can be permanently deleted.");
      if (action === "audit-settings") {
        if (!Number.isInteger(input.days) || input.days < 1 || input.days > 3650) fail("Choose between 1 and 3650 retention days.");
        const previousDays = retentionDays(state);
        state.auditRetentionDays = input.days;
        audit(state, actor, "Audit retention updated", { previousDays, retentionDays: input.days });
      }
    } else if(action==='members-bulk'){
      if(!actor.admin)fail('Only the administrator can manage volunteers.',403);
      if(!Array.isArray(input.members)||!input.members.length||input.members.length>1000)fail('Choose the volunteers to update.');
      const seen=new Set();
      const patches=input.members.map(m=>{
        const previous=state.members.find(x=>x.id===m.id);if(!previous||seen.has(m.id))fail('The volunteer list changed. Reload before saving.');seen.add(m.id);
        if(!Array.isArray(m.skills)||m.skills.some(r=>!state.roles.includes(r))||!Array.isArray(m.teams)||!Array.isArray(m.branches)||!Array.isArray(m.manage)||m.manage.some(k=>!['ministry','service'].includes(k))||typeof m.active!=='boolean')fail('Choose valid roles, teams and scheduling access.');
        return {previous,next:{...previous,skills:[...new Set(m.skills)],teams:[...new Set(m.teams.map(t=>text(t,100)))],branches:[...new Set(m.branches.map(t=>text(t,100)))],manage:[...new Set(m.manage)],active:m.active,authVersion:previous.active!==m.active?id():previous.authVersion}};
      });
      for(const {previous,next}of patches){state.members[state.members.indexOf(previous)]=next;audit(state,actor,'Volunteer details updated',{memberId:next.id});}
    } else if (action === "member") {
      if (!actor.admin)
        fail("Only the administrator can manage volunteer accounts.", 403);
      const previous = state.members.find((m) => m.id === input.member.id);
      const m = input.member;
      const name = text(m.name, 100),
        username = String(m.username || "").trim().toLowerCase();
      if (username.length > 80 || (username && !/^[a-z0-9._@+-]+$/.test(username)) || (!username && (previous?.passwordHash || m.password)))
        fail(
          "Use letters, numbers, dots or an email address for the username.",
        );
      if (
        state.members.some(
          (x) => x.id !== previous?.id && username && x.username === username,
        )
      )
        fail("Username is already in use.");
      if (
        !Array.isArray(m.skills) ||
        m.skills.some((r) => !state.roles.includes(r)) ||
        !Array.isArray(m.teams) ||
        !Array.isArray(m.branches) ||
        !Array.isArray(m.manage) ||
        m.manage.some((k) => !["ministry", "service"].includes(k))
      )
        fail("Choose valid roles and teams.");
      const member = {
        id: previous?.id || id(),
        name,
        username,
        skills: [...new Set(m.skills)],
        teams: m.teams.map((t) => text(t, 100)),
        branches: m.branches.map((t) => text(t, 100)),
        manage: m.manage,
        active: m.active !== false,
        availability: previous?.availability || {},
        salt: previous?.salt,
        passwordHash: previous?.passwordHash,
        authVersion: previous?.authVersion || id(),
        email: previous?.email,
        emailVerifiedAt: previous?.emailVerifiedAt,
        emailResetHash: previous?.emailResetHash,
        emailResetExpires: previous?.emailResetExpires,
        recoveryHash: previous?.recoveryHash,
        recoveryCreatedAt: previous?.recoveryCreatedAt,
      };
      if (previous && previous.active !== member.active)
        member.authVersion = id();
      if (m.password) {
        if (
          typeof m.password !== "string" ||
          m.password.length < 12 ||
          m.password.length > 200
        )
          fail("Use a password of 12–200 characters.");
        member.authVersion = id();
        member.salt = id();
        member.passwordHash = await passwordHash(m.password, member.salt);
        delete member.recoveryHash; delete member.recoveryCreatedAt; delete member.emailResetHash; delete member.emailResetExpires;
      }
      if (username && !member.passwordHash)
        fail("Set an initial password of at least 12 characters, or leave the username blank for a volunteer profile without login access.");
      if (previous) state.members[state.members.indexOf(previous)] = member;
      else state.members.push(member);
      audit(state, actor, "Volunteer details updated", { memberId: member.id });
    } else if (action === "password") {
      const m = currentMember(state, actor.id);
      if (!m) fail("Use volunteer sign-in to change your password.", 403);
      if (
        (await passwordHash(String(input.current || ""), m.salt)) !==
        m.passwordHash
      )
        fail("Current password is incorrect.");
      if (
        typeof input.password !== "string" ||
        input.password.length < 12 ||
        input.password.length > 200
      )
        fail("Use a password of 12–200 characters.");
      m.salt = id();
      m.authVersion = id();
      m.passwordHash = await passwordHash(input.password, m.salt);
      delete m.recoveryHash; delete m.recoveryCreatedAt; delete m.emailResetHash; delete m.emailResetExpires;
      audit(state, actor, "Password changed", {});
    } else if (action === "roles") {
      if (!actor.admin) fail("Only the administrator can manage roles.", 403);
      if (
        !Array.isArray(input.roles) ||
        !input.roles.length ||
        input.roles.length > 40
      )
        fail("Enter between 1 and 40 roles.");
      const next = [...new Set(input.roles.map((r) => text(r, 80)))];
      if (
        state.roles.some(
          (r) =>
            !next.includes(r) &&
            (state.members.some((m) => m.skills.includes(r)) ||
              state.services.some((s) => s.roles.some((x) => x.role === r)) ||
              state.sessions.some((s) => s.slots.some((x) => x.role === r))),
        )
      )
        fail("A role in use cannot be removed.");
      state.roles = next;
      audit(state, actor, "Roles updated", {});
    } else if (action === "upgrade-planner") {
      if (
        !actor.admin &&
        !manager(actor, "ministry") &&
        !manager(actor, "service")
      )
        fail("Only a scheduler can prepare the shared planner.", 403);
      upgradePlanner(state);
      audit(state, actor, "Shared weekly planner prepared", {});
    } else if (["delete-meeting-series", "cleanse-meeting-series"].includes(action)) {
      const cleanse = action === "cleanse-meeting-series";
      if (cleanse && !actor.admin) fail("Only the website administrator can permanently cleanse past test data.", 403);
      if (!meetingManager(actor)) fail("Only the church administrator or pastoral admin can delete a meeting series.", 403);
      if (input.confirm !== true) fail("Confirm deletion of the entire meeting series.");
      const meeting = (state.meetings || []).find(m => m.id === input.meetingId);
      if (!meeting || (!cleanse && meeting.archived)) fail("Meeting series not found.", 404);
      if (cleanse && !meeting.archived) fail("End the series before cleansing its past data.");
      if (cleanse && input.confirmTestData !== true) fail("Explicitly confirm test-data cleansing.");
      const cleansingReason = cleanse ? text(input.reason, 1000) : "";
      const services = new Set(state.services.filter(s => s.meetingId === meeting.id).map(s => s.id));
      const removed = state.sessions.filter(s => (s.meetingId === meeting.id || services.has(s.serviceId)) && (cleanse || upcoming(s)));
      const sessionIds = new Set(removed.map(s => s.id));
      const recipients = new Set(["admin"]);
      for (const session of removed) {
        if (session.leadId) recipients.add(session.leadId);
        if (session.emergencyCover?.memberId) recipients.add(session.emergencyCover.memberId);
        for (const slot of session.slots) for (const person of [slot.main, slot.backup]) if (person) recipients.add(person);
      }
      for (const member of state.members) {
        if (member.active && member.manage?.length) recipients.add(member.id);
        for (const sessionId of sessionIds) delete member.availability?.[sessionId];
      }
      state.swaps = state.swaps.filter(swap => {
        if (!sessionIds.has(swap.sessionId) && !sessionIds.has(swap.exchangeSessionId)) return true;
        recipients.add(swap.from); recipients.add(swap.to);
        return false;
      });
      if (cleanse) {
        state.meetings = state.meetings.filter(m => m.id !== meeting.id);
        state.services = state.services.filter(s => !services.has(s.id));
        state.history = state.history.filter(h => h.meetingId !== meeting.id && !services.has(h.serviceId) && !sessionIds.has(h.sessionId) && !(h.removedSessionIds || []).some(id => sessionIds.has(id)));
      } else {
        meeting.archived = true; meeting.endedAt = new Date().toISOString();
        for (const service of state.services.filter(s => services.has(s.id))) service.archived = true;
      }
      state.sessions = state.sessions.filter(s => !sessionIds.has(s.id));
      state.notifications = state.notifications.filter(n => !sessionIds.has(n.sessionId));
      for (const recipient of recipients) notify(state, recipient, `${meeting.name} (${meeting.branch}, ${meeting.team}): ${cleanse ? "past test data was permanently removed" : "all upcoming dates were removed; past records are preserved"} by ${actor.name}.`, "");
      audit(state, actor, cleanse ? "Past series data cleansed" : "Upcoming meeting series deleted", { meetingId: meeting.id, meetingName: meeting.name, ...(cleanse ? { reason: cleansingReason } : {}), removedSessionIds: [...sessionIds] });
    } else if (action === "meeting") {
      if (!meetingManager(actor))
        fail(
          "The church administrator or senior pastor maintains church meetings.",
          403,
        );
      upgradePlanner(state);
      const m = input.meeting || {},
        previous = state.meetings.find((x) => x.id === m.id);
      if (previous?.archived) fail("This series has ended. Create a new meeting instead.");
      const recurrence = m.recurrence || previous?.recurrence || "weekly";
      if (!["weekly", "once", "daily"].includes(recurrence)) fail("Choose a weekly meeting, one-off meeting or daily series.");
      const bounded = recurrence !== "weekly";
      const startDate = m.startDate ?? previous?.startDate;
      const endDate = recurrence === "once" ? startDate : m.endDate ?? previous?.endDate;
      if (bounded && (!validDate(startDate) || !validDate(endDate) || endDate < startDate || (Date.parse(endDate) - Date.parse(startDate)) / 86400000 >= 90)) fail("Choose valid dates for a meeting or daily series of 1 to 90 days.");
      if (previous && ((previous.recurrence || "weekly") !== recurrence || (bounded && (startDate !== previous.startDate || endDate !== previous.endDate)))) fail("Keep the existing meeting pattern and date range. Change an individual date from its meeting card, or create a new series.");
      const meeting = {
        id: previous?.id || id(),
        name: text(m.name, 100),
        branch: text(m.branch, 100),
        team: text(m.team, 100),
        recurrence,
        ...(bounded ? { startDate, endDate } : {}),
        day: bounded ? new Date(startDate + "T12:00:00Z").getUTCDay() : Number(m.day),
        time: text(m.time, 5),
        duration: Number(m.duration),
      };
      if (
        !Number.isInteger(meeting.day) ||
        meeting.day < 0 ||
        meeting.day > 6 ||
        !validTime(meeting.time) ||
        !Number.isInteger(meeting.duration) ||
        meeting.duration < 15 ||
        meeting.duration > 720
      )
        fail("Choose a valid day, time and duration.");
      if (previous) state.meetings[state.meetings.indexOf(previous)] = meeting;
      else state.meetings.push(meeting);
      for (const kind of ["ministry", "service"]) {
        let service = state.services.find(
          (x) => x.meetingId === meeting.id && x.kind === kind,
        );
        if (service) Object.assign(service, meeting, { id: service.id });
        else {
          const leadId =
            kind === "ministry" ? m.pastorLeadId || "" : m.choirLeadId || "";
          validateLead(state, kind, leadId, meeting);
          service = {
            ...meeting,
            id: id(),
            meetingId: meeting.id,
            kind,
            leadId,
            roles:
              kind === "ministry"
                ? [{ role: "Ministry volunteer", count: 1 }]
                : [
                    { role: "Lead singer", count: 1 },
                    { role: "Keyboard player", count: 1 },
                    { role: "Choir singer", count: 2 },
                    { role: "Sound operator", count: 1 },
                    { role: "Camera operator", count: 1 },
                    { role: "Screen operator", count: 1 },
                  ],
          };
          state.services.push(service);
        }
        if (bounded && !previous) {
          const days = (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1;
          createOccurrences(state, service, startDate, Math.ceil(days / 7));
        } else if (input.start)
          createOccurrences(state, service, input.start, Number(input.weeks));
      }
      if (previous) syncUpcomingSeries(state, meeting, actor);
      audit(state, actor, "Church meeting settings updated", {
        meetingId: meeting.id,
      });
    } else if (action === "ensure-week") {
      if (!validDate(input.start)) fail("Choose a valid week.");
      const before = state.sessions.length;
      for (const meeting of (state.meetings || []).filter(m => !m.archived)) {
        for (const service of state.services.filter(s => s.meetingId === meeting.id && !s.archived)) {
          createOccurrences(state, service, input.start, 1, true);
        }
      }
      if (state.sessions.length === before) return reply(view(state, actor));
      audit(state, actor, "Recurring calendar week prepared automatically", { start: input.start, createdDates: state.sessions.length - before });
    } else if (action === "generate-week") {
      if (
        !actor.admin &&
        !manager(actor, "ministry") &&
        !manager(actor, "service")
      )
        fail("Only a scheduler can prepare meeting dates.", 403);
      if (!validDate(input.start)) fail("Choose a valid week.");
      const meetings = (state.meetings || []).filter(
        (m) => !m.archived &&
          (!input.branch || m.branch === input.branch) &&
          (!input.team || m.team === input.team),
      );
      if (!meetings.length) fail("Add a regular church meeting first.");
      for (const meeting of meetings)
        for (const service of state.services.filter(
          (s) => s.meetingId === meeting.id,
        ))
          createOccurrences(state, service, input.start, 1);
      audit(state, actor, "A week of shared meeting dates prepared", {});
    } else if (action === "generate-meeting") {
      if (
        !actor.admin &&
        !manager(actor, "ministry") &&
        !manager(actor, "service")
      )
        fail("Only a scheduler can create meeting dates.", 403);
      const linked = state.services.filter(
        (s) => s.meetingId === input.meetingId,
      );
      if (!linked.length) fail("Meeting not found.");
      for (const service of linked)
        createOccurrences(state, service, input.start, Number(input.weeks));
      audit(state, actor, "Meeting dates created for both planners", {
        meetingId: input.meetingId,
      });
    } else if (action === "team-settings") {
      const service =
        state.services.find((s) => s.id === input.serviceId) ||
        fail("Team settings not found.");
      if (!manager(actor, service.kind))
        fail("Only this team scheduler can change its setup.", 403);
      validateRoles(state, input.roles);
      if (
        input.roles.some((r) =>
          service.kind === "ministry"
            ? r.role !== "Ministry volunteer"
            : r.role === "Ministry volunteer",
        )
      )
        fail("Pastoral and choir roles must stay in their own planner.");
      validateLead(state, service.kind, input.leadId, service);
      if (input.applyDrafts) {
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date());
        const part = (k) => parts.find((p) => p.type === k).value;
        const nowDate = `${part("year")}-${part("month")}-${part("day")}`;
        for (const session of state.sessions.filter(
          (s) =>
            s.serviceId === service.id &&
            s.date >= nowDate &&
            s.status === "draft" &&
            !s.cancelled,
        )) {
          pendingGuard(state, session.id);
          const before = structuredClone(session),
            used = new Set();
          const next = input.roles.flatMap((r) => {
            const existing = session.slots
              .filter((x) => x.role === r.role)
              .sort(
                (a, b) =>
                  Number(!!(b.main || b.backup)) -
                  Number(!!(a.main || a.backup)),
              );
            return Array.from({ length: r.count }, () => {
              const old = existing.find((x) => !used.has(x.id));
              if (old) {
                used.add(old.id);
                return old;
              }
              return { id: id(), role: r.role, main: "", backup: "" };
            });
          });
          if (
            session.slots.some((x) => !used.has(x.id) && (x.main || x.backup))
          )
            fail(
              "Clear assigned people from a role before removing that role or reducing its places.",
            );
          session.slots = next;
          session.leadId = input.leadId || "";
          updateStamp(session, actor);
          audit(state, actor, "Draft team setup updated", {
            sessionId: session.id,
            before,
            after: structuredClone(session),
          });
          notifySchedulers(
            state,
            session,
            `${actor.name} updated the team setup for ${session.name} on ${session.date}.`,
          );
        }
      }
      service.roles = input.roles;
      service.leadId = input.leadId || "";
      audit(state, actor, "Team requirements updated", {
        serviceId: service.id,
      });
    } else if (action === "meeting-occurrence") {
      if (!meetingManager(actor))
        fail(
          "The church administrator or senior pastor changes meeting dates.",
          403,
        );
      const original = sessionOf(state, input.sessionId);
      if (!original.occurrenceId)
        fail("This meeting must first be added to the shared planner.");
      const linked = state.sessions.filter(
        (s) => s.occurrenceId === original.occurrenceId,
      );
      if (!validDate(input.date) || !validTime(input.time))
        fail("Choose a valid date and time.");
      const collision = state.sessions.some(
        (s) =>
          !linked.includes(s) &&
          s.meetingId === original.meetingId &&
          s.date === input.date,
      );
      if (collision) fail("This meeting already has a service on that date.");
      for (const session of linked) pendingGuard(state, session.id);
      const comment = text(input.comment, 1000);
      const changes = linked.map((session) => ({
        session,
        before: structuredClone(session),
      }));
      for (const { session } of changes) {
        if (session.date !== input.date || session.time !== input.time)
          for (const member of state.members)
            delete member.availability?.[session.id];
        session.scheduledDate ||= session.date;
        session.date = input.date;
        session.time = input.time;
        session.cancelled = !!input.cancelled;
        session.status = "draft";
      }
      for (const { session, before } of changes) {
        // Restore and date changes save drafts; validate assignments on confirmation.
        updateStamp(session, actor);
        audit(state, actor, "Shared meeting changed", {
          sessionId: session.id,
          before,
          after: structuredClone(session),
          comment,
        });
        notifySchedulers(
          state,
          session,
          `${actor.name} changed ${session.name} on ${session.date}: ${comment}`,
        );
        for (const memberId of new Set(
          [session.emergencyCover?.memberId, ...session.slots.flatMap((x) => [x.main, x.backup])].filter(Boolean),
        ))
          notify(state, memberId, `${session.name}: ${comment}`, session.id);
      }
    } else if (action === "service") {
      const s = input.service;
      if (!["ministry", "service"].includes(s.kind) || !manager(actor, s.kind))
        fail("You cannot manage these service settings.", 403);
      const previous = state.services.find((x) => x.id === s.id);
      if (previous && !manager(actor, previous.kind))
        fail("Access denied.", 403);
      if (previous?.meetingId)
        fail("Edit shared meeting details or team requirements instead.");
      const service = {
        id: previous?.id || id(),
        name: text(s.name, 100),
        kind: s.kind,
        branch: text(s.branch, 100),
        team: text(s.team, 100),
        day: Number(s.day),
        time: text(s.time, 5),
        duration: Number(s.duration),
        leadId: s.leadId || "",
        roles: s.roles,
      };
      if (
        !Number.isInteger(service.day) ||
        service.day < 0 ||
        service.day > 6 ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(service.time) ||
        !Number.isInteger(service.duration) ||
        service.duration < 15 ||
        service.duration > 720
      )
        fail("Choose valid service times.");
      validateLead(state, service.kind, service.leadId, service);
      if (
        !Array.isArray(service.roles) ||
        !service.roles.length ||
        service.roles.length > 30 ||
        service.roles.some(
          (r) =>
            !state.roles.includes(r.role) ||
            (service.kind === "ministry" ? r.role !== "Ministry volunteer" : r.role === "Ministry volunteer") ||
            !Number.isInteger(r.count) ||
            r.count < 1 ||
            r.count > 20,
        ) ||
        service.roles.reduce((n, r) => n + r.count, 0) > 100
      )
        fail("Choose required roles and numbers.");
      if (previous) state.services[state.services.indexOf(previous)] = service;
      else state.services.push(service);
      if (input.start)
        createOccurrences(state, service, input.start, Number(input.weeks));
      audit(state, actor, "Recurring service settings updated", {
        serviceId: service.id,
      });
    } else if (action === "generate") {
      const s =
        state.services.find((s) => s.id === input.serviceId) ||
        fail("Service not found.");
      if (!manager(actor, s.kind)) fail("Access denied.", 403);
      if (s.meetingId) {
        for (const linked of state.services.filter(
          (x) => x.meetingId === s.meetingId,
        ))
          createOccurrences(state, linked, input.start, Number(input.weeks));
      } else createOccurrences(state, s, input.start, Number(input.weeks));
      audit(state, actor, "Upcoming services created", { serviceId: s.id });
    } else if (action === "availability") {
      const s = sessionOf(state, input.sessionId);
      if (!manager(actor, s.kind) && !sessionsForActor(state, actor).some(visible => visible.id === s.id)) fail("You can only update availability for your own meetings.", 403);
      if (
        !["available", "unavailable", "unsure"].includes(input.value) ||
        !currentMember(state, actor.id) ||
        !actor.branches.includes(s.branch) ||
        !actor.teams.includes(s.team)
      )
        fail("Choose a valid service and availability.");
      const m = currentMember(state, actor.id);
      const previousAvailability = m.availability[s.id] || "unsure";
      const hasDuty = s.emergencyCover?.memberId === actor.id || s.slots.some(x => x.main === actor.id || x.backup === actor.id);
      m.availability[s.id] = input.value;
      if (previousAvailability !== input.value && input.value === "available" && (hasDuty || s.leadId === actor.id)) {
        notifySchedulers(state, s, `${actor.name} confirmed they are available to serve at ${s.name} on ${s.date}.`);
      }
      if (
        previousAvailability !== input.value && input.value === "unavailable" &&
        (s.emergencyCover?.memberId === actor.id || s.slots.some((x) => x.main === actor.id || x.backup === actor.id))
      ) {
        s.status = "draft";
        updateStamp(s, actor);
        notifySchedulers(
          state,
          s,
          `${actor.name} is now unavailable for ${s.name} on ${s.date}. Cover is needed.`,
        );
      }
      audit(state, actor, "Availability updated", {
        sessionId: s.id,
        value: input.value,
      });
    } else if (action === "allocation") {
      const s = sessionOf(state, input.sessionId);
      if (!manages(actor, s))
        fail("Only an administrator with the matching Scheduling access can edit it.", 403);
      pendingGuard(state, s.id);
      const before = structuredClone(s);
      if (s.cancelled) fail("This service is cancelled.");
      if (
        !Array.isArray(input.slots) ||
        input.slots.length !== s.slots.length ||
        !["draft", "confirmed"].includes(input.status)
      )
        fail("Invalid allocation.");
      const next = s.slots.map((slot) => {
        const x =
          input.slots.find((x) => x.id === slot.id) || fail("Invalid role.");
        if (typeof x.main !== "string" || typeof x.backup !== "string")
          fail("Invalid volunteer.");
        validateSelection(state, s, slot, x.main);
        validateSelection(state, s, slot, x.backup, [], "backup");
        if (x.main && x.main === x.backup)
          fail("Main and backup must be different people.");
        return { ...slot, main: x.main, backup: x.backup };
      });
      const assigned = next.flatMap((x) => [x.main, x.backup]).filter(Boolean);
      const emergency = s.kind === "ministry" ? (Object.hasOwn(input, "emergencyCover") ? input.emergencyCover : s.emergencyCover) : null;
      if (s.kind !== "ministry" && input.emergencyCover?.memberId) fail("Only pastoral scheduling can record emergency pastor cover.", 403);
      if (emergency && !emergency.memberId) fail("Choose the branch prayer leader covering the pastor.");
      if (emergency?.memberId) {
        if (next.some(slot => slot.role === "Ministry volunteer" && slot.main)) fail("Choose a pastor or emergency prayer-leader cover, rather than both.");
        if (assigned.includes(emergency.memberId)) fail("The emergency leader cannot also be assigned as reserve in this meeting.");
        const reason = String(emergency.reason || "").trim();
        if (reason.length > 1000) fail("Reason is too long.");
        validateSelection(state, s, { role: "Branch prayer leader" }, emergency.memberId);
        s.emergencyCover = { memberId: emergency.memberId, reason };
      } else if (s.kind === "ministry") delete s.emergencyCover;
      if (Object.hasOwn(input, "leadId")) {
        if (!manager(actor, s.kind))
          fail("Only the scheduler can change the meeting lead.", 403);
        validateLead(state, s.kind, input.leadId, s);
        s.leadId = input.leadId || "";
      }
      s.slots = next;
      s.status = input.status;
      updateStamp(s, actor);
      const comment = String(input.comment || "").trim();
      if (comment.length > 1000) fail("Comment is too long.");
      audit(state, actor, "Allocation updated", {
        sessionId: s.id,
        before,
        after: structuredClone(s),
        comment,
      });
      notifySchedulers(
        state,
        s,
        `${actor.name} updated ${s.name} on ${s.date}${comment ? ": " + comment : ""}`,
      );
      for (const memberId of new Set(
        [...before.slots, ...next, { main: before.emergencyCover?.memberId }, { main: s.emergencyCover?.memberId }]
          .flatMap((x) => [x.main, x.backup])
          .filter(Boolean),
      ))
        notify(
          state,
          memberId,
          `Your duty list for ${s.name} on ${s.date} was updated by ${actor.name}.`,
          s.id,
        );
    } else if (action === "session") {
      const s = sessionOf(state, input.sessionId);
      if (!manages(actor, s)) fail("Access denied.", 403);
      if (s.meetingId)
        fail(
          "Use the shared church meeting controls to change its date or time.",
        );
      pendingGuard(state, s.id);
      const before = structuredClone(s);
      if (
        !validDate(input.date) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)
      )
        fail("Choose a valid date, time and lead.");
      validateLead(state, s.kind, input.leadId, s);
      s.date = input.date;
      s.time = input.time;
      s.leadId = input.leadId || "";
      s.cancelled = !!input.cancelled;
      s.status = "draft";
      if (!s.cancelled)
        for (const slot of s.slots) {
          validateSelection(state, s, slot, slot.main);
          validateSelection(state, s, slot, slot.backup, [], "backup");
        }
      updateStamp(s, actor);
      audit(state, actor, "Service occurrence updated", {
        sessionId: s.id,
        before,
        after: structuredClone(s),
        comment: String(input.comment || "").slice(0, 1000),
      });
      notifySchedulers(
        state,
        s,
        `${actor.name} changed ${s.name} on ${s.date}.`,
      );
      for (const memberId of new Set(
        [s.emergencyCover?.memberId, ...s.slots.flatMap((x) => [x.main, x.backup])].filter(Boolean),
      ))
        notify(
          state,
          memberId,
          `${s.name} has been changed${s.cancelled ? " or cancelled" : ""}. Please check your duty list.`,
          s.id,
        );
    } else if (action === "swap") {
      const s = sessionOf(state, input.sessionId),
        slot = s.slots.find((x) => x.id === input.slotId);
      if (
        !slot ||
        s.cancelled ||
        !["main", "backup"].includes(input.position) ||
        slot[input.position] !== actor.id
      )
        fail("You can only arrange a swap for your own allocation.", 403);
      pendingGuard(state, s.id);
      const target = text(input.targetId);
      if (target === actor.id) fail("Choose another volunteer.");
      validateSelection(
        state,
        s,
        slot,
        target,
        input.exchangeSessionId ? releasedPrimaryExclusions(state, input.exchangeSessionId, input.exchangeSlotId, input.exchangePosition, target) : [],
        input.position,
      );
      if (slot[input.position === "main" ? "backup" : "main"] === target)
        fail("Main and backup for the same role must be different people.");
      let exchange = null;
      if (input.exchangeSessionId) {
        const other = sessionOf(state, input.exchangeSessionId);
        pendingGuard(state, other.id);
        const otherSlot = other.slots.find(
          (x) => x.id === input.exchangeSlotId,
        );
        if (
          other.kind !== s.kind ||
          other.cancelled ||
          !otherSlot ||
          !["main", "backup"].includes(input.exchangePosition) ||
          otherSlot[input.exchangePosition] !== target ||
          other.id === s.id
        )
          fail("Choose a valid allocation to exchange.");
        validateSelection(state, other, otherSlot, actor.id, releasedPrimaryExclusions(state, s.id, slot.id, input.position, actor.id), input.exchangePosition);
        if (
          otherSlot[input.exchangePosition === "main" ? "backup" : "main"] === actor.id
        )
          fail("Main and backup for the same role must be different people.");
        exchange = {
          exchangeSessionId: other.id,
          exchangeSlotId: otherSlot.id,
          exchangePosition: input.exchangePosition,
        };
      }
      const comment = text(input.comment, 1000);
      const swap = {
        id: id(),
        sessionId: s.id,
        slotId: slot.id,
        position: input.position,
        from: actor.id,
        to: target,
        status: "pending",
        comment,
        createdAt: new Date().toISOString(),
        ...exchange,
      };
      state.swaps.push(swap);
      notify(
        state,
        target,
        `${actor.name} requested ${exchange ? "a duty exchange" : "cover"} for ${s.name} on ${s.date}: ${comment}`,
        s.id,
      );
      audit(state, actor, "Swap requested", {
        sessionId: s.id,
        swapId: swap.id,
        comment,
      });
    } else if (action === "swap-response") {
      const swap =
        state.swaps.find((x) => x.id === input.swapId) ||
        fail("Swap not found.");
      if (swap.status !== "pending")
        fail("This swap is already resolved.", 409);
      const s = sessionOf(state, swap.sessionId);
      if (input.response === "cancel") {
        if (actor.id !== swap.from && !manages(actor, s))
          fail("Access denied.", 403);
        swap.status = "cancelled";
      } else {
        if (actor.id !== swap.to)
          fail("Only the requested volunteer can accept or decline.", 403);
        if (!["accept", "decline"].includes(input.response))
          fail("Choose accept or decline.");
        swap.status = input.response === "accept" ? "accepted" : "declined";
        if (swap.status === "accepted") {
          const slot = s.slots.find((x) => x.id === swap.slotId);
          if (
            s.cancelled ||
            slot?.[swap.position] !== swap.from ||
            !currentMember(state, swap.from)
          )
            fail("The original allocation has changed.", 409);
          validateSelection(
            state,
            s,
            slot,
            swap.to,
            swap.exchangeSessionId ? releasedPrimaryExclusions(state, swap.exchangeSessionId, swap.exchangeSlotId, swap.exchangePosition, swap.to) : [],
            swap.position,
          );
          if (slot[swap.position === "main" ? "backup" : "main"] === swap.to)
            fail("Main and backup for the same role must be different people.");
          const before = structuredClone(s);
          let other, otherSlot, otherBefore;
          if (swap.exchangeSessionId) {
            other = sessionOf(state, swap.exchangeSessionId);
            otherSlot = other.slots.find((x) => x.id === swap.exchangeSlotId);
            if (
              other.cancelled ||
              otherSlot?.[swap.exchangePosition] !== swap.to
            )
              fail("The other allocation has changed.", 409);
            validateSelection(state, other, otherSlot, swap.from, releasedPrimaryExclusions(state, s.id, slot.id, swap.position, swap.from), swap.exchangePosition);
            if (
              otherSlot[swap.exchangePosition === "main" ? "backup" : "main"] === swap.from
            )
              fail("Main and backup for the same role must be different people.");
            otherBefore = structuredClone(other);
            otherSlot[swap.exchangePosition] = swap.from;
            updateStamp(other, actor);
            audit(state, actor, "Exchange accepted", {
              sessionId: other.id,
              swapId: swap.id,
              before: otherBefore,
              after: structuredClone(other),
              comment: swap.comment,
            });
            notifySchedulers(
              state,
              other,
              `Duty exchange accepted by ${actor.name}: ${swap.comment}`,
            );
          }
          slot[swap.position] = swap.to;
          updateStamp(s, actor);
          audit(state, actor, "Swap accepted", {
            sessionId: s.id,
            swapId: swap.id,
            before,
            after: structuredClone(s),
            comment: swap.comment,
          });
          notifySchedulers(
            state,
            s,
            `Swap accepted by ${actor.name}: ${swap.comment}`,
          );
        }
      }
      swap.resolvedAt = new Date().toISOString();
      notify(state, swap.from, `Your swap request was ${swap.status}.`, s.id);
      notify(state, swap.to, `Swap request ${swap.status}.`, s.id);
      audit(state, actor, "Swap " + swap.status, {
        sessionId: s.id,
        swapId: swap.id,
        comment: swap.comment,
      });
    } else if (action === "read-notifications") {
      for (const n of state.notifications)
        if (n.recipient === actor.id) n.read = true;
    } else fail("Unknown action.");
    pruneAudit(state, actor);
    const expected = state.revision;
    state.revision++;
    await store.saveState(state, expected);
    if (quickVolunteerId) return reply({ ...view(state, actor), quickVolunteerId });
    if (accountApprovedEmail && store.sendAccountMail) {
      try { await store.sendAccountMail({ id: id(), to: accountApprovedEmail, type: "approved" }); }
      catch { return reply({ ...view(state, actor), accountEmailWarning: "Account approved, but the notification email could not be sent. Please tell the volunteer they can sign in." }); }
    }
    return reply(
      view(
        state,
        actor.admin
          ? actor
          : { ...cleanMember(currentMember(state, actor.id) || actor) },
      ),
    );
  } catch (error) {
    return reply(
      { error: error.status ? error.message : "Unable to save. Please retry.", ...(error.conflict ? { conflict: error.conflict } : {}) },
      error.status || 500,
    );
  }
}
