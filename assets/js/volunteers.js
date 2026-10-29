/* Volunteer scheduling UI. No personal data is stored in browser storage. */
window.LPCVolunteers = (() => {
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let root,
    state,
    kind = "service",
    tab = "my-week",
    selected = "",
    branch = "Main Church",
    team = "",
    branches = ["Main Church"],
    busy = false,
    weekStart = "";
  let clashDraft = null;
  let quickAddDraft = null;
  let accountEmailEnabled = false;
  const branchColours = new Map();
  const today = () => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (k) => parts.find((p) => p.type === k).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  function branchKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  function applyBranchColours(config) {
    branchColours.clear();
    for (const [slug, branch] of Object.entries(config.branches || {})) {
      if (!/^#[0-9a-f]{6}$/i.test(branch.color || "")) continue;
      const aliases = [slug, branch.name, branch.churchName];
      if (slug === "chadwell-heath") aliases.push("Main Church");
      for (const alias of aliases.filter(Boolean)) branchColours.set(branchKey(alias), branch.color);
    }
  }
  function branchStyle(branchName) {
    const colour = branchColours.get(branchKey(branchName)) || "#159392";
    const rgb = colour.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    return `--wp-branch-colour:${colour};--wp-branch-foreground:${luminance > 0.179 ? "#000000" : "#ffffff"}`;
  }
  const name = (id) =>
    state.members.find((m) => m.id === id)?.name || "Unassigned";
  const manager = () => state.actor.admin || state.actor.manage?.includes(kind);
  const canEdit = (s) =>
    state.actor.admin ||
    state.actor.manage?.includes(s.kind);
  const date = (d) =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    }).format(new Date(d + "T12:00:00Z"));
  const stamp = (d) =>
    d
      ? new Intl.DateTimeFormat("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Europe/London",
        }).format(new Date(d))
      : "";
  const teams = () => [
    ...new Set([
      "Malayalam",
      "English",
      ...state.services.map((s) => s.team),
      ...state.members.flatMap((m) => m.teams),
    ]),
  ];
  const btn = (label, action, extra = "", secondary = false) =>
    `<button type="button" class="vs-btn ${secondary ? "vs-secondary" : ""}" data-vs="${action}" ${extra}>${label}</button>`;
  const options = (values, current, empty) =>
    `${empty !== undefined ? `<option value="">${esc(empty)}</option>` : ""}${values
      .map((v) => {
        const [value, label] = Array.isArray(v) ? v : [v, v];
        return `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(label)}</option>`;
      })
      .join("")}`;
  const field = (label, content) =>
    `<label class="vs-field">${label}${content}</label>`;
  const input = (name, value = "", type = "text", extra = "") =>
    `<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
  const timeField = (value = "") => {
    const [hour, minute] = value.split(":");
    const values = count => Array.from({length:count}, (_, index) => String(index).padStart(2,"0"));
    return `<fieldset class="vs-time-field"><legend>Time · London</legend><div class="vs-time-selects"><label>Hour (24h)<select name="time-hour" aria-label="Hour (24h)" required>${options(values(24), hour)}</select></label><label>Minute<select name="time-minute" aria-label="Minute" required>${options(values(60), minute)}</select></label></div></fieldset>`;
  };
  const timeValue = form => `${form.get("time-hour")}:${form.get("time-minute")}`;
  function editMeetingButton(session) {
    return canMeetings() && state.meetings?.some(meeting => meeting.id === session.meetingId && !meeting.archived)
      ? btn("Edit meeting details", "meeting", `data-id="${esc(session.meetingId)}"`, true)
      : "";
  }
  async function api(path = "", body) {
    const response = await fetch("/api/volunteers" + path, {
      cache: "no-store",
      ...(body
        ? {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const value = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(value.error || "Unable to complete the request."),
        { status: response.status, conflict: value.conflict },
      );
    return value;
  }
  function message(text, error = false) {
    const box = root?.querySelector("[data-vs-message]");
    if (box) {
      box.textContent = text;
      box.className = "vs-message " + (error ? "vs-error" : "");
      box.focus();
    }
  }
  async function save(body) {
    if (busy) return;
    busy = true;
    root.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try {
      state = await api("/action", { ...body, revision: state.revision });
      if (body.action === "allocation" && clashDraft?.id === body.sessionId) clashDraft = null;
      if (body.action === "allocation" && quickAddDraft?.id === body.sessionId) quickAddDraft = null;
      const returnTo = body.action === "allocation" && clashDraft && body.sessionId !== clashDraft.id ? clashDraft.id : body.action === "meeting-occurrence" && !body.cancelled ? body.sessionId : "";
      const accountEmailWarning = state.accountEmailWarning;
      if (root.dataset?.usersPage !== "true") await ensureCalendarWeek();
      close();
      render();
      if (returnTo) { selected = returnTo; meetingDetail(); }
      message((body.action === "availability" ? body.value === "available" ? "Your availability is saved: you can serve at this meeting. This does not change your assigned role." : body.value === "unavailable" ? "Your availability is saved: you cannot attend. If you are assigned, the scheduler has been notified." : "Your availability response has been cleared." : "") || accountEmailWarning || (body.action === "approve-account" ? "Account approved. The volunteer can now sign in with their email and password." : body.action === "reject-account" ? "Account request declined." : "") || (body.action === "meeting-occurrence" && !body.cancelled ? "Meeting saved as draft. Review the volunteers, then confirm when ready." : returnTo ? "Conflicting meeting saved. Your original unsaved choices are ready to review." : "Changes saved."));
    } catch (error) {
      root.querySelectorAll("button").forEach((b) => (b.disabled = false));
      const dialog = root.querySelector("dialog[open]");
      if (dialog) {
        const p = dialog.querySelector("[data-dialog-error]");
        p.textContent = error.message;
        if (error.conflict?.sessionId) {
          p.append(document.createTextNode(" "));
          const link = document.createElement("a");
          link.href = "#/volunteers"; link.dataset.vs = "open-clash"; link.dataset.id = error.conflict.sessionId;
          link.textContent = "Open conflicting meeting"; p.append(link);
        }
      } else message(error.message, true);
      if (error.status === 409) {
        if (dialog) close();
        await reload();
        message(
          "The schedule changed. Your changes were not saved. Please check the latest version and try again.",
          true,
        );
      }
    } finally {
      busy = false;
    }
  }
  async function loadBranchSettings() {
      try {
        const result = await fetch("/api/branches");
        if (result.ok) {
          const config = await result.json();
          applyBranchColours(config);
          branches = [
            ...new Set([
              "Main Church",
              ...Object.entries(config.branches || {})
                .map(([slug, b]) =>
                  slug === "chadwell-heath" ? "Main Church" : b.name,
                )
                .filter(Boolean),
              ...state.services.map((s) => s.branch),
              ...state.members.flatMap((m) => m.branches),
            ]),
          ];
        }
      } catch {}
  }
  async function ensureCalendarWeek() {
    if (!weekStart) weekStart = monday(today());
    try {
      state = await api("/action", { action: "ensure-week", start: weekStart, revision: state.revision });
    } catch (error) {
      if (error.status !== 409) throw error;
      state = await api();
      state = await api("/action", { action: "ensure-week", start: weekStart, revision: state.revision });
    }
  }
  async function showCalendarWeek() {
    busy = true;
    render();
    try { if (root.dataset?.usersPage !== "true") await ensureCalendarWeek(); render(); }
    catch (error) { message(error.message, true); }
    finally { busy = false; }
  }
  async function reload() {
    state = await api();
    if (root.dataset?.usersPage !== "true") await ensureCalendarWeek();
    await loadBranchSettings();
    render();
  }
  function close() {
    root.querySelector("dialog")?.close();
    root.querySelector("dialog")?.remove();
  }
  function modal(title, body, submit, callback, onCancel = null) {
    close();
    const dialog = document.createElement("dialog");
    dialog.className = "vs-dialog";
    dialog.returnOnCancel = onCancel;
    dialog.innerHTML = `<form><header><h2>${esc(title)}</h2>${btn("Close", "close", 'aria-label="Close dialog"', true)}</header><div class="vs-dialog-body">${body}</div><p data-dialog-error class="vs-error" role="alert"></p><footer>${btn("Cancel", "close", "", true)}<button class="vs-btn" type="submit">${esc(submit)}</button></footer></form>`;
    root.append(dialog);
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      if (busy) return;
      close();
      onCancel?.();
    });
    dialog.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      callback(new FormData(e.target), e.target);
    };
    dialog.showModal();
  }
  const checks = (key, values, chosen) =>
    `<div class="vs-chips">${values.map((v) => `<label class="vs-chip"><input type="checkbox" name="${key}" value="${esc(v)}" ${chosen.includes(v) ? "checked" : ""}>${esc(key === "skills" ? roleLabel(v) : key === "manage" ? (v === "ministry" ? "Pastoral admin" : "Choir & media admin") : v)}</label>`).join("")}</div>`;

  const addDays = (iso, n) => {
    const d = new Date(iso + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const monday = (iso) => {
    const d = new Date(iso + "T12:00:00Z");
    return addDays(iso, -((d.getUTCDay() + 6) % 7));
  };
  const isCoordinator = () => state.actor.admin || state.actor.manage?.length;
  const canMeetings = () =>
    state.actor.admin || state.actor.manage?.includes("ministry");
  const roleLabel = (role) => (role === "Ministry volunteer" ? "Pastor" : role === "Branch prayer leader" ? "Standby prayer leader" : role);
  const meetingTitle = (name) =>
    name
      .replace(/^DEMO\s*[-·]\s*/, "")
      .replace(/^Ministry Allocation$/, "Evening Prayer Meeting");
  const shortDate = (iso) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "Europe/London",
    }).format(new Date(iso + "T12:00:00Z"));
  let viewedMemberId = null;
  const ownMemberId = () => state.personalMemberId || (state.actor.admin ? null : state.actor.id);
  const personalId = () => state.actor.admin && viewedMemberId ? viewedMemberId : ownMemberId();
  const ownDuties = s => !personalId() ? [] : [...s.slots.filter(slot => slot.main === personalId() || slot.backup === personalId()), ...(s.emergencyCover?.memberId === personalId() ? [{ id: "emergency-cover", role: "Branch prayer leader", main: personalId(), emergency: true }] : [])];
  const ownDuty = s => ownDuties(s)[0];
  function render() {
    if (!root?.isConnected) return;
    if (
      (tab === "members" && !state.actor.admin) ||
      (tab === "settings" && !manager())
    )
      tab = "my-week";
    if (tab === "settings" && kind === "ministry") tab = "pastoral";
    const usersPage = root.dataset?.usersPage === "true" && state.actor.admin;
    if (usersPage) tab = "members";
    if (!weekStart) weekStart = monday(today());
    if (!isCoordinator() && !["my-week", "updates"].includes(tab)) tab = "my-week";
    if (!state.actor.admin && tab === "pastoral" && !state.actor.manage?.includes("ministry")) tab = "my-week";
    if (!state.actor.admin && tab === "choir" && !state.actor.manage?.includes("service")) tab = "my-week";
    const accessRole = state.actor.admin ? "Site administrator" : state.actor.manage?.length ? state.actor.manage.map(k => k === "ministry" ? "Pastoral scheduler" : "Choir & media scheduler").join(" · ") : "Volunteer";
    const unread = state.notifications.filter((n) => !n.read).length;
    root.className = "container vs-app wp-app" + (usersPage ? " wp-users-page" : "");
    root.innerHTML = `${usersPage ? window.LPCTeamAuth.navigation(state.actor, true) : ""}<header class="wp-heading"><div><p class="vs-eyebrow">London Pentecostal Church</p><h1>${usersPage ? "Users & access" : "Church Weekly Planner"}</h1><p>${usersPage ? "Manage selected team accounts, serving roles and scheduling permissions." : "One meeting schedule. Clear responsibilities."}</p></div><div class="wp-account"><span class="wp-account-identity" role="group" aria-label="Signed-in account"><strong class="wp-account-name">${esc(state.actor.name)}</strong><small class="wp-account-role"><b>Role:</b> ${esc(accessRole)}</small></span>${btn("Sign out", "logout", "", true)}${state.actor.admin && state.pendingAccounts?.length ? btn("Invited accounts awaiting approval (" + state.pendingAccounts.length + ")", "tab", 'data-tab="members"') : ""}${usersPage ? "" : btn("Updates" + (unread ? " (" + unread + ")" : ""), "tab", 'data-tab="updates"', true)}<details class="wp-menu"><summary>My account</summary><div>${!state.actor.admin ? btn("Backup recovery code (optional)", "recovery-code", "", true) + btn("Change password", "password", "", true) : usersPage ? '' : '<a href="#/lpcadmin">Website admin</a>'}${btn("Refresh", "refresh", "", true)}</div></details>${
      isCoordinator() && !usersPage
        ? `<details class="wp-menu"><summary>Coordinator settings</summary><div>${state.actor.admin ? btn("Members & skills", "tab", 'data-tab="members"', true) : ""}${[
            "service",
          ]
            .filter((k) => state.actor.admin || state.actor.manage?.includes(k))
            .map((k) =>
              btn(
                k === "ministry"
                  ? "Pastoral team setup"
                  : "Choir & media setup",
                "team-tab",
                `data-kind="${k}"`,
                true,
              ),
            )
            .join(
              "",
            )}${btn("Change history", "tab", 'data-tab="history"', true)}</div></details>`
        : ""
    }</div></header>
    <nav class="wp-primary" aria-label="Choose planner">${[
      ["my-week", "My Week"],
      ["pastoral", "Pastoral Planner"],
      ["choir", "Choir & Media"],
      ["meetings", "Church Meetings"],
    ]
      .filter(([key]) => key === "my-week" || state.actor.admin || (key === "pastoral" && state.actor.manage?.includes("ministry")) || (key === "choir" && state.actor.manage?.includes("service")) || (key === "meetings" && isCoordinator()))
      .map(
        ([key, label]) =>
          `<button data-vs="tab" data-tab="${key}" class="${tab === key ? "is-active" : ""}" aria-current="${tab === key ? "page" : "false"}">${label}</button>`,
      )
      .join("")}</nav>

    <p data-vs-message class="vs-message" tabindex="-1" role="status"></p><div id="vs-content"></div>`;
    root.querySelector("#vs-content").innerHTML =
      tab === "members"
        ? members()
        : tab === "settings"
          ? settings()
          : tab === "updates"
            ? updates()
            : tab === "history"
              ? history()
              : weekly();
  }
  function weekControls() {
    const end = addDays(weekStart, 6);
    return `<div class="wp-weekbar"><div class="wp-week-nav">${btn('<span aria-hidden="true">←</span><span class="wp-week-word"> Previous week</span>', "week", 'data-step="-1" aria-label="Previous week"', true)}<div aria-live="polite"><strong>${shortDate(weekStart)} – ${shortDate(end)}</strong><small>${end.slice(0, 4)}</small></div>${btn('<span class="wp-week-word">Next week </span><span aria-hidden="true">→</span>', "week", 'data-step="1" aria-label="Next week"', true)}</div><div class="wp-date-tools">${btn("This week", "this-week", "", true)}<details class="wp-date-picker"><summary>Go to date</summary>${field("Choose date", `<input type="date" data-filter="week" value="${weekStart}" aria-label="Go to date">`)}</details></div></div>`;
  }
  function selectedSessions() {
    return state.sessions
      .filter(
        (s) =>
          s.date >= weekStart &&
          s.date <= addDays(weekStart, 6) &&
          (tab === "my-week" ||
            ((!branch || s.branch === branch) && (!team || s.team === team))),
      )
      .sort((a, b) =>
        (a.date + a.time + a.branch).localeCompare(b.date + b.time + b.branch),
      );
  }
  function weekly() {
    if (tab === "pastoral") kind = "ministry";
    if (tab === "choir") kind = "service";
    let list = selectedSessions();
    if (tab === "my-week")
      list = personalMeetings(list);
    else if (tab === "meetings") {
      const seen = new Set();
      list = list.filter((s) => {
        const key = s.occurrenceId || s.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else list = list.filter((s) => s.kind === kind);
    const titles = {
      "my-week": ["My Week", "Your duties and lineups across all teams."],
      pastoral: [
        "Pastoral Planner",
        "Arrange pastors and resolve pastoral gaps.",
      ],
      choir: [
        "Choir & Media Planner",
        "Arrange worship, music and the technical team.",
      ],
      meetings: [
        "Church Meetings",
        "The common meeting calendar used by both planners.",
      ],
    };
    const [title, description] = titles[tab] || titles["my-week"];
    const filters = `<div class="wp-filters">${field("Branch", `<select data-filter="branch">${options(branches, branch, "All branches")}</select>`)}${field("Language / team", `<select data-filter="team">${options(teams(), team, "All teams")}</select>`)}</div>`;
    return `<div class="wp-section-heading"><div><h2>${title}</h2><p>${description}</p></div>${['pastoral','choir'].includes(tab) && manager() ? btn("Participation & Excel", "participation-report", "", true) : tab === "meetings" && canMeetings() ? btn("+ Add meeting", "meeting") : ""}</div>${weekControls()}${tab === "my-week" ? personalProfileControl() : filters}
    ${
      tab === "my-week"
        ? `<div class="wp-personal">${list.length ? list.map((s) => personalMeetingCard(s)).join("") : `<div class="wp-empty"><h3>${state.actor.admin && !personalId() ? "Choose your volunteer profile above" : "No duties assigned this week"}</h3><p>${state.actor.admin && !personalId() ? "Your website admin account is separate from the person on the rota. Choose your name once to see your weekly duties." : "This includes every branch and service team. Use Previous week or Next week to browse other weeks."}</p></div>`}</div>`
        : weekAgenda(list, title)
    }
    ${tab === "meetings" && isCoordinator() ? `<details class="wp-recurring"><summary>Meeting patterns &amp; special dates</summary><p>Weekly meetings repeat automatically. One-off meetings and daily series stay within their selected dates.</p>${(state.meetings || []).map((m) => `<div class="wp-regular-row"><div><strong>${esc(m.name)}</strong><small>${esc(m.branch)} · ${esc(meetingPatternLabel(m))} · ${esc(m.team)}</small></div><div>${canMeetings() ? btn("Edit meeting", "meeting", `data-id="${m.id}"`, true) + btn("Delete series", "delete-meeting-series", `data-id="${m.id}"`, true) : ""}</div></div>`).join("") || "<p>No regular meetings yet. Add your first meeting above.</p>"}</details>` : ""}${tab === "meetings" ? archivedSeries() : ""}`;
  }
  function personalMeetings(sessions) {
    const mine = sessions.filter(s => ownDuty(s) || (personalId() && s.leadId === personalId()));
    return mine.filter((s, index) => !mine.slice(0, index).some(other => sameMeetingOccurrence(s, other)));
  }
  function personalMeetingCard(session) {
    const related = state.sessions.filter(other => sameMeetingOccurrence(session, other));
    const duties = related.flatMap(other => ownDuties(other).map(duty => ({ ...duty, sessionId: other.id })));
    const uniqueDuties = duties.filter((duty, index) => !duties.slice(0, index).some(other => other.role === duty.role && (other.main === personalId()) === (duty.main === personalId())));
    const r = readiness(session);
    const editing = related.some(other => canEdit(other));
    const lead = related.some(other => other.leadId === personalId());
    return meetingTile(session, `
    ${uniqueDuties.length ? `<section class="wp-duty-callout" aria-label="Your assigned duties"><span class="wp-duty-label">${viewedMemberId ? esc(name(personalId())) + " · Assigned duties" : "Your " + (uniqueDuties.length > 1 ? "duties" : "duty")}</span>${uniqueDuties.map(duty => `<div class="wp-duty-line"><strong>${esc(roleLabel(duty.role))}</strong><span class="wp-duty-position ${duty.main === personalId() ? "" : "wp-duty-reserve"}">${duty.main === personalId() ? "Main" : "Reserve"}</span></div>`).join("")}</section>` : ""}
    ${lead ? '<p class="wp-area">You coordinate this service</p>' : ""}${coverageSummary(session)}${serviceTeamSummary(session)}
    ${related.filter(other => ownDuty(other)).map(other => `<div><small>${other.kind === "ministry" ? "Pastoral duty" : "Choir & media"}</small>${availabilityLabel(other, personalId())}${!other.cancelled && !state.actor.admin ? `<div class="wp-my-actions">${availabilityButton(other, "card-availability")}${ownDuty(other).emergency ? btn("I cannot attend", "card-availability", `data-id="${other.id}" data-value="unavailable"`, true) : btn("I need cover", "card-swap", `data-id="${other.id}"`, true)}</div>` : ""}</div>`).join("")}
    ${related.some(other => needsReview(other)) ? '<p class="vs-warning">An assignment needs review.</p>' : ""}${btn(editing ? "Arrange team" : "View team", "open-personal-team", `data-id="${session.id}"`, !editing)}`, uniqueDuties.map(duty => roleLabel(duty.role) + (duty.main === personalId() ? "" : " (reserve)")).join(" · ") || (lead ? "You coordinate this service" : ""), true);
  }
  function personalProfileControl() {
    if (!state.actor.admin) return "";
    const own = state.members.find(m => m.id === ownMemberId());
    const viewing = state.members.find(m => m.id === personalId());
    const choices = state.members.filter(m => m.active).map(m => [m.id, m.name]);
    return `<div class="wp-personal-controls">${viewedMemberId ? `<p role="status"><strong>Viewing ${esc(viewing?.name || "volunteer")}'s week</strong> ${btn("Back to My Week", "own-week", "", true)}</p>` : own ? `<p>My Week · <strong>${esc(own.name)}</strong></p>` : ""}<details ${!own ? "open" : ""}><summary>${own ? "View someone else’s week" : "Set my volunteer profile"}</summary>${!own ? `<p>Choose your own volunteer profile once. It will open automatically when you return.</p>${field("My name", `<select data-personal-profile>${options(choices, "", "Choose my name…")}</select>`)}` : field("View volunteer", `<select data-view-volunteer>${options(choices, viewedMemberId || "", "My Week")}</select>`)}${own && !state.personalIdentityFromLogin ? `<details><summary>Correct my linked profile</summary>${field("My name", `<select data-personal-profile>${options(choices, ownMemberId(), "Choose my name…")}</select>`)}</details>` : ""}</details></div>`;
  }
  function serviceTeamSummary(session) {
    const related = state.sessions.filter(other => sameMeetingOccurrence(session, other));
    const rows = related.flatMap(other => other.slots.filter(slot => slot.main || slot.backup).map(slot => `<div><strong>${esc(roleLabel(slot.role))}</strong><span>${slot.main ? esc(name(slot.main)) : "Not assigned"}${slot.backup ? ` · Reserve: ${esc(name(slot.backup))}` : ""}</span></div>`));
    const schedulers = [...new Set(related.map(other => other.leadId).filter(Boolean))];
    return `<div class="wp-assigned"><strong>Serving with you</strong>${rows.join("") || "<p>No team assignments yet.</p>"}${schedulers.length ? `<div><strong>Scheduler</strong><span>${schedulers.map(id => esc(name(id))).join(" · ")}</span></div>` : ""}</div>`;
  }
  function weekAgenda(list, title) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      return { date, meetings: list.filter(s => s.date === date), label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" }).format(new Date(date + "T12:00:00Z")) };
    });
    const strip = days.map(day => {
      const content = `<strong>${day.label}</strong><span>${shortDate(day.date)}</span><small>${day.meetings.length ? `${day.meetings.length} meeting${day.meetings.length === 1 ? "" : "s"}` : "No meetings"}</small>`;
      const classes = `wp-week-day ${day.date === today() ? "wp-is-today" : ""} ${day.meetings.length ? "wp-has-meetings" : ""}`;
      return day.meetings.length ? `<button type="button" class="${classes}" data-vs="jump-day" data-date="${day.date}" aria-label="Show ${day.label} ${shortDate(day.date)}, ${day.meetings.length} meetings"${day.date === today() ? ' aria-current="date"' : ""}>${content}</button>` : `<div class="${classes}"${day.date === today() ? ' aria-current="date"' : ""}>${content}</div>`;
    }).join("");
    return `<div class="wp-week-strip" aria-label="Week at a glance">${strip}</div><div class="wp-agenda" aria-label="Weekly ${esc(title)}">${days.filter(day => day.meetings.length).map(day => `<section class="wp-event-day ${day.date === today() ? "wp-is-today" : ""}" id="wp-date-${day.date}" aria-labelledby="wp-heading-${day.date}"><header><h3 id="wp-heading-${day.date}" tabindex="-1">${date(day.date)}</h3>${day.date === today() ? '<span class="vs-badge vs-green">Today</span>' : ""}<span class="wp-day-count">${day.meetings.length} meeting${day.meetings.length === 1 ? "" : "s"}</span></header><div class="wp-event-grid">${day.meetings.map(s => meetingCard(s)).join("")}</div></section>`).join("") || '<div class="wp-empty"><h3>No meetings this week</h3><p>Try another week or change the branch and team filters.</p></div>'}</div><p class="vs-help">${list.length} meeting${list.length === 1 ? "" : "s"} this week · Times shown in London time.</p>`;
  }
  function readiness(s) {
    return s.readiness || { code: s.cancelled ? "cancelled" : "pastor-needed", label: s.cancelled ? "Cancelled" : "Pastor needed", pastorId: "", emergencyMemberId: "", choirLeadId: "", otherVacancies: 0 };
  }
  function pastorReserveIds(session) {
    return [...new Set(state.sessions
      .filter(other => !other.cancelled && other.kind === "ministry" && sameMeetingOccurrence(session, other))
      .flatMap(other => other.slots.filter(slot => slot.role === "Ministry volunteer" && slot.backup).map(slot => slot.backup)))];
  }
  function coverageSummary(s) {
    const r = readiness(s);
    if (s.cancelled) return "";
    const reserveIds = pastorReserveIds(s);
    const row = (label, value) => '<p' + (label === 'Pastor' && !value ? ' class="wp-pastor-needed"' : '') + '><strong>' + label + ':</strong> ' + (value || (label === 'Pastor' ? 'Not arranged — scheduler action needed' : 'Arrange locally')) + '</p>';
    return '<div class="wp-coverage">' + row('Pastor', r.pastorId ? esc(name(r.pastorId)) : '') + row('Standby prayer leader (optional)', r.emergencyMemberId ? esc(name(r.emergencyMemberId)) : '') + row('Choir lead', r.choirLeadId ? esc(name(r.choirLeadId)) : '') + row('Pastor reserve (optional)', reserveIds.map(id => esc(name(id))).join(', ')) + '<small>' + (r.otherVacancies ? r.otherVacancies + ' other place' + (r.otherVacancies === 1 ? '' : 's') + ' to arrange locally. ' : '') + 'Other roles can be arranged locally and recorded later.</small></div>';
  }
  function plannerCoverage(s) {
    if (!["pastoral", "choir"].includes(tab)) return coverageSummary(s);
    const r = readiness(s);
    const heading = tab === "pastoral" ? "Pastoral coverage" : "Choir & media coverage";
    if (s.cancelled) return '';
    if (tab === "pastoral") {
      const reserveIds = pastorReserveIds(s);
      return '<section class="wp-coverage wp-planner-focus"><h4>' + heading + '</h4><p class="' + (!r.pastorId ? 'wp-pastor-needed' : 'vs-ok') + '"><strong>Pastor:</strong> ' + (r.pastorId ? esc(name(r.pastorId)) : 'Not arranged — scheduler action needed') + '</p><p><strong>Pastor reserve (optional):</strong> ' + (reserveIds.map(id => esc(name(id))).join(', ') || 'Arrange locally') + '</p><p><strong>Standby prayer leader (optional):</strong> ' + (r.emergencyMemberId ? esc(name(r.emergencyMemberId)) : 'Arrange locally') + '</p><small>Arrange pastoral cover here. Choir and technical duties are managed in Choir & Media.</small></section>';
    }
    const groups = [ ['Worship lead', ['Lead singer']], ['Singers & musicians', ['Choir singer', 'Keyboard player', 'Guitarist']], ['Sound, camera & screen', ['Sound operator', 'Camera operator', 'Screen operator']] ];
    const shown = new Set(groups.flatMap(g => g[1]));
    const otherRoles = [...new Set(s.slots.map(slot => slot.role).filter(role => !shown.has(role) && !["Ministry volunteer", "Branch prayer leader"].includes(role)))];
    if (otherRoles.length) groups.push(['Other team duties', otherRoles]);
    const teamBadge = choirTeamBadge(s);
    return '<section class="wp-coverage wp-planner-focus"><h4>' + heading + '</h4><p><span class="vs-badge ' + teamBadge.className + '">' + esc(teamBadge.label) + '</span></p><p class="vs-help">' + (r.pastorId ? 'Contact the pastor in charge above for service and choir coordination.' : 'Pastor assignment is critical. Contact the pastoral scheduler to arrange the lead.') + '</p>' + groups.map(([title, roles]) => '<div class="wp-team-group"><h5>' + title + '</h5>' + (s.slots.filter(slot => roles.includes(slot.role)).map(slot => '<p><strong>' + esc(roleLabel(slot.role)) + ':</strong> ' + (slot.main ? esc(name(slot.main)) : 'Arrange locally') + (slot.backup ? '<small>Reserve: ' + esc(name(slot.backup)) + '</small>' : '') + '</p>').join('') || '<p class="vs-help">No places configured</p>') + '</div>').join('') + '<small>Unfilled choir and media roles can be arranged locally and recorded later.</small></section>';
  }
  function plannerBadge(s) {
    const r = readiness(s);
    if (tab !== "choir" || s.cancelled) return { label: r.label, className: r.code === "ready" ? "vs-green" : r.code === "pastor-needed" ? "vs-red" : "" };
    return { label: r.pastorId ? 'Pastor in charge: ' + name(r.pastorId) : 'Pastor in charge: Not assigned — action needed', className: r.pastorId ? 'vs-green' : 'vs-red' };
  }
  function choirTeamBadge(s) {
    const gaps = s.slots.filter(slot => !["Ministry volunteer", "Branch prayer leader"].includes(slot.role)).filter(slot => !slot.main || !canServe(state.members.find(m => m.id === slot.main), s, slot.role) || state.members.find(m => m.id === slot.main)?.availability?.[s.id] === "unavailable").length;
    return { label: gaps ? gaps + ' choir/media place' + (gaps === 1 ? '' : 's') + ' to arrange' : 'Choir & media assigned', className: gaps ? '' : 'vs-green' };
  }
  function emergencyFields(s, edit) {
    const cover = s.emergencyCover;
    if (!edit) return cover?.memberId ? `<div class="vs-callout"><strong>Standby prayer leader: ${esc(name(cover.memberId))}</strong><p>${esc(cover.reason)}</p></div>` : "";
    const candidates = state.members.filter(m => canServe(m, s, "Branch prayer leader") && m.availability?.[s.id] !== "unavailable");
    const invalid = cover?.memberId && !candidates.some(m => m.id === cover.memberId) ? `<option value="${esc(cover.memberId)}" selected disabled>${esc(name(cover.memberId))} · No longer eligible — replace</option>` : "";
    return `<details class="wp-emergency" ${cover?.memberId ? "open" : ""}><summary>Record standby prayer leader (optional)</summary><p>Arrange locally without blocking the meeting. The pastoral scheduler can record the name here later. For emergency pastor cover, record the reason below.</p><label class="vs-chip"><input type="checkbox" name="emergency-mode" ${cover?.memberId ? "checked" : ""}>Record a standby prayer leader</label><div data-emergency-fields ${cover?.memberId ? "" : "hidden"}>${field("Branch prayer leader", `<select name="emergency-member" data-last-value="${esc(cover?.memberId || "")}">${invalid}${options(candidates.map(m => [m.id, m.name]), cover?.memberId || "", "Choose emergency cover")}<option value="__add_volunteer__">+ Add volunteer…</option></select>`)}${field("Notes (optional)", `<textarea name="emergency-reason" maxlength="1000">${esc(cover?.reason || "")}</textarea>`)}<p class="vs-help">Only volunteers with the Branch prayer leader role and matching branch/service team can be selected.</p></div></details>`;
  }
  function readEmergencyCover() {
    return root.querySelector('[name="emergency-mode"]')?.checked ? { memberId: root.querySelector('[name="emergency-member"]').value, reason: root.querySelector('[name="emergency-reason"]').value } : null;
  }
  function meetingTile(s, body, duty = "", personal = false) {
    const badge = plannerBadge(s), r = readiness(s);
    const pastorLine = s.cancelled || personal || !r.pastorId || tab === "choir" ? "" : `<p class="wp-tile-key ${r.pastorId ? "vs-ok" : "wp-pastor-needed"}"><strong>Pastor:</strong> ${r.pastorId ? esc(name(r.pastorId)) : "Not arranged — action needed"}</p>`;
    const choirLine = tab === "choir" && !s.cancelled ? `<p class="wp-tile-key"><strong>Worship lead:</strong> ${r.choirLeadId ? esc(name(r.choirLeadId)) : "Arrange locally"}</p><span class="vs-badge ${choirTeamBadge(s).className}">${esc(choirTeamBadge(s).label)}</span>` : "";
    return `<details class="wp-meeting wp-collapsible ${s.kind === "ministry" ? "wp-pastoral" : ""} ${s.cancelled ? "wp-cancelled" : ""}" style="${branchStyle(s.branch)}"><summary><div class="wp-meeting-top"><div class="wp-tile-when"><time>${esc(s.time)}</time>${personal ? `<span class="wp-tile-date">${shortDate(s.date)}</span>` : ""}</div><span class="vs-badge ${badge.className}">${esc(badge.label)}</span></div><h3>${esc(meetingTitle(s.name))}</h3><p class="wp-branch">${esc(s.branch)} · ${esc(s.team)}</p>${duty ? `<p class="wp-tile-duty"><strong>My duty:</strong> ${esc(duty)}</p>` : ""}${pastorLine}${choirLine}${needsReview(s) ? '<p class="vs-warning">Assignment needs review</p>' : ''}<span class="wp-expand-label"><span class="wp-show-details">View details</span><span class="wp-hide-details">Hide details</span><span class="wp-expand-icon" aria-hidden="true">⌄</span></span></summary><div class="wp-card-body">${body}</div></details>`;
  }
  function meetingCard(s, personal = false) {
    const mine = ownDuty(s),
      pastoral = s.kind === "ministry";
    const ownPosition = mine?.main === personalId() ? "Main" : "Backup";
    const r = readiness(s), badge = plannerBadge(s);
    const remainingSlots = personal && mine ? ownDuties(s) : ["pastoral", "choir"].includes(tab) ? [] : pastoral ? [] : s.slots.filter(slot => slot.role !== "Lead singer");
    const displaySlots = remainingSlots.slice(0, 3);
    return meetingTile(s, `${personal && mine ? `<section class="wp-duty-callout" aria-label="Your assigned duties"><span class="wp-duty-label">${viewedMemberId ? esc(name(personalId())) + " · Assigned duties" : "Your " + (ownDuties(s).length > 1 ? "duties" : "duty")}</span>${ownDuties(s).map(duty => `<div class="wp-duty-line"><strong>${esc(roleLabel(duty.role))}</strong><span class="wp-duty-position ${duty.main === personalId() ? "" : "wp-duty-reserve"}">${duty.main === personalId() ? "Main" : "Reserve"}</span></div>`).join("")}</section>` : ""}${plannerCoverage(s)}${personal ? `<p class="wp-area">${pastoral ? "Pastoral duty" : "Choir & media"}${s.leadId === personalId() ? " · You lead this meeting" : ""}</p>` : ""}
    ${tab !== "meetings" && displaySlots.length ? `<div class="wp-assigned">${displaySlots.map((slot) => `<div><strong>${esc(roleLabel(slot.role))}</strong><span>${slot.main ? esc(name(slot.main)) : pastoral ? "Pastor not assigned" : "Needs a volunteer"}</span>${slot.backup ? `<small>Backup: ${esc(name(slot.backup))}</small>` : ""}</div>`).join("")}${remainingSlots.length > displaySlots.length ? `<small>+ ${remainingSlots.length - displaySlots.length} more roles</small>` : ""}</div>` : tab === 'meetings' ? '<p class="wp-area">Shared by both planners</p>' : ''}
    ${personal && mine ? `${state.members.find(m => m.id === personalId())?.availability?.[s.id] === "available" && !s.cancelled ? "" : availabilityLabel(s, personalId())}${!s.cancelled && !state.actor.admin ? `<div class="wp-my-actions">${availabilityButton(s, "card-availability")}${mine.emergency ? btn("I cannot attend", "card-availability", `data-id="${s.id}" data-value="unavailable"`, true) : btn("I need cover", "card-swap", `data-id="${s.id}" data-slot-id="${mine.id}" data-position="${mine.main === personalId() ? "main" : "backup"}"`, true)}</div>` : ""}` : ""}
    ${personal ? serviceTeamSummary(s) : ""}
    ${needsReview(s) ? '<p class="vs-warning">An assignment needs review. Check eligibility and availability in this team.</p>' : ""}
    ${btn(tab === "meetings" ? "View meeting" : canEdit(s) ? tab === "pastoral" ? "Arrange pastoral cover" : tab === "choir" ? "Arrange choir & media" : "Arrange team" : "View team", "open-session", `data-id="${s.id}"`, !canEdit(s) || tab === "meetings")}${editMeetingButton(s)}`);
  }
  function meetingOverview() {
    const s = state.sessions.find((x) => x.id === selected);
    if (!s) return;
    const linked = state.sessions.filter(x => sameMeetingOccurrence(s, x));
    modal(
      meetingTitle(s.name),
      `<p class="wp-detail-meta"><strong>${esc(s.branch)}</strong> · ${esc(s.team)}<br>${date(s.date)} · ${esc(s.time)} (London time)</p><span class="vs-badge">${esc(readiness(s).label)}</span>${coverageSummary(s)}<p>Choose the team you want to view.</p><div class="wp-my-actions">${linked.map((x) => btn(x.kind === "ministry" ? "Pastoral assignments" : "Choir & media team", "open-lane", `data-id="${x.id}" data-kind="${x.kind}"`, true)).join("")}</div>${editMeetingButton(s)}${canMeetings() ? btn("Change date / cancel meeting", "occurrence", "", true) : ""}`,
      "Done",
      () => close(),
    );
    root.querySelector("dialog footer").innerHTML = btn(
      "Done",
      "close",
      "",
      true,
    );
  }
  function meetingDetail() {
    let s = state.sessions.find((x) => x.id === selected);
    if (!s) return;
    if (clashDraft && clashDraft.actorId !== state.actor.id) clashDraft = null;
    if (quickAddDraft && quickAddDraft.actorId !== state.actor.id) quickAddDraft = null;
    let draft = quickAddDraft?.id === s.id ? quickAddDraft : clashDraft?.id === s.id ? clashDraft : null;
    if (draft && draft.baseline !== JSON.stringify(s)) { clashDraft = null; quickAddDraft = null; draft = null; message("The original meeting changed. Review the latest assignments before editing.", true); }
    if (draft) s = { ...s, slots: draft.slots, ...(draft.leadId !== undefined ? { leadId: draft.leadId } : {}), emergencyCover: draft.emergencyCover };
    const edit = canEdit(s) && !s.cancelled;
    const pastoral = s.kind === "ministry";
    const singlePastor = pastoral && s.slots.length === 1;
    kind = s.kind;
    const mine = ownDuty(s);
    const body = `<p class="wp-detail-meta"><strong>${esc(s.branch)}</strong> · ${esc(s.team)}<br>${date(s.date)} · ${esc(s.time)} (London time)</p><p>${pastoral ? "Pastoral scheduler" : "Choir & media scheduler"}: <strong>${s.leadId ? esc(name(s.leadId)) : "Not set"}</strong></p><span class="vs-badge ${readiness(s).code === "ready" ? "vs-green" : readiness(s).code === "pastor-needed" ? "vs-red" : ""}">${esc(readiness(s).label)}</span>${pastoral ? "" : `<p class="${readiness(s).pastorId ? "vs-ok" : "wp-pastor-needed"}"><strong>Pastor in charge:</strong> ${readiness(s).pastorId ? esc(name(readiness(s).pastorId)) : "Not assigned — contact the pastoral scheduler"}</p>`}<p class="vs-help">${pastoral ? "Pastoral" : "Choir & media"} plan: ${s.status === "confirmed" ? "Confirmed" : "Draft"}. Choir and media vacancies do not prevent the meeting from going ahead.</p>
      ${draft?.notice ? `<p class="vs-callout" role="status">${esc(draft.notice)}</p>` : ""}
      ${needsReview(s) ? '<p class="vs-callout">An assigned volunteer no longer meets the active, role, service team or branch requirements. Replace or clear the marked assignment before saving.</p>' : ""}
      ${!pastoral ? '<p class="vs-help">One volunteer may cover several roles here if they have the skills. Main and reserve for the same role must be different people.</p>' : ""}
      <div class="vs-table-wrap"><table class="wp-detail-table"><thead><tr>${singlePastor ? "" : `<th>${pastoral ? "Duty" : "Role"}</th>`}<th>${pastoral ? "Pastor" : "Main volunteer"}</th><th>${pastoral ? "Reserve (optional)" : "Backup"}</th></tr></thead><tbody>${s.slots.map((slot) => `<tr data-slot="${slot.id}">${singlePastor ? "" : `<th>${esc(roleLabel(slot.role))}</th>`}${["main", "backup"].map((position) => `<td data-label="${position === "main" ? (pastoral ? "Pastor" : "Main volunteer") : (pastoral ? "Reserve (optional)" : "Backup (optional)")}">${edit ? `<select data-position="${position}" data-last-value="${esc(slot[position])}" aria-label="${esc(roleLabel(slot.role))} ${position}">${memberOptions(s, slot, slot[position])}</select>` : `<strong>${slot[position] ? esc(name(slot[position])) : "Not assigned"}</strong>`}${slot[position] ? availabilityLabel(s, slot[position]) : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      ${
        edit && manager()
          ? field(
              pastoral ? "Pastoral scheduler" : "Choir & media scheduler",
              `<select name="allocation-lead">${leadOptions(s, s.leadId)}</select>`,
            )
          : ""
      }
      ${pastoral ? emergencyFields(s, edit) : ""}
      ${edit ? field("Comment (optional)", input("allocation-comment", draft?.comment || "", "text", 'maxlength="1000" placeholder="Explain an agreed change"')) : ""}
      ${!state.actor.admin && !s.cancelled ? `<div class="wp-my-actions">${availabilityButton(s, "availability")}${btn("I cannot attend", "availability", 'data-value="unavailable"', true)}${mine && !mine.emergency ? btn("I need cover", "swap", `data-slot-id="${mine.id}" data-position="${mine.main === state.actor.id ? "main" : "backup"}"`, true) : ""}</div>` : ""}
      ${s.updatedAt ? `<p class="vs-help">Last updated by ${esc(s.updatedBy)} · ${stamp(s.updatedAt)}</p>` : ""}
      ${editMeetingButton(s)}${canMeetings() ? btn(s.cancelled ? "Reinstate meeting" : "Change meeting date / cancel", "occurrence", "", true) : ""}
      ${edit ? `<div class="wp-detail-save">${btn("Save draft", "allocation", 'data-status="draft"', true)}${btn("Confirm", "allocation", 'data-status="confirmed"')}</div>` : ""}`;
    modal(meetingTitle(s.name), body, "Done", () => close());
    applyEmergencyMode();
    refreshAssignmentChoices();
    const footer = root.querySelector("dialog footer");
    footer.innerHTML = (clashDraft && clashDraft.id !== s.id ? btn("Back to original meeting", "return-clash", "", true) : "") + btn("Done", "close", "", true);
  }
  function applyEmergencyMode() {
    const toggle = root.querySelector('[name="emergency-mode"]');
    if (!toggle) return;
    const fields = root.querySelector('[data-emergency-fields]'); fields.hidden = !toggle.checked;
    for (const select of root.querySelectorAll('[data-slot] select[data-position="main"]')) {
      select.disabled = toggle.checked;
      if (toggle.checked) select.value = "";
    }
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
  function refreshAssignmentChoices() {
    const selects = [...root.querySelectorAll('dialog [data-slot] select[data-position]')];
    const assigned = new Set(selects.map(select => select.value).filter(Boolean));
    const emergency = root.querySelector('[name="emergency-mode"]')?.checked && root.querySelector('[name="emergency-member"]')?.value;
    if (emergency) assigned.add(emergency);
    const emergencySelect = root.querySelector('[name="emergency-member"]');
    if (emergencySelect) for (const option of emergencySelect.options) option.disabled = !!option.value && option.value !== emergencySelect.value && assigned.has(option.value);
    const session = state.sessions.find(s => s.id === selected);
    for (const select of selects) {
      for (const option of select.options) {
        const paired = selects.find(other => other !== select && other.closest('[data-slot]') === select.closest('[data-slot]'));
        const memberId = option.dataset?.memberId || option.value;
        const taken = !!memberId && memberId !== select.value && (paired?.value === memberId || emergency === memberId);
        option.hidden = taken;
        option.disabled = taken || option.hasAttribute("data-ineligible");
      }
      select.parentElement.querySelector('[data-overlap-warning]')?.remove();
      if (session && select.value) {
        const start = Date.parse(`${session.date}T${session.time}:00Z`);
        const clashes = state.sessions.filter(other => !sameMeetingOccurrence(other, session) && !other.cancelled && Date.parse(`${other.date}T${other.time}:00Z`) < start + session.duration * 60000 && Date.parse(`${other.date}T${other.time}:00Z`) + other.duration * 60000 > start && (other.emergencyCover?.memberId === select.value || other.slots.some(slot => slot.main === select.value || slot.backup === select.value)));
        if (clashes.length) {
          const warning = document.createElement('small');
          warning.dataset.overlapWarning = '';
          warning.className = 'vs-warning';
          warning.append(document.createTextNode("Also scheduled at "));
          clashes.forEach((other, index) => {
            if (index) warning.append(document.createTextNode("; "));
            const link = document.createElement("a");
            link.href = "#/volunteers"; link.dataset.vs = "open-clash"; link.dataset.id = other.id;
            link.textContent = `${other.branch} · ${other.name} ${other.time}`;
            warning.append(link);
          });
          warning.append(document.createTextNode(select.dataset.position === 'backup' ? '. Reserve overlap is allowed; check cover before calling them.' : '. Only overlapping primary duties are blocked.'));
          select.parentElement.append(warning);
        }
      }
    }
  }
  async function openClash(id) {
    if (!clashDraft || selected === clashDraft.id) {
      const original = state.sessions.find(s => s.id === selected);
      const rows = [...root.querySelectorAll('dialog tr[data-slot]')];
      if (original && rows.length && rows.every(row => row.querySelector('[data-position=main]'))) clashDraft = {
        id: original.id, actorId: state.actor.id, baseline: JSON.stringify(original),
        slots: original.slots.map(slot => { const row = rows.find(row => row.dataset.slot === slot.id); return { ...slot, main: row.querySelector('[data-position=main]').value, backup: row.querySelector('[data-position=backup]').value }; }),
        comment: root.querySelector('[name=allocation-comment]')?.value || "",
        leadId: root.querySelector('[name=allocation-lead]')?.value,
        emergencyCover: readEmergencyCover(),
      };
    }
    quickAddDraft = null;
    const latest = await api();
    state = latest;
    if (!state.sessions.some(s => s.id === id)) {
      if (clashDraft) { selected = clashDraft.id; meetingDetail(); }
      else { close(); render(); }
      message("That meeting has been removed or is no longer accessible. The latest schedule has been loaded; please retry your assignment.", true);
      return;
    }
    selected = id;
    meetingDetail();
  }
  function participates(member, context) {
    return !!member?.active && member.teams.includes(context.team) && member.branches.includes(context.branch);
  }
  function canServe(member, context, role) {
    return participates(member, context) && member.skills.includes(role);
  }
  function eligibleLead(member, plannerKind, context) {
    return !!member?.active && !!member.manage?.includes(plannerKind) && (!context || participates(member, context));
  }
  function leadOptions(context, current = "") {
    const list = state.members.filter(m => eligibleLead(m, context.kind, context));
    const stale = current && !list.some(m => m.id === current);
    return (stale ? `<option selected disabled value="${esc(current)}">${esc(name(current))} · No longer eligible — replace</option>` : "") +
      options(list.map(m => [m.id, m.name]), stale ? "" : current, "Choose scheduler");
  }
  function refreshMeetingSchedulers() {
    const form = root.querySelector('dialog form');
    if (!form?.querySelector('[name=pastorLeadId]')) return;
    const context = { branch: form.elements.branch.value, team: form.elements.team.value };
    for (const [key, kind] of [["pastorLeadId", "ministry"], ["choirLeadId", "service"]]) {
      const select = form.elements[key];
      const current = state.members.find(m => m.id === select.value);
      select.innerHTML = leadOptions({ ...context, kind }, eligibleLead(current, kind, context) ? select.value : "");
    }
  }
  function needsReview(s) {
    return !s.cancelled && s.date >= today() && (s.slots.some(slot => [slot.main, slot.backup].some(id => id && !canServe(state.members.find(m => m.id === id), s, slot.role))) || (s.emergencyCover?.memberId && !canServe(state.members.find(m => m.id === s.emergencyCover.memberId), s, "Branch prayer leader")));
  }
  function quickVolunteerDialog(role, slotId, position, existingMemberId = "") {
    const original = state.sessions.find(s => s.id === selected);
    const rows = [...root.querySelectorAll('dialog tr[data-slot]')];
    quickAddDraft = {
      id: original.id, actorId: state.actor.id, baseline: JSON.stringify(original),
      slots: original.slots.map(slot => { const row = rows.find(row => row.dataset.slot === slot.id); return { ...slot, main: row.querySelector('[data-position="main"]').value, backup: row.querySelector('[data-position="backup"]').value }; }),
      leadId: root.querySelector('[name="allocation-lead"]')?.value,
      comment: root.querySelector('[name="allocation-comment"]')?.value || "",
      emergencyCover: readEmergencyCover(),
    };
    const oppositeId = slotId ? quickAddDraft.slots.find(slot => slot.id === slotId)?.[position === "main" ? "backup" : "main"] : "";
    const existing = state.members.filter(m => m.active && m.id !== oppositeId && (state.actor.admin || canServe(m, original, role) || (original.kind === "service" && participates(m, original))));
    const resume = () => { selected = original.id; meetingDetail(); };
    const extraRoles = [...new Set(original.slots.map(slot => slot.role))].filter(value => value !== role);
    modal(existingMemberId ? `Enable ${roleLabel(role)}` : "Add volunteer & continue", `<p><strong>${esc(roleLabel(role))}</strong><br>${esc(original.branch)} · ${esc(original.team)}</p><p>Your team choices and comment are kept while you add this person.</p>` +
      field("Existing volunteer (optional)", `<select name="quick-existing">${options(existing.map(m => [m.id, m.name]), existingMemberId, "Add a new person")}</select>`) +
      field("Full name", input("quick-name", "", "text", `${existingMemberId ? "disabled" : "required"} maxlength="100" autocomplete="off"`)) +
      (extraRoles.length ? `<fieldset><legend>Other roles they can do (optional)</legend>${checks("quick-skills", extraRoles, state.members.find(m => m.id === existingMemberId)?.skills || [])}</fieldset>` : "") +
      `<label class="vs-chip"><input type="checkbox" name="quick-qualified" required>I confirm this person can serve as ${esc(roleLabel(role))} and any other roles ticked above, for this branch and service team.</label><p class="vs-help">${state.actor.admin ? "For an existing volunteer, approval adds the selected serving roles, branch and service team. " : "You can confirm additional choir/media skills for an active person already in this branch and service team. Pastoral skills, other branches and service teams remain with the website administrator. "}A new person is added without login or admin access. Only the website administrator can enable or invite login access.</p>`,
      "Save person & continue", async (f, form) => {
        busy = true;
        form.querySelectorAll("button").forEach(button => button.disabled = true);
        try {
          const result = await api("/action", { action: "quick-volunteer", revision: state.revision, sessionId: original.id, role, roles: [role, ...f.getAll("quick-skills")], memberId: f.get("quick-existing"), name: f.get("quick-name"), qualified: f.has("quick-qualified") });
          busy = false;
          if (!root.isConnected) { quickAddDraft = null; return; }
          state = result;
          const latest = state.sessions.find(s => s.id === original.id);
          quickAddDraft.baseline = JSON.stringify(latest);
          if (position === "emergency") quickAddDraft.emergencyCover = { ...quickAddDraft.emergencyCover, memberId: result.quickVolunteerId };
          else quickAddDraft.slots.find(slot => slot.id === slotId)[position] = result.quickVolunteerId;
          quickAddDraft.notice = "Volunteer ready and selected. Your earlier choices are kept. Save draft or Confirm to save these assignments.";
          resume();
        } catch (error) { busy = false; if (form.isConnected) { form.querySelector("[data-dialog-error]").textContent = error.message; form.querySelectorAll("button").forEach(button => button.disabled = false); } }
      }, resume);
    root.querySelector('[name="quick-existing"]').onchange = e => {
      const nameInput = root.querySelector('[name="quick-name"]');
      nameInput.disabled = !!e.target.value; nameInput.required = !e.target.value;
      const member = state.members.find(m => m.id === e.target.value);
      root.querySelectorAll('input[name="quick-skills"]').forEach(input => input.checked = !!member?.skills.includes(input.value));
    };
  }
  function memberOptions(s, slot, current) {
    const list = state.members
      .filter(
        (m) =>
          canServe(m, s, slot.role) && m.availability?.[s.id] !== "unavailable",
      )
      .sort((a, b) => {
        const rank = (m) =>
          ({ available: 0, unsure: 1, unavailable: 2 })[
            m.availability?.[s.id] || "unsure"
          ];
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
    return (current && !list.some(m => m.id === current) ? `<option value="${esc(current)}" selected disabled data-ineligible>${esc(name(current))} · No longer eligible or unavailable — replace</option>` : "") + options(
      list.map((m) => [
        m.id,
        `${m.name}${!m.active ? " · Inactive" : m.availability?.[s.id] === "unavailable" ? " · Unavailable" : ""}`,
      ]),
      current,
      "Choose a person",
    ) + (s.kind === "service" ? state.members.filter(m => participates(m, s) && !m.skills.includes(slot.role) && m.availability?.[s.id] !== "unavailable").sort((a,b) => a.name.localeCompare(b.name)).map(m => `<option value="__enable_role__:${esc(m.id)}" data-member-id="${esc(m.id)}">${esc(m.name)} · enable for ${esc(roleLabel(slot.role))}…</option>`).join("") : "") + '<option value="__add_volunteer__">+ Add volunteer…</option>';
  }
  function updates() {
    return `<div class="wp-section-heading"><div><h2>Updates & cover requests</h2><p>Changes that concern you, and requests waiting for a reply.</p></div>${btn("Mark updates as read", "read-notifications", "", true)}</div>${swaps()}${
      state.notifications
        .slice()
        .reverse()
        .map(
          (n) =>
            `<section class="vs-card ${!n.read ? "vs-unread" : ""}"><p>${esc(n.message)}</p><small>${stamp(n.at)}</small> ${state.sessions.some(s => s.id === n.sessionId) ? btn("View meeting", "open-session", `data-id="${esc(n.sessionId)}"`, true) : ""}</section>`,
        )
        .join("") || "<p>No new updates.</p>"
    }`;
  }
  function availabilityButton(s, action) {
    const response = state.members.find(m => m.id === state.actor.id)?.availability?.[s.id] || "unsure";
    if (response === "available") return '<span class="vs-availability-confirmed" role="status">✓ I’m available</span>';
    return btn("Confirm I’m available", action, `data-id="${s.id}" data-value="available"`, true);
  }
  function availabilityLabel(s, id) {
    const v =
      state.members.find((m) => m.id === id)?.availability?.[s.id] || "unsure";
    return `<small class="vs-status ${v === "available" ? "vs-ok" : v === "unavailable" ? "vs-warning" : ""}">${v === "unsure" ? "No availability response yet" : v === "available" ? "✓ Available to serve" : "Cannot attend"}</small>`;
  }
  function memberChoices(query = "") {
    const search = query.trim().toLocaleLowerCase();
    return state.members.filter(m => !search || [m.name, m.username, m.email].some(value => String(value || "").toLocaleLowerCase().includes(search))).slice().sort((a,b) => a.name.localeCompare(b.name)).map(m => [m.id, m.name + ' · ' + (m.username || 'Profile only') + (m.active ? '' : ' · Inactive')]);
  }
  function members() {
    const list = memberChoices();
    return '<section class="vs-card vs-user-picker"><div class="vs-header"><div><h2>Select or add a user</h2><p>Choose one person to view or edit their profile, serving roles and access.</p></div>' + btn('Add new user', 'member') + '</div>' +
      field('Search users', '<input type="search" data-user-search placeholder="Search by name or username" autocomplete="off" aria-controls="existing-user">') +
      field('Select existing user', '<select id="existing-user" data-user-select ' + (!list.length ? 'disabled' : '') + '>' + options(list, '', list.length ? 'Choose a user…' : 'No users yet') + '</select>') +
      '<div class="vs-actions">' + btn('Edit selected user', 'edit-selected-user', 'disabled') + '</div>' +
      '<p class="vs-help" data-user-results role="status">' + list.length + ' user' + (list.length === 1 ? '' : 's') + '. Select a person, then choose Edit selected user.</p></section>' +
      (state.pendingAccounts?.length ? '<details class="vs-user-tools"><summary>Invitations awaiting approval (' + state.pendingAccounts.length + ')</summary>' + pendingAccounts() + '</details>' : '') +
      '<details class="vs-user-tools"><summary>Invitations & role settings</summary><div class="vs-actions">' + (accountEmailEnabled ? btn('Invite team member','invite-account','',true) : '<p class="vs-help">Email invitations are unavailable. Use Add new user to create a selected account.</p>') + btn('Manage serving roles','roles','',true) + '</div></details>' +
      '<details class="vs-user-tools"><summary>Private backup & local sync</summary><p>Includes all planner users, password hashes, roles, meetings, assignments and responses. Keep this private file outside GitHub. Website-admin hosting credentials are configured separately.</p><a class="vs-btn vs-secondary" href="/api/volunteers/backup" download="lpc-private-planner-backup.json">Download private planner backup</a><p class="vs-help">Stop the local server, then restore with: npm run data:import -- path-to-backup.json. The existing local planner is backed up first.</p></details>';
  }
  function pendingAccounts() {
    if (!state.actor.admin) return "";
    return `<section class="vs-account-requests"><h2>Invited accounts${state.pendingAccounts?.length ? ` (${state.pendingAccounts.length})` : ""}</h2><p>${state.pendingAccounts?.length ? "Email confirmed. Check that you know this person before approving access." : "Only admin-invited accounts appear here after email confirmation."}</p>${!accountEmailEnabled ? '<p class="vs-warning">Email invitations are unavailable until email is configured. You can still create selected accounts with a username and initial password.</p>' : ""}${(state.pendingAccounts || []).map(r => `<div class="vs-account-request"><div><strong>${esc(r.name)}</strong><small>${esc(r.email)}</small></div>${btn("Review & approve", "review-account", `data-id="${esc(r.id)}"`)}${btn("Decline", "decline-account", `data-id="${esc(r.id)}"`, true)}</div>`).join("")}</section>`;
  }
  function approvalDialog(id) {
    const request = state.pendingAccounts.find(r => r.id === id);
    if (!request) return;
    modal("Approve church account", `<p><strong>${esc(request.name)}</strong><br>${esc(request.email)} · Email confirmed</p>` +
      field("Already on the volunteer list?", `<select name="memberId" data-approval-identity>${options(state.members.filter(m => !m.emailVerifiedAt).map(m => [m.id, m.name]), "", "New volunteer")}</select>`) +
      `<p class="vs-help">Choose an existing person to keep their meetings, assignments and permissions. Only link accounts after you have verified who is registering.</p><div data-new-account-settings><fieldset><legend>Roles they can do</legend>${checks("skills", state.roles, [])}</fieldset><fieldset><legend>Service teams</legend>${checks("teams", teams(), [])}</fieldset><fieldset><legend>Branches</legend>${checks("branches", branches, [])}</fieldset><fieldset><legend>Scheduling access · admin permission</legend>${checks("manage", ["ministry", "service"], [])}</fieldset></div>`,
      "Approve account", f => save({ action: "approve-account", registrationId: id, memberId: f.get("memberId"), skills: f.getAll("skills"), teams: f.getAll("teams"), branches: f.getAll("branches"), manage: f.getAll("manage") }));
  }
  function memberDialog(id) {
    const m = state.members.find((m) => m.id === id) || {
      name: "",
      username: "",
      skills: [],
      teams: [],
      branches: ["Main Church"],
      manage: [],
      active: true,
    };
    modal(
      id ? "Edit user" : "Add new user",
      field(
        "Full name",
        input("name", m.name, "text", 'required maxlength="100"'),
      ) +
        field(
          "Login username",
          input(
            "username",
            m.username,
            "text",
            `${id ? "" : "required"} autocomplete="off" maxlength="80"`,
          ),
        ) +
        field(
          id
            ? "New password (leave blank to keep current)"
            : "Initial password · at least 12 characters",
          input(
            "password",
            "",
            "password",
            `${id ? "" : "required"} minlength="12" maxlength="200" autocomplete="new-password"`,
          ),
        ) +
        `<p class="vs-help">A blank username keeps this as a volunteer profile without login access. To enable login, set a username and initial password, or send an admin invitation from Members & Skills.</p><p class="vs-help">Share login details privately. Volunteers can change their own password after signing in.</p><fieldset><legend>Roles they can do</legend>${checks("skills", state.roles, m.skills)}</fieldset><fieldset><legend>Service teams</legend>${checks("teams", teams(), m.teams)}</fieldset><fieldset><legend>Branches</legend>${checks("branches", branches, m.branches)}</fieldset><fieldset><legend>Scheduling access · separate from roles</legend>${checks("manage", ["ministry", "service"], m.manage)}<p class="vs-help">Pastoral admin manages pastor assignments. Choir & media admin manages that team’s schedules. Ticking Pastor above only makes this person eligible to serve as a pastor. Only website administrators can grant this access.</p></fieldset><label class="vs-chip"><input type="checkbox" name="active" ${m.active ? "checked" : ""}>Active volunteer</label>`,
      "Save user",
      (f) =>
        save({
          action: "member",
          member: {
            id,
            name: f.get("name"),
            username: f.get("username"),
            password: f.get("password"),
            skills: f.getAll("skills"),
            teams: f.getAll("teams"),
            branches: f.getAll("branches"),
            manage: f.getAll("manage"),
            active: f.has("active"),
          },
        }),
    );
  }
  function settings() {
    return `<div class="wp-section-heading"><div><h2>${kind === "ministry" ? "Pastoral team setup" : "Choir & media team setup"}</h2><p>Choose the lead and required roles. Meeting dates and times are managed once under Church Meetings.</p></div></div>${
      state.services
        .filter((s) => s.kind === kind)
        .map(
          (s) =>
            `<section class="vs-card"><div class="vs-header"><div><h3>${esc(meetingTitle(s.name))}</h3><p>${esc(s.branch)} · ${esc(s.team)}</p><p>${kind === "ministry" ? "Scheduler" : "Team lead"}: ${s.leadId ? esc(name(s.leadId)) : "Not set"}</p><p>${s.roles.map((r) => esc(roleLabel(r.role)) + " × " + r.count).join(" · ")}</p></div>${btn("Edit team setup", "team-settings", `data-id="${s.id}"`, true)}</div></section>`,
        )
        .join("") ||
      '<div class="wp-empty">Create the church meeting first. It will then appear in both planners.</div>'
    }`;
  }
  function teamDialog(id) {
    const service = state.services.find((s) => s.id === id);
    if (service.kind === "ministry") { tab = "pastoral"; kind = "ministry"; return render(); }
    modal(
      service.kind === "ministry"
        ? "Pastoral team setup"
        : "Choir & media setup",
      field(
        service.kind === "ministry" ? "Scheduler" : "Team lead",
        `<select name="leadId">${leadOptions(service, service.leadId)}</select>`,
      ) +
        `<fieldset><legend>Required places · use 0 to omit a role</legend>${state.roles
          .filter((role) =>
            service.kind === "ministry"
              ? role === "Ministry volunteer"
              : !(["Ministry volunteer", "Branch prayer leader"].includes(role)),
          )
          .map((role) =>
            field(
              esc(roleLabel(role)),
              `<input type="number" name="role:${esc(role)}" min="0" max="20" value="${service.roles.find((r) => r.role === role)?.count || 0}">`,
            ),
          )
          .join(
            "",
          )}</fieldset><label class="vs-chip"><input type="checkbox" name="applyDrafts" checked>Also update upcoming draft meetings</label><p class="vs-help">Confirmed meetings stay unchanged. Existing people and backup assignments are preserved.</p>`,
      "Save setup",
      (f) =>
        save({
          action: "team-settings",
          serviceId: id,
          leadId: f.get("leadId"),
          applyDrafts: f.has("applyDrafts"),
          roles: state.roles
            .map((role) => ({
              role,
              count: Number(f.get("role:" + role) || 0),
            }))
            .filter((r) => r.count),
        }),
    );
  }
  function isUpcoming(session) {
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
    return `${session.date}T${session.time}` >= `${today()}T${time}`;
  }
  function meetingPatternLabel(m) {
    if (m.recurrence === "once") return "One-off · " + date(m.startDate) + " · " + m.time;
    if (m.recurrence === "daily") return "Daily · " + date(m.startDate) + " – " + date(m.endDate) + " · " + m.time;
    return "Weekly · " + ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][m.day] + " · " + m.time;
  }
  function refreshMeetingPattern() {
    const dialog = root.querySelector("dialog");
    const pattern = dialog?.querySelector('[name="recurrence"]')?.value;
    if (!pattern) return;
    dialog.querySelectorAll('[data-meeting-pattern]').forEach(group => {
      const show = group.dataset.meetingPattern === pattern || (group.dataset.meetingPattern === 'dated' && pattern !== 'weekly');
      group.hidden = !show;
      group.querySelectorAll('input, select').forEach(control => control.disabled = !show || control.hasAttribute('data-fixed-pattern'));
    });
    const length = dialog.querySelector('[name="seriesLength"]');
    const custom = dialog.querySelector('[data-custom-days]');
    custom.hidden = pattern !== 'daily' || length.value !== 'custom';
    custom.querySelector('input').disabled = custom.hidden || custom.querySelector('input').hasAttribute('data-fixed-pattern');
    const start = dialog.querySelector('[name="startDate"]').value;
    const days = pattern === 'once' ? 1 : Number(length.value === 'custom' ? custom.querySelector('input').value : length.value);
    const note = dialog.querySelector('[data-meeting-dates]');
    note.textContent = pattern === 'weekly' ? 'Repeats every week on the selected day.' : /^\d{4}-\d{2}-\d{2}$/.test(start) && Number.isInteger(days) && days >= 1 && days <= 90 ? (pattern === 'once' ? 'One meeting on ' + date(start) + '.' : days + ' daily meetings: ' + date(start) + ' to ' + date(addDays(start, days - 1)) + ', inclusive. Ends automatically.') : 'Choose a date and a series length from 1 to 90 days.';
  }
  function archivedSeries() {
    if (!state.actor.admin || !state.archivedSeries?.length) return "";
    return `<details class="wp-recurring"><summary>Ended series · preserved history</summary><p>Past meetings are kept for review. Permanently remove a series here only for an explicit test-data cleansing request.</p>${state.archivedSeries.map(m => `<div class="wp-regular-row"><div><strong>${esc(m.name)}</strong><small>${esc(m.branch)} · ${esc(m.team)} · ${m.pastDates} past dates</small></div>${btn("Cleanse past test data", "cleanse-series", `data-id="${m.id}"`, true)}</div>`).join("")}</details>`;
  }
  function cleanseSeriesDialog(id) {
    const meeting = state.archivedSeries?.find(m => m.id === id);
    if (!state.actor.admin || !meeting) return;
    modal("Permanently remove past test data?",
      `<p><strong>${esc(meeting.name)}</strong> · ${esc(meeting.branch)} · ${esc(meeting.team)}</p><p>This permanently removes all ${meeting.pastDates} past dates and their assignments, availability, related cover requests and audit details. Other series and volunteer accounts are kept.</p>` +
      field("Reason for test-data cleansing", '<textarea name="reason" required maxlength="1000"></textarea>') +
      field("Type DELETE to confirm", '<input name="confirmation" required pattern="DELETE" autocomplete="off">'),
      "Permanently remove test data", f => save({ action: "cleanse-meeting-series", meetingId: id, confirm: true, confirmTestData: f.get("confirmation") === "DELETE", reason: f.get("reason") }));
  }
  function deleteMeetingSeriesDialog(id) {
    const meeting = state.meetings.find(m => m.id === id);
    if (!meeting || !canMeetings()) return;
    const sessions = state.sessions.filter(s => s.meetingId === id && isUpcoming(s));
    const dates = [...new Set(sessions.map(s => s.date))].sort();
    const assigned = sessions.reduce((count, s) => count + s.slots.reduce((n, slot) => n + !!slot.main + !!slot.backup, 0), 0);
    modal("Delete upcoming meeting series?",
      `<p><strong>${esc(meeting.name)}</strong><br>${esc(meeting.branch)} · ${esc(meeting.team)}</p><p>This ends the meeting pattern and removes <strong>${dates.length} upcoming dates</strong> from both planners. Past meetings and assignments are preserved.</p>${dates.length ? `<p>${esc(date(dates[0]))} to ${esc(date(dates.at(-1)))} · ${assigned} upcoming assignments</p>` : ""}<p>Related future cover requests and availability will be removed. Affected volunteers will receive an update.</p><label><input type="checkbox" required> End this series and remove its upcoming meetings.</label>`,
      "Delete upcoming dates", () => save({ action: "delete-meeting-series", meetingId: id, confirm: true }));
  }
  function churchMeetingDialog(id) {
    if (!canMeetings()) return;
    if (id && !state.meetings?.some(meeting => meeting.id === id && !meeting.archived)) return message("This meeting series is no longer available for editing.", true);
    const m = state.meetings?.find((x) => x.id === id) || {
      name: "",
      branch: "Main Church",
      team: "Malayalam",
      day: 0,
      time: "09:30",
      duration: 120,
    };
    const recurrence = m.recurrence || 'weekly';
    const days = m.startDate && m.endDate ? Math.round((Date.parse(m.endDate) - Date.parse(m.startDate)) / 86400000) + 1 : 7;
    const fixed = id ? 'disabled data-fixed-pattern' : '';
    modal(
      id ? "Edit meeting details" : "Add a church meeting",
      field(
        "Meeting name",
        input(
          "name",
          m.name,
          "text",
          'required placeholder="e.g. Sunday Malayalam Service"',
        ),
      ) +
        field(
          "Branch",
          `<select name="branch">${options(branches, m.branch)}</select>`,
        ) +
        field(
          "Language / team",
          `<input name="team" list="wp-teams" required value="${esc(m.team)}"><datalist id="wp-teams">${teams()
            .map((t) => `<option value="${esc(t)}">`)
            .join("")}</datalist>`,
        ) +
        field('Meeting pattern', `<select name="recurrence" data-meeting-recurrence ${fixed}>${options([['weekly','Weekly meeting'],['once','One-off meeting'],['daily','Daily series · fasting prayer']], recurrence)}</select>`) +
        `<div class="vs-form-grid"><div data-meeting-pattern="weekly">${field(
          "Day",
          `<select name="day">${options(
            [
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((d, i) => [String(i), d]),
            String(m.day),
          )}</select>`,
        )}</div><div data-meeting-pattern="dated">${field('Meeting date / start date', input('startDate', m.startDate || today(), 'date', 'required ' + fixed))}</div><div data-meeting-pattern="daily">${field('Number of consecutive days', `<select name="seriesLength" data-series-length ${fixed}>${options([['3','3 days'],['7','7 days'],['21','21 days'],['custom','Custom length']], [3,7,21].includes(days) ? String(days) : 'custom')}</select>`)}<div data-custom-days>${field('Custom number of days', input('dayCount', days, 'number', 'required min="1" max="90" ' + fixed))}</div></div>${timeField(m.time)}${field("Duration · minutes", input("duration", m.duration, "number", 'required min="15" max="720"'))}</div><p class="vs-help" data-meeting-dates role="status"></p>` +
        (!id
          ? field(
              "Pastoral scheduler",
              `<select name="pastorLeadId">${leadOptions({ ...m, kind: "ministry" })}</select>`,
            ) +
            field(
              "Choir & media lead",
              `<select name="choirLeadId">${leadOptions({ ...m, kind: "service" })}</select>`,
            )
          : "") +
        `<p class="vs-callout">${id ? 'Saving updates upcoming details in both planners. Past records stay unchanged; changed assignments return to draft and cancellations remain cancelled. Meeting type and one-off/daily date ranges are fixed after creation. Move or cancel an individual date from its card.' : 'Enter the meeting once. It appears in both planners. One-off and daily meetings are created immediately for the selected dates; daily series end automatically.'}</p>`,
      "Save meeting",
      (f) => {
        const pattern = f.get('recurrence') || recurrence;
        const startDate = f.get('startDate') || m.startDate;
        const count = id ? days : Number(f.get('seriesLength') === 'custom' ? f.get('dayCount') : f.get('seriesLength'));
        return save({
          action: "meeting",
          meeting: {
            ...m,
            name: f.get("name"),
            branch: f.get("branch"),
            team: f.get("team"),
            day: Number(f.get("day")),
            recurrence: pattern,
            ...(pattern !== 'weekly' ? { startDate, endDate: pattern === 'once' ? startDate : addDays(startDate, count - 1) } : {}),
            time: timeValue(f),
            duration: Number(f.get("duration")),
            pastorLeadId: f.get("pastorLeadId"),
            choirLeadId: f.get("choirLeadId"),
          },

        });
      },
    );
    refreshMeetingPattern();
  }
  function swaps() {
    const list = state.swaps.filter(
      (w) =>
        w.from === state.actor.id ||
        w.to === state.actor.id ||
        state.actor.admin ||
        state.actor.manage?.includes(
          state.sessions.find((s) => s.id === w.sessionId)?.kind,
        ) ||
        state.sessions.find((s) => s.id === w.sessionId)?.leadId ===
          state.actor.id,
    );
    return `<h3>Cover requests</h3><p>Discuss cover together, record the agreement here, and the replacement accepts. The scheduler is notified automatically.</p>${
      list
        .slice()
        .reverse()
        .map((w) => {
          const s = state.sessions.find((s) => s.id === w.sessionId);
          const other = state.sessions.find(
            (s) => s.id === w.exchangeSessionId,
          );
          return `<section class="vs-card"><div class="vs-header"><h3>${esc(s?.name)} · ${s ? date(s.date) : ""}</h3><span class="vs-badge ${w.status === "accepted" ? "vs-green" : ""}">${w.status === "pending" ? "Awaiting acceptance" : esc(w.status[0].toUpperCase() + w.status.slice(1))}</span></div><p><strong>${esc(name(w.from))} → ${esc(name(w.to))}</strong> · ${esc(s?.slots.find((x) => x.id === w.slotId)?.role)} · ${w.position === "main" ? "Main" : "Backup"}</p>${other ? `<p>Exchange with ${esc(other.name)} · ${date(other.date)} · ${esc(other.branch)}</p>` : ""}<blockquote>${esc(w.comment)}</blockquote><small>Requested ${stamp(w.createdAt)}</small><div class="vs-actions">${w.status === "pending" && w.to === state.actor.id ? btn("Accept swap", "swap-response", `data-id="${w.id}" data-response="accept"`) + btn("Decline", "swap-response", `data-id="${w.id}" data-response="decline"`, true) : ""}${w.status === "pending" && (w.from === state.actor.id || canEdit(s)) ? btn("Cancel request", "swap-response", `data-id="${w.id}" data-response="cancel"`, true) : ""}</div></section>`;
        })
        .join("") || '<div class="vs-empty">No swap requests yet.</div>'
    }`;
  }
  function history() {
    const days = state.auditRetentionDays || 30;
    return `<h2>Change history</h2><section class="vs-card vs-audit-settings"><div><strong>Keep the last ${days} days</strong><p>Older audit entries are deleted when changes are saved. Meetings, duties and volunteer records are kept.</p>${state.actor.admin ? `<small>${state.expiredAuditCount || 0} older entries currently await cleanup. Download an archive before deletion if you need a copy.</small>` : ""}</div>${state.actor.admin ? `<div class="vs-actions">${btn("Retention settings", "audit-settings", "", true)}${btn("Download archive", "audit-export", "", true)}${btn("Delete expired history", "audit-cleanup", state.expiredAuditCount ? "" : "disabled", true)}</div>` : ""}</section>${
      state.history
        .slice()
        .reverse()
        .map(
          (h) =>
            `<section class="vs-card"><strong>${esc(h.action)}</strong><p>${esc(h.by)} · ${stamp(h.at)}</p>${h.sessionId ? `<p>${esc(state.sessions.find((s) => s.id === h.sessionId)?.name)} · ${esc(state.sessions.find((s) => s.id === h.sessionId)?.date)}</p>` : ""}${h.comment ? `<blockquote>${esc(h.comment)}</blockquote>` : ""}${
              h.before?.slots && h.after?.slots
                ? `<details><summary>View allocation changes</summary><ul>${
                    h.after.slots
                      .map((slot) => {
                        const old = h.before.slots.find(
                          (x) => x.id === slot.id,
                        );
                        return ["main", "backup"]
                          .filter((p) => old?.[p] !== slot[p])
                          .map(
                            (p) =>
                              `<li>${esc(slot.role)} (${p}): ${esc(name(old?.[p]))} → ${esc(name(slot[p]))}</li>`,
                          )
                          .join("");
                      })
                      .join("") || "<li>No volunteer assignments changed.</li>"
                  }</ul></details>`
                : ""
            }</section>`,
        )
        .join("") ||
      '<div class="vs-empty">Changes will be recorded here automatically.</div>'
    }`;
  }
  function auditSettingsDialog(cleanup = false) {
    if (!state.actor.admin) return;
    modal(cleanup ? "Delete expired audit history?" : "Audit retention settings",
      (cleanup ? `<p>Delete ${state.expiredAuditCount || 0} audit entries older than ${state.auditRetentionDays || 30} days?</p>` : field("Days to keep audit history", input("days", state.auditRetentionDays || 30, "number", 'required min="1" max="3650" step="1"'))) +
      '<p>Only change history is removed. Meetings, assignments and volunteer records are preserved. Download an archive first if you need a copy.</p><label><input type="checkbox" required> I understand that audit entries outside this period will be permanently deleted.</label>',
      cleanup ? "Delete expired history" : "Save retention", f => save({ action: cleanup ? "audit-cleanup" : "audit-settings", ...(cleanup ? {} : { days: Number(f.get("days")) }), confirm: true }));
  }
  async function downloadAuditArchive() {
    const archive = await api("/audit-export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = `lpc-audit-history-${today()}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message("Audit archive downloaded. Keep it safely for your records.");
  }
  function chooseCoverDuty() {
    const session = state.sessions.find(s => s.id === selected);
    const duties = ownDuties(session).filter(duty => !duty.emergency);
    if (duties.length === 1) return swapDialog(duties[0].id, duties[0].main === state.actor.id ? "main" : "backup");
    modal("Which duty needs cover?", field("Duty", `<select name="coverDuty" required>${options(duties.map(duty => [duty.id, `${roleLabel(duty.role)} · ${duty.main === state.actor.id ? "Main" : "Reserve"}`]), "", "Choose a duty")}</select>`), "Continue", f => {
      const duty = duties.find(duty => duty.id === f.get("coverDuty"));
      if (duty) swapDialog(duty.id, duty.main === state.actor.id ? "main" : "backup");
    });
  }
  function swapDialog(slotId, position) {
    const s = state.sessions.find((s) => s.id === selected),
      slot = s.slots.find((x) => x.id === slotId);
    const possible = state.members.filter(
      (m) =>
        m.id !== state.actor.id &&
        canServe(m, s, slot.role) &&
        m.availability?.[s.id] !== "unavailable" &&
        slot[position === "main" ? "backup" : "main"] !== m.id,
    );
    modal(
      "Request cover",
      `<p><strong>${esc(s.name)}</strong> · ${date(s.date)} · ${esc(s.time)}<br>${esc(s.branch)} · ${esc(slot.role)} (${position})</p>` +
        field(
          "Who can cover?",
          `<select name="targetId" required>${options(
            possible.map((m) => [m.id, m.name]),
            "",
            "Choose replacement",
          )}</select>`,
        ) +
        field(
          "Exchange for one of their duties (optional)",
          `<select name="exchange"><option value="">Cover only · no return duty</option></select>`,
        ) +
        field(
          "Comment · what have you agreed?",
          `<textarea name="comment" required maxlength="1000" placeholder="e.g. Agreed with Joseph to exchange duties as I am away."></textarea>`,
        ) +
        `<p class="vs-callout">Your original duty stays in place until the other volunteer accepts. The scheduler will then be notified.</p>`,
      "Send request",
      (f) => {
        const exchange = f.get("exchange")?.split("|");
        save({
          action: "swap",
          sessionId: s.id,
          slotId,
          position,
          targetId: f.get("targetId"),
          comment: f.get("comment"),
          ...(exchange?.length === 3
            ? {
                exchangeSessionId: exchange[0],
                exchangeSlotId: exchange[1],
                exchangePosition: exchange[2],
              }
            : {}),
        });
      },
    );
    root.querySelector("[name=targetId]").onchange = (e) => {
      const target = e.target.value;
      const choices = [];
      for (const other of state.sessions.filter(
        (x) =>
          x.kind === s.kind &&
          x.id !== s.id &&
          !x.cancelled &&
          x.date >= today(),
      ))
        for (const slot of other.slots)
          for (const p of ["main", "backup"])
            if (slot[p] === target && canServe(state.actor, other, slot.role) && state.actor.availability?.[other.id] !== "unavailable" && slot[p === "main" ? "backup" : "main"] !== state.actor.id)
              choices.push([
                `${other.id}|${slot.id}|${p}`,
                `${date(other.date)} · ${other.time} · ${other.branch} · ${slot.role} (${p})`,
              ]);
      root.querySelector("[name=exchange]").innerHTML = options(
        choices,
        "",
        "Cover only · no return duty",
      );
    };
  }
  function occurrenceDialog() {
    const s = state.sessions.find((s) => s.id === selected);
    modal(
      s.cancelled ? "Reinstate this meeting" : "Change this church meeting",
      field("Date", input("date", s.date, "date", "required")) +
        timeField(s.time) +
        `<label class="vs-chip"><input type="checkbox" name="cancelled" >Cancel this meeting</label>` +
        field(
          "Comment · tell both teams what changed",
          `<textarea name="comment" maxlength="1000" required>${s.cancelled ? "Meeting reinstated for review." : ""}</textarea>`,
        ) +
        `<p class="vs-callout">${s.cancelled ? "This restores the meeting in both planners as a draft. You can then replace or clear old assignments before confirming." : "This updates both planners as a draft. Review the assignments afterwards, then confirm."}</p>`,
      s.cancelled ? "Reinstate meeting" : "Save meeting change",
      (f) =>
        save({
          action: "meeting-occurrence",
          sessionId: s.id,
          date: f.get("date"),
          time: timeValue(f),
          cancelled: f.has("cancelled"),
          comment: f.get("comment"),
        }),
    );
  }
  function participationChart(report, role, needsOnly = false, search = '', page = 0) {
    const cohort=report.participation.filter(r=>r.role===role && r.eligible>0);
    const needs=r=>['No confirmed opportunities','Consider next'].includes(r.suggestion);
    const matches=cohort.filter(r=>(!needsOnly || needs(r)) && r.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>a.rate-b.rate || a.confirmed-b.confirmed || a.name.localeCompare(b.name));
    const max=Math.max(1,...cohort.map(r=>r.confirmed));
    const totalPages=Math.max(1,Math.ceil(matches.length/8)); page=Math.min(Math.max(0,page),totalPages-1);
    const metric=(value,label)=>`<div><strong>${value}</strong><span>${label}</span></div>`;
    return `<div class="wp-report-metrics">${metric(cohort.length,'Eligible people')}${metric(cohort.reduce((n,r)=>n+r.confirmed,0),'Confirmed duties')}${metric(cohort.filter(needs).length,'Need opportunity')}</div><div class="wp-report-chart-head"><h3>Allocation balance</h3><span class="wp-report-legend"><span><i class="wp-report-past"></i>Past</span><span><i class="wp-report-future"></i>Upcoming</span></span></div><p class="wp-report-chart-hint">Primary allocations · fewest opportunities first · tap a name for detail</p><div class="wp-report-bars" role="group" aria-label="Confirmed allocations by person">${matches.slice(page*8,page*8+8).map(r=>{
      const status=r.confirmed===0?'No allocations':needs(r)?'Below average':'';
      return `<details class="wp-report-person${needs(r)?' needs-opportunity':''}"><summary><span class="wp-report-person-name">${esc(r.name)}${status?`<small>${status}</small>`:''}</span><span class="wp-report-bar" aria-hidden="true"><i class="wp-report-past" style="width:${100*r.past/max}%"></i><i class="wp-report-future" style="width:${100*r.upcoming/max}%"></i></span><strong class="wp-report-total" aria-label="${r.confirmed} confirmed allocations">${r.confirmed}<span aria-hidden="true">⌄</span></strong></summary><div class="wp-report-person-detail">${metric(r.past,'Past confirmed')}${metric(r.upcoming,'Upcoming')}${metric(r.draft,'Draft')}${metric(r.reserve,'Reserve')}${metric(r.eligible,'Eligible meetings')}${metric(r.unknown,'Availability to check')}<p>Last: ${esc(r.last || 'None in period')} · Next: ${esc(r.next || 'Not booked')}</p></div></details>`;
    }).join('') || '<p class="wp-report-empty">No matching people for this view.</p>'}</div><div class="wp-report-pagination"><span>${matches.length?`${page*8+1}–${Math.min((page+1)*8,matches.length)} of ${matches.length}`:'0 people'}</span><button type="button" class="vs-btn vs-secondary" data-report-page="${page-1}" ${page===0?'disabled':''} aria-label="Previous people">←</button><button type="button" class="vs-btn vs-secondary" data-report-page="${page+1}" ${page>=totalPages-1?'disabled':''} aria-label="Next people">→</button></div>`;
  }
  function bindParticipationDashboard(report) {
    const dialog=root.querySelector('dialog');
    if (!dialog) return;
    dialog.classList.add('wp-report-dialog');
    const dashboard=dialog.querySelector('[data-participation-dashboard]');
    let page=0;
    const refresh=()=>{dashboard.querySelector('[data-report-chart]').innerHTML=participationChart(report,dashboard.querySelector('[data-report-role]').value,dashboard.querySelector('[data-report-needs]').checked,dashboard.querySelector('[data-report-search]').value,page);};
    dashboard.onchange=()=>{page=0;refresh();};
    dashboard.oninput=e=>{if(e.target.matches('[data-report-search]')){page=0;refresh();}};
    dashboard.onclick=e=>{const button=e.target.closest('[data-report-page]');if(button&&!button.disabled){page=Number(button.dataset.reportPage);refresh();}};
  }
  async function participationReport(range = {}) {
    if (!manager()) return;
    const params = new URLSearchParams({kind,start:range.start || addDays(today(),-84),end:range.end || addDays(today(),28),branch,team});
    const report = await api('/report?' + params);
    const rows = report.participation;
    const roles=[...new Set([...(report.roleNames || []),...rows.map(r=>r.role)])].filter(role=>rows.some(r=>r.role===role));
    const role=roles.includes(range.role)?range.role:roles[0] || '';
    modal(kind==='ministry'?'Pastoral participation report':'Choir & media participation report',
      `<p class="vs-help">${esc(branch || 'All branches')} · ${esc(team || 'All teams')} · ${report.meetings} meetings</p><div class="wp-report-toolbar"><div class="wp-report-dates">${field('From',input('start',report.start,'date','required'))}${field('To',input('end',report.end,'date','required'))}</div><a class="vs-btn" href="/api/volunteers/report?${esc(params.toString())}&amp;format=xlsx" download>Download Excel (.xlsx)</a></div><section data-participation-dashboard class="wp-participation-dashboard"><div class="wp-report-filters">${field('Compare one role',`<select name="report-role" data-report-role>${roles.map(r=>`<option value="${esc(r)}" ${r===role?'selected':''}>${esc(r)}</option>`).join('') || '<option value="">No roles</option>'}</select>`)}<label class="wp-report-needs"><input type="checkbox" data-report-needs>Needs opportunity</label>${field('Find a person','<input type="search" data-report-search placeholder="Search name">')}</div><div data-report-chart>${participationChart(report,role)}</div></section><details class="wp-report-method"><summary>How the comparison works</summary><p class="vs-help">${report.notes.map(esc).join('</p><p class="vs-help">')}</p></details><p class="vs-help">Changed dates? Choose Update report. Excel includes all roles and detailed counts.</p>`,
      'Update report',async data=>{try{await participationReport({start:data.get('start'),end:data.get('end'),role:data.get('report-role')});}catch(error){const errorBox=root.querySelector('[data-dialog-error]');if(errorBox)errorBox.textContent=error.message;}});
    bindParticipationDashboard(report);
  }
  async function click(e) {
    const b = e.target.closest("[data-vs]");
    if (!b || busy) return;
    const a = b.dataset.vs;

    try {
      if (a === 'participation-report') return await participationReport();
      if (a === "landing") {
        e.preventDefault();
        close();
        tab = window.LPCTeamAuth.landing(state.actor).view;
        kind = tab === "pastoral" ? "ministry" : "service";
        selected = ""; viewedMemberId = null;
        render();
        root.querySelector('.landing-navigation a')?.focus();
        return;
      }
      if (a === "open-clash") { e.preventDefault(); return await openClash(b.dataset.id); }
      if (a === "return-clash") { if (clashDraft) { selected = clashDraft.id; meetingDetail(); } return; }
      if (a === "close") {
        const resume = root.querySelector("dialog")?.returnOnCancel;
        close();
        return resume?.();
      }
      if (a === "audit-settings") return auditSettingsDialog();
      if (a === "audit-cleanup") return auditSettingsDialog(true);
      if (a === "audit-export") return await downloadAuditArchive();
      if (a === "prepare-week")
        return await save({
          action: "generate-week",
          start: weekStart,
          branch,
          team,
        });
      if (a === "jump-day") {
        const heading = root.querySelector(`#wp-heading-${b.dataset.date}`);
        heading?.scrollIntoView({ behavior: "auto", block: "start" });
        heading?.focus({ preventScroll: true });
        return;
      }
      if (a === "week") {
        weekStart = addDays(weekStart, Number(b.dataset.step) * 7);
        return await showCalendarWeek();
      }
      if (a === "this-week") {
        weekStart = monday(today());
        return await showCalendarWeek();
      }
      if (a === "team-tab") {
        kind = b.dataset.kind;
        tab = "settings";
        return render();
      }
      if (a === "cleanse-series") return cleanseSeriesDialog(b.dataset.id);
      if (a === "delete-meeting-series") return deleteMeetingSeriesDialog(b.dataset.id);
      if (a === "meeting") return churchMeetingDialog(b.dataset.id);
      if (a === "team-settings") return teamDialog(b.dataset.id);
      if (a === "meeting-weeks")
        return modal(
          "Create weeks for both planners",
          field("From date", input("start", today(), "date", "required")) +
            field(
              "Number of weeks",
              input("weeks", 8, "number", 'required min="1" max="26"'),
            ),
          "Create weeks",
          (f) =>
            save({
              action: "generate-meeting",
              meetingId: b.dataset.id,
              start: f.get("start"),
              weeks: Number(f.get("weeks")),
            }),
        );
      if (a === "card-availability")
        return await save({
          action: "availability",
          sessionId: b.dataset.id,
          value: b.dataset.value,
        });
      if (a === "card-swap") {
        selected = b.dataset.id;
        return chooseCoverDuty();
      }
      if (a === "own-week") { viewedMemberId = null; return render(); }
      if (a === "tab") {
        if (b.dataset.tab === "my-week") viewedMemberId = null;
        tab = b.dataset.tab;
        return render();
      }
      if (a === "refresh") return await reload();
      if (a === "logout") {
        clashDraft = null; quickAddDraft = null; viewedMemberId = null;
        await window.LPCTeamAuth.signOut();
        return;
      }
      if (a === "forgot-password") return emailRequestDialog("reset");
      if (a === "invite-account" && state.actor.admin) return emailRequestDialog("register");
      if (a === "backup-recovery") return recoveryDialog();
      if (a === "sign-in") { window.history.replaceState(null, "", "#/volunteers"); return mount(); }
      if (a === "review-account") return approvalDialog(b.dataset.id);
      if (a === "decline-account") {
        const request = state.pendingAccounts.find(r => r.id === b.dataset.id);
        return modal("Decline account request?", `<p>Decline the request from <strong>${esc(request?.name)}</strong>? Existing volunteer records and duties are kept.</p>`, "Decline request", () => save({ action: "reject-account", registrationId: b.dataset.id }));
      }
      if (a === "recovery-code") return recoveryCodeDialog();
      if (a === "password")
        return modal(
          "Change password",
          field(
            "Current password",
            input(
              "current",
              "",
              "password",
              'required autocomplete="current-password"',
            ),
          ) +
            field(
              "New password",
              input(
                "password",
                "",
                "password",
                'required minlength="12" maxlength="200" autocomplete="new-password"',
              ),
            ),
          "Change password",
          async (f) => {
            await save({
              action: "password",
              current: f.get("current"),
              password: f.get("password"),
            });
            if (!root.querySelector("dialog[open]")) await mount();
          },
        );
      if (a === "member") return memberDialog(b.dataset.id);
      if (a === "edit-selected-user") {
        const id = root.querySelector("[data-user-select]")?.value;
        if (id) return memberDialog(id);
        return;
      }
      if (a === "roles")
        return modal(
          "Manage roles",
          field(
            "One role per line",
            `<textarea name="roles" rows="12" required>${esc(state.roles.join("\n"))}</textarea>`,
          ),
          "Save roles",
          (f) =>
            save({
              action: "roles",
              roles: f
                .get("roles")
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
            }),
        );
      if (a === "allocation") {
        const slots = [...root.querySelectorAll("[data-slot]")].map((row) => ({
          id: row.dataset.slot,
          main: row.querySelector("[data-position=main]").value,
          backup: row.querySelector("[data-position=backup]").value,
        }));
        return await save({
          action: "allocation",
          sessionId: selected,
          slots,
          status: b.dataset.status,
          ...(state.sessions.find(s => s.id === selected)?.kind === "ministry" ? { emergencyCover: readEmergencyCover() } : {}),
          comment: root.querySelector("[name=allocation-comment]").value,
          ...(root.querySelector("[name=allocation-lead]")
            ? { leadId: root.querySelector("[name=allocation-lead]").value }
            : {}),
        });
      }
      if (a === "occurrence") return occurrenceDialog();
      if (a === "availability")
        return await save({
          action: "availability",
          sessionId: selected,
          value: b.dataset.value,
        });
      if (a === "swap") return chooseCoverDuty();
      if (a === "swap-response")
        return await save({
          action: a,
          swapId: b.dataset.id,
          response: b.dataset.response,
        });
      if (a === "read-notifications") return await save({ action: a });
      if (a === "open-personal-team") { selected = b.dataset.id; return meetingOverview(); }
      if (a === "open-session") {
        selected = b.dataset.id;
        return tab === "meetings" ? meetingOverview() : meetingDetail();
      }
      if (a === "open-lane") {
        selected = b.dataset.id;
        tab = b.dataset.kind === "ministry" ? "pastoral" : "choir";
        render();
        return meetingDetail();
      }
    } catch (error) {
      message(error.message, true);
    }
  }
  function emailRequestDialog(type) {
    const registration = type === "register";
    if (!accountEmailEnabled) {
      modal(registration ? "Ask for a volunteer account" : "Recover volunteer access",
        '<p>Email registration and password reset are not set up on this site yet.</p><p>For a volunteer account, ask your church administrator to create your login or reset your password.</p>' +
        (!registration ? btn("Use a saved backup code", "backup-recovery", "", true) : "") +
        '<p><a href="mailto:office@londonpentecostalchurch.org">Contact the church administrator</a></p><p>Website administrator? Your login is separate. Ask the site owner to replace the administrator credentials in hosting settings.</p><a href="#/lpcadmin">Website admin sign-in</a>',
        "Back to sign in", () => close());
      return;
    }
    modal(registration ? "Invite team member" : "Forgot your password?",
      `<p>${registration ? "Enter the selected person’s name and email. They will receive a password setup link. After they verify, approve the account and assign its access here." : "Enter your email. We will send a link so you can choose a new password."}</p>` +
      (registration ? field("Full name", input("name", "", "text", 'required maxlength="100" autocomplete="name"')) : "") +
      field("Email address", input("email", "", "email", 'required maxlength="254" autocomplete="email"')) +
      '<p class="vs-help">Need help? <a href="mailto:office@londonpentecostalchurch.org">Contact the church administrator</a>.</p>' +
      (!registration ? `<details><summary>Other ways to recover access</summary><p>If you previously saved a backup recovery code, you can use it instead.</p>${btn("Use a backup code", "backup-recovery", "", true)}</details>` : ""),
      registration ? "Send invitation" : "Send reset link", async (f, form) => {
        form.querySelector('button[type="submit"]').disabled = true;
        try {
          const result = await api(registration ? "/register" : "/forgot-password", { name: f.get("name"), email: f.get("email") });
          modal("Check your email", `<p>${esc(result.message)}</p><p><a href="mailto:office@londonpentecostalchurch.org">Contact the church administrator</a> if you need help.</p>`, "Back to sign in", () => close());
          root.querySelector("dialog footer").innerHTML = '<button class="vs-btn" type="submit">Back to sign in</button>';
        } catch (error) { form.querySelector("[data-dialog-error]").textContent = error.message; form.querySelector('button[type="submit"]').disabled = false; }
      });
  }
  function accountLinkScreen(type, token) {
    const verification = type === "verify";
    root.innerHTML = `<section class="vs-login vs-card"><h1>${verification ? "Choose your password" : "Reset your password"}</h1><p>${verification ? "Confirm your email by choosing a password for your church account." : "Choose a new password to regain access to your church account."}</p><form id="vs-account-link">${field("New password", input("password", "", "password", 'required minlength="12" maxlength="200" autocomplete="new-password"'))}${field("Confirm password", input("confirmation", "", "password", 'required minlength="12" maxlength="200" autocomplete="new-password"'))}<p class="vs-help">Use at least 12 characters. A few words together are easier to remember.</p><button class="vs-btn" type="submit">${verification ? "Confirm email & continue" : "Save new password"}</button><p role="alert" class="vs-error"></p></form>${btn("Back to sign in", "sign-in", "", true)}<p><a href="mailto:office@londonpentecostalchurch.org">Contact the church administrator</a></p></section>`;
    root.insertAdjacentHTML("afterbegin", window.LPCTeamAuth.navigation(null));
    root.querySelector("form").onsubmit = async e => {
      e.preventDefault(); const form = e.target, data = new FormData(form), error = form.querySelector("[role=alert]");
      if (data.get("password") !== data.get("confirmation")) { error.textContent = "The passwords do not match."; return; }
      form.querySelector("button").disabled = true;
      try {
        const result = await api(verification ? "/verify-email" : "/email-reset", { token, password: data.get("password") });
        window.history.replaceState(null, "", "#/volunteers");
        root.innerHTML = `<section class="vs-login vs-card"><h1>${verification ? "Waiting for church approval" : "Password updated"}</h1><p role="status">${esc(result.message || "Your password has been updated. Sign in with your new password.")}</p>${btn("Back to sign in", "sign-in")}<p><a href="mailto:office@londonpentecostalchurch.org">Contact the church administrator</a></p></section>`;
      } catch (caught) { error.textContent = caught.message; form.querySelector("button").disabled = false; }
    };
  }
  function recoveryDialog() {
    modal("Reset your password", `<p>Enter the recovery code you saved from My account. It can be used once. If you have no code, contact your church administrator to verify your identity and reset access.</p>` +
      field("Volunteer username", input("username", "", "text", 'required maxlength="80" autocomplete="username"')) +
      field("Recovery code", input("code", "", "text", 'required maxlength="100" autocomplete="off" spellcheck="false"')) +
      field("New password", input("password", "", "password", 'required minlength="12" maxlength="200" autocomplete="new-password"')) +
      field("Confirm new password", input("confirmation", "", "password", 'required minlength="12" maxlength="200" autocomplete="new-password"')),
      "Reset password", async (f, form) => {
        const submit = form.querySelector('button[type="submit"]');
        if (f.get("password") !== f.get("confirmation")) { form.querySelector("[data-dialog-error]").textContent = "The new passwords do not match."; return; }
        submit.disabled = true;
        try {
          await api("/recover", { username: f.get("username"), code: f.get("code"), password: f.get("password") });
          close(); await mount();
          const status = document.createElement("p"); status.setAttribute("role", "status"); status.textContent = "Password reset. Sign in with your new password, then save a new recovery code.";
          root.querySelector(".vs-login").prepend(status);
        } catch (error) { if (form.isConnected) { form.querySelector("[data-dialog-error]").textContent = error.message; submit.disabled = false; } }
      });
  }
  function recoveryCodeDialog() {
    modal("Save a recovery code", `<p>Use this code to reset a forgotten password without email or SMS. Keep it in your password manager or a safe place. Creating a new code replaces the old one.</p>` +
      field("Current password", input("current", "", "password", 'required maxlength="200" autocomplete="current-password"')),
      "Create recovery code", async (f, form) => {
        form.querySelector('button[type="submit"]').disabled = true;
        try {
          const result = await api("/recovery-code", { current: f.get("current"), revision: state.revision });
          state = await api(); render();
          modal("Keep this code safe", `<p>This code is shown once. Copy it to your password manager or write it down somewhere safe. Anyone with this code and your username can reset your password.</p>` +
            field("Your recovery code", `<input class="vs-recovery-code" value="${esc(result.code)}" readonly autocomplete="off" aria-label="Your recovery code">`) +
            `<p>Your username: <strong>${esc(state.actor.username)}</strong></p><p>After using it or changing your password, create a new code.</p>`, "I have saved my code", () => close());
          root.querySelector("dialog footer").innerHTML = '<button class="vs-btn" type="submit">I have saved my code</button>';
        } catch (error) { if (form.isConnected) { form.querySelector("[data-dialog-error]").textContent = error.message; form.querySelector('button[type="submit"]').disabled = false; } else message("Unable to show your code. Create a new recovery code and save it.", true); }
      });
  }
  async function mount() {
    viewedMemberId = null;
    root = document.getElementById("volunteer-app");
    if (!root) return;
    root.innerHTML = window.LPCTeamAuth.navigation(null) + '<p>Loading team access…</p>';
    root.onclick = click;
    root.onchange = async (e) => {
      if (e.target.matches('[data-meeting-recurrence], [data-series-length], [name="startDate"], [name="dayCount"]')) return refreshMeetingPattern();
      if (e.target.matches("[data-user-select]")) {
        root.querySelector('[data-vs="edit-selected-user"]').disabled = !e.target.value;
        return;
      }
      if (e.target.matches("[data-view-volunteer]")) {
        viewedMemberId = e.target.value || null;
        return render();
      }
      if (e.target.matches("[data-personal-profile]")) {
        e.target.disabled = true;
        viewedMemberId = null;
        await save({ action: "link-admin-volunteer", memberId: e.target.value });
        return;
      }
      if (e.target.matches('[name="emergency-member"]')) {
        if (e.target.value === "__add_volunteer__") {
          e.target.value = e.target.dataset.lastValue || "";
          return quickVolunteerDialog("Branch prayer leader", null, "emergency");
        }
        e.target.dataset.lastValue = e.target.value;
        refreshAssignmentChoices();
      }
      if (e.target.matches('[name="emergency-mode"]')) { applyEmergencyMode(); refreshAssignmentChoices(); }
      if (e.target.matches("[data-approval-identity]")) {
        const settings = root.querySelector("[data-new-account-settings]");
        settings.hidden = !!e.target.value;
        settings.querySelectorAll("input").forEach(input => input.disabled = !!e.target.value);
      }
      if (e.target.matches("dialog [name=branch], dialog [name=team]")) refreshMeetingSchedulers();
      if (e.target.matches("[data-slot] select[data-position]")) {
        if (e.target.value === "__add_volunteer__" || e.target.value.startsWith("__enable_role__:")) {
          const memberId = e.target.value.startsWith("__enable_role__:") ? e.target.value.slice("__enable_role__:".length) : "";
          e.target.value = e.target.dataset.lastValue || "";
          const slotId = e.target.closest("[data-slot]").dataset.slot;
          const slot = state.sessions.find(s => s.id === selected).slots.find(slot => slot.id === slotId);
          return quickVolunteerDialog(slot.role, slotId, e.target.dataset.position, memberId);
        }
        e.target.dataset.lastValue = e.target.value;
        refreshAssignmentChoices();
        return;
      }
      if (e.target.dataset.filter) {
        const key = e.target.dataset.filter;
        if (key === "week") {
          if (busy) return;
          if (e.target.value) weekStart = monday(e.target.value);
          return await showCalendarWeek();
        }
        if (key === "branch") {
          branch = e.target.value;
          selected = "";
        }
        if (key === "team") {
          team = e.target.value;
          selected = "";
        }
        if (key === "session") selected = e.target.value;
        render();
      }
    };
    root.oninput = (e) => {
      if (e.target.matches('dialog [name="startDate"], dialog [name="dayCount"]')) return refreshMeetingPattern();
      if (e.target.matches("[data-user-search]")) {
        const list = memberChoices(e.target.value);
        const select = root.querySelector("[data-user-select]");
        select.innerHTML = options(list, "", list.length ? "Choose a user…" : "No matching users");
        select.disabled = !list.length;
        root.querySelector('[data-vs="edit-selected-user"]').disabled = true;
        root.querySelector("[data-user-results]").textContent = list.length + " matching user" + (list.length === 1 ? "" : "s");
        return;
      }
      if (e.target.matches("dialog [name=team]")) refreshMeetingSchedulers();
    };
    try {
      const link = new URLSearchParams(window.location.hash.split("?")[1] || "");
      if (link.has("verify") || link.has("reset")) {
        root.className = "container vs-app";
        const type = link.has("verify") ? "verify" : "reset";
        return accountLinkScreen(type, link.get(type));
      }
      const session = await api("/session");
      accountEmailEnabled = !!session.emailEnabled;
      if (!root.isConnected) return;
      if (!session.actor) {
        root.className = "container vs-app";
        root.innerHTML = `<section class="vs-login vs-card"><h1>Team sign-in</h1><p>Invitation-only access for appointed schedulers and volunteers. Use the login provided by your website administrator.</p><form id="vs-login">${field("Email address or existing username", input("username", "", "text", 'required autocomplete="username"'))}${field("Password", input("password", "", "password", 'required autocomplete="current-password"'))}<button class="vs-btn" type="submit">Sign in</button><p role="alert" class="vs-error"></p></form><div class="vs-login-links">${btn("Forgot password?", "forgot-password", "", true)}</div><p class="vs-help">Accounts are created or invited by the website administrator. Public registration is closed.</p><p class="vs-help"><a href="mailto:office@londonpentecostalchurch.org">Contact the church administrator</a> for help.</p><a href="#/lpcadmin">Website admin sign-in — separate account</a></section>`;
        root.insertAdjacentHTML("afterbegin", window.LPCTeamAuth.navigation(null));
        root.querySelector("form").onsubmit = async (e) => {
          e.preventDefault();
          const form = e.target;
          form.querySelector("button").disabled = true;
          try {
            await api("/login", Object.fromEntries(new FormData(form)));
            const signedIn = await api("/session");
            if (!signedIn.actor)
              throw new Error(
                "Sign-in succeeded, but your browser did not retain the session. Open the private test site in its own browser tab and try again.",
              );
            await mount();
          } catch (error) {
            form.querySelector("[role=alert]").textContent = error.message;
            form.querySelector("button").disabled = false;
          }
        };
        return;
      }
      state = await api();
      tab = link.get("view") || window.LPCTeamAuth.landing(state.actor).view;
      if (root.dataset.usersPage === "true") {
        if (!state.actor.admin) { root.innerHTML = window.LPCTeamAuth.navigation(state.actor) + '<section class="vs-card"><h1>Site administrator access required</h1><a href="#/volunteers">Return to Team access</a></section>'; return; }
        tab = "members";
      }
      if (
        root.dataset.usersPage !== "true" &&
        (state.plannerVersion !== 2 ||
          state.services.some((s) => !s.meetingId)) &&
        (state.actor.admin || state.actor.manage?.length)
      )
        state = await api("/action", {
          action: "upgrade-planner",
          revision: state.revision,
        });
      if (root.dataset?.usersPage !== "true") await ensureCalendarWeek();
      await loadBranchSettings();
      if (!root.isConnected) return;
      render();
    } catch (error) {
      root.innerHTML = `${window.LPCTeamAuth.navigation(state?.actor)}<div class="vs-card"><h2>Unable to load volunteer schedules</h2><p>${esc(error.message)}</p>${btn("Try again", "refresh")}</div>`;
    }
  }
  return { mount };
})();
