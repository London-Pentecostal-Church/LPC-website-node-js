# Church Weekly Planner

Open `/#/volunteers` to sign in, or Website admin → **Church weekly planner**.

## Daily use

- **My Week** is the volunteer's starting screen: their own duties and meetings they lead, across all their branches. Each card shows date, time, branch, role, main/backup position and availability. Use **I can attend** or **I need cover**.
- **Pastoral Planner** shows which pastor serves each branch meeting. Only the website administrator or an active volunteer with Pastoral admin access can edit its assignments.
- **Choir & Media** shows the worship, musicians, choir, sound, camera and screen team. The website administrator or an active volunteer with Choir & media admin access maintains the team.
- **Church Meetings** is the common recurring meeting calendar. A meeting is entered once and appears in both team planners. Opening it offers the two team views without mixing their assignments.

Every dated view has Previous week, Next week, This week and Go to date. Desktop uses a seven-day calendar; phones use a day-by-day list with readable names. The same selected week remains when switching planners. Dates and display times use Europe/London. My Week covers all the volunteer's own branches; shared calendars have branch and language filters.

## Coordinator setup

**Coordinator settings** holds Members & skills, Church meetings, the choir/media team setup, and change history. Volunteers do not see administrative setup screens.

The church administrator creates individual volunteer accounts and maintains skills, branch membership and language teams. Passwords must be 12–200 characters. Share initial credentials privately; volunteer password changes and admin resets invalidate older sessions.

The administrator or pastoral scheduler enters the meeting's name, branch, language/team, weekday, London time, duration and initial team leads. Creating weeks creates both team calendars together. Template edits update all upcoming dated meetings in both planners, including dates already generated. Past records are preserved; changed future assignments return to draft and timing changes clear availability. Cancelled dates remain cancelled. Changing or cancelling an individual meeting updates both planners, resets confirmation and notifies schedulers/assigned people. Availability is cleared if its date/time changes. Regenerating dates does not duplicate a meeting that was moved.

Choir & media setup controls its own lead, roles and required places. Pastoral meetings default to one pastor and an optional reserve, assigned directly in the weekly Pastoral Planner; there is no separate Pastoral team setup screen. Pastoral schedulers are selected when creating meetings or in a dated assignment. Optionally apply new requirements to upcoming draft meetings, preserving existing assigned people and slot IDs. Removing a role with assigned people is rejected until those people are cleared. Confirmed meetings are preserved. Pastoral roles and choir/media roles cannot be mixed by the team-setup API.

Opening an unprepared upcoming week automatically fills it for both planners. Past weeks are available for review. No deployment or email/WhatsApp integration is involved in preparing dates.

## Assigning and changing duties

Pastoral meetings use **Assign pastor**; choir/media meetings use **Arrange team**. Main and backup are beside each other on each role row. Save draft or Confirm. All main roles must be filled to confirm; backups are optional. An unavailable person cannot be selected. Overlapping primary duties are blocked with the conflicting meeting’s name, branch, date and time. Reserve overlaps are allowed with a warning so the scheduler can check cover before calling on the reserve. Skills, branches and language eligibility are checked server-side. A person cannot hold multiple duties in the same meeting.

Cover requests require a replacement and a comment recording the agreement. A return duty may optionally be exchanged. The original allocation stays until the recipient accepts. Acceptance rechecks eligibility and conflicts, updates both sides where appropriate, records history and notifies schedulers. The recipient can decline; requester or scheduler can cancel. Resolve pending swaps before editing affected meeting allocations or dates.

**Updates** combines cover requests and in-app notifications. Notifications are fetched on opening/refreshing; external email and WhatsApp delivery are not connected. Practice organisation stays on WhatsApp.

## Existing data and storage

The first scheduler sign-in upgrades legacy separate templates into common meeting records with two team plans. Existing session IDs, assignments, confirmations and availability are preserved. Missing team sides are created as blank drafts. Templates are grouped only when branch, language, weekday, time and meeting name agree; ambiguous meetings are not silently merged. This migration is idempotent and saved under the normal revision/concurrency checks.

Node stores private state under `.private-volunteers/`, or `$DATA_DIR/volunteer-private/`; both are excluded from git and static serving. Worker uses the existing private BUCKET binding. Source and hosted databases remain separate. Back up private state with other site data.

API authentication, eligibility and permissions remain server-side. Mutations check origin and revision. Node serializes and atomically writes updates; the Worker rejects concurrent overwrites with conditional ETags. HTTPS volunteer sessions use HttpOnly/Secure/partitioned cookies for the embedded preview, with strict origin checks; local HTTP uses SameSite=Strict. PBKDF2 password hashes, login rate limits, eight-hour sessions and credential-version revocation remain in place.

This feature is separate from a full security audit of the existing website.

## Checks

`npm ci`

`npm run test:volunteers`

`npm run build`

`node scripts/test-branch-page.mjs`

The automated suite covers authentication, permissions, origins, overlaps, swaps, notifications, persistence, shared-calendar migration, paired date changes, role separation, safe requirement changes and recurring date idempotence. Browser checks use synthetic fixtures to inspect desktop and phone layouts, week navigation, date jumps and separate meeting/team views. The fixture pages are local QA files and excluded from deployment.

## Serving skills versus scheduling access

Members & Skills has separate columns for Roles they can do and Scheduling access. Pastor is a serving skill only; it does not grant scheduling rights. Pastoral admin grants management of the pastoral planner; Choir & media admin grants management of the choir/media planner. Both may be selected independently, together, or neither. The same controls appear in the individual volunteer editor. Only the website administrator can grant or remove these rights, and the single Save all changes button persists explicit choices without inferring permissions from skills. Existing permissions are displayed as stored and are not automatically changed by this UI update.

The volunteer list uses one Save all changes action. Edited rows and an unsaved count identify pending changes; the sticky footer keeps Save all changes and Discard changes visible. Search and navigation retain pending checkbox selections. All edited volunteers are validated and saved in one revision, so an invalid row or concurrent update prevents the whole batch from being applied. Names, credentials, availability and meeting assignments are not rewritten by the bulk list save.

Scheduler and team-lead dropdowns use active members’ Scheduling access (`manage`), independently of serving skills. Pastoral requires `ministry`; choir/media requires `service`. Meeting-specific scheduler choices also require the meeting’s service team and branch; serving skills do not grant or restrict administrative rights. Existing lead IDs do not grant editing permission after access is revoked. Role assignments continue to require the relevant skill, branch and team.

## Membership rules

- Duty candidates (main, backup, cover and return exchange): active, matching serving role, service team and branch. Scheduling access is not required to serve. Unavailable people are excluded and the server checks overlaps and duplicate duties.
- A scheduler selected for a meeting: active, matching Scheduling access, service team and branch. Serving skills are irrelevant to that administrative selection. A worship lead singer is a serving role and does not grant admin rights.
- Scheduling access grants administration for that planner. Personal serving skills/team/branch do not restrict the administrator’s ability to administer other volunteers. Only the website administrator manages member accounts and access grants. Pastoral and choir/media admin remain independent.
- Inactive accounts cannot sign in or be newly selected. Existing records are retained. Upcoming ineligible assignments show Needs review and disabled replacement warnings; saved history is not silently rewritten. Personal duties remain visible after a branch/team change so outstanding commitments are not hidden.
- New meeting dates do not copy a scheduler who is no longer active or eligible. Meeting-creation scheduler choices refresh when branch or team changes. All known branches are available in the member editor.

Automated membership matrix tests compare UI candidates with the API for both planners and both primary/backup positions, independently varying skills, teams, branches, access and active status. Cover acceptance rechecks changed membership; generation and retained-duty visibility are covered too.

## Audit archive and retention

Change history keeps a rolling 30 days by default. The website administrator can set 1–3650 days under Change history → Retention settings. Settings and explicit cleanup require a confirmation and the normal revision check. A shorter window permanently deletes expired audit entries; this does not delete meetings, assignments, members, swaps or notifications.

Expired entries are hidden from the normal report, counted for administrators and physically removed on the next successful planner mutation. No background timer or midnight job is required; cleanup runs as the planner is used. An administrator can also use Delete expired history immediately. Cleanup and retention changes themselves are audited.

Download archive exports all audit entries still physically present, including expired entries awaiting cleanup, as JSON with a timestamp, revision and ID/name directory. It contains no credentials. Download before changing retention or deleting expired history if an offline copy is needed; already deleted records cannot be recovered by increasing retention. Archive export is read-only and website-admin only.

Overlap validation distinguishes primary from reserve in allocations, date changes and cover/exchange requests. A reserve does not block a primary duty elsewhere. Same-meeting duplicate duties remain disallowed.

Clash warnings and server validation errors link to the conflicting meeting. Opening a clash reloads current data, retains the original allocation choices in memory and offers a return control. Saving the conflicting allocation returns to the original unsaved choices; concurrent changes to the original discard that stale draft and request review. Deleted, cancelled and parentless dated records do not block new duties. A surviving demo series is treated as real stored data and is never removed solely by name.

## Series lifecycle and test-data cleansing

Edit a regular meeting to synchronise its upcoming dates, names, branch, service team, time and duration in both planners. Saving an unchanged pattern also aligns stale dated entries with that pattern. Upcoming means not yet started in Europe/London time; past/started occurrences are never changed by a series edit. Assignments and IDs are retained, updated occurrences return to draft, timing changes reset availability, pending cover requests are cancelled with notification, and cancellation status is preserved. Weekday changes keep paired lanes together and regeneration does not duplicate those dates.

Delete series ends the pattern and removes all upcoming dates, assignments, availability and related swaps in both planners. Past occurrences and their parent metadata are kept, so history remains browsable; ended series cannot generate more dates and are hidden from regular setup. This is separate from the 30-day change-log retention policy.

Website administrators alone see Church Meetings → Ended series · preserved history → Cleanse past test data. Explicit confirmation, typing DELETE and a reason are required. This removes that ended series’ remaining dated records and related details, including associated audit snapshots, and records the cleansing action. It does not delete volunteer accounts or unrelated series. No records are automatically classified as disposable by a DEMO name.

## Automatic recurring calendar

Regular meetings appear without Create weeks or Prepare week. Initial sign-in, Refresh and Previous/Next/Go to date ensure missing upcoming occurrences for the selected week in both planners. Any signed-in volunteer may trigger this fixed-pattern preparation; it cannot edit templates or assignments. Existing entries, cancellations and moved-date anchors are retained. An already-prepared week does not write another revision. Historical browsing never invents past meetings, and ended series never return.

The website admin landing page now groups common tasks into clear shortcut tiles. Associate pastor profiles use the existing website photos in two columns on desktop, with one-click detail editors and one Save all changes action; phones use one column. Branch admin shows solid square colour wells with the hex value and a swatch on each branch header. These colour controls remain the source of the planner branch themes.

Reinstating or changing a dated meeting saves both planner lanes as drafts without requiring old assignments to remain eligible. The restored meeting opens directly for volunteer review. Old assignments are retained and marked for replacement; confirmation still validates roles, teams, branches, availability and primary overlaps. The reinstatement dialog defaults to restoring rather than cancelling and supplies an editable reinstatement comment. Close and Cancel leave the draft form without saving.

### Compact weekly planner

The shared meetings, pastoral and choir/media planners show a seven-day summary strip. Empty dates take only a small summary cell; they do not create blank calendar columns. Dates with meetings appear automatically below, in chronological order, with meeting cards across the available width. Selecting a populated date jumps to its heading without hiding other dates or changing filters. Team allocation still opens directly from each card. The grid adapts to the available screen width and retains each branch's configured colours.

### Volunteer password recovery

Website-admin credentials and planner-volunteer credentials are separate. Deployment uses the persisted R2 volunteer state when present and does not intentionally reset passwords. The embedded demo state is used only when that object is absent; it is not an account recovery mechanism. An invalid login by itself does not establish that passwords were reset.

Website admins create volunteer accounts with an initial password and independently grant serving eligibility and scheduling access. Volunteers change their own password. Under My account → Recovery code, a volunteer verifies their current password, creates a random 128-bit personal code and saves it offline. It is displayed once; generating another replaces the previous code. Users without a code see a setup reminder.

Forgot password accepts the volunteer username, saved code and a new password entered twice. No email/SMS provider is required. Only a SHA-256 digest of the high-entropy recovery code is stored, never the code itself; it is excluded from API member and actor data. Codes are single use. Successful recovery changes the password salt/hash and authentication version, invalidates all existing volunteer sessions, removes the code, records an audit event and adds an account notification. The user signs in normally and creates a new code. Normal password changes and admin password resets also invalidate saved codes. Account edits without password changes preserve them. Recovery does not reactivate inactive accounts or grant additional permissions. Client/account attempt limits and same-origin checks apply; conditional state writes prevent simultaneous successful use of a code in the hosted adapter.

If both password and code are lost, the church website administrator must independently verify identity, then set a replacement password through volunteer management. The website-admin account itself uses deployment credentials and is not covered by this volunteer recovery mechanism. There is currently no TOTP/authenticator integration.

Security boundary: passwords use salted PBKDF2-SHA256 (100,000 iterations); this is not a complete security audit or production hardening sign-off. Names, branch memberships, assignments and comments are application-readable JSON in private R2 storage. Cloudflare supplies storage encryption at rest and HTTPS in transit, but this does not make data unreadable to an attacker who obtains authorised application/bucket access. Additional application-level encryption would require separately managed keys, migration/backup/rotation procedures and careful testing. A fully compromised running application may still read the data it is authorised to decrypt. Do not describe this as end-to-end encryption or guaranteed protection after compromise.

### Simple email accounts

The normal volunteer experience is now Create account → name/email → emailed link → choose/confirm password → church-admin approval. Passwords are chosen only after possession of the emailed token, avoiding a registration that preloads an attacker-selected password for someone else's mailbox. Email confirmation alone grants no planner access. Self-registration never sets serving eligibility, branch/team membership or scheduling access.

Website admins see an Account requests count and verified requests under Members & Skills. Review & approve can either link the request to an existing, not-yet-email-verified volunteer (preserving their ID, assignments and permissions) or create a volunteer and set all eligibility/access fields in that same dialog. Linking requires the administrator to independently verify the person; name similarity never links accounts automatically. Existing usernames/passwords continue working until an admin deliberately links that volunteer's new email account. After linking, email becomes the username and the password chosen by the email owner takes effect. Registration cannot replace an already verified account.

Confirmation links expire after 24 hours. Unverified expired requests are pruned on registration; verified requests awaiting approval expire after 30 days. The pending queue is capped at 200. Only verified, unexpired requests appear to website admins; all pending credentials and token hashes are excluded from every public planner/session view. Declining a request leaves existing volunteer records untouched. Approval commits before an approval email is attempted; notification delivery failure is shown to the admin without rolling back access or losing the request's completed status.

Forgot password uses an email address and returns the same response for known/unknown addresses. Only active accounts with a verified email can receive reset links. Links expire after 30 minutes; new requests replace previous tokens. Reset signs out all sessions, invalidates saved backup codes, keeps serving/admin permissions intact, and records an audit event. Token hashes are private; plaintext tokens are sent only in the relevant email and held transiently in the browser URL fragment, not query parameters sent to the server. GET/page loads and email security scanners do not consume links; the owner must submit the password form. Conditional state writes prevent double consumption in hosted storage. Public endpoints have per-client/account attempt limits and same-origin protection. Backup-code recovery remains an optional alternative, not a setup requirement.

Transactional email uses the Resend HTTPS API, with a verified sender domain. Runtime settings (never source-control secrets): `RESEND_API_KEY` as a secret, `ACCOUNT_MAIL_FROM` as a bare verified email address, and `ACCOUNT_PUBLIC_URL` as the exact HTTPS site origin, with no path, query or fragment. The configured origin, rather than an incoming Host header, supplies email links. The new account-mail module is included in both the Node adapter and Worker build. No integration with Microsoft/Google Authenticator or SMS is required. Sending limits and delivery depend on the provider's selected plan. A 2xx provider response means accepted for sending, not proof of inbox delivery.

Until sender configuration exists, account-email submissions return an honest unavailable message; no mock verification, auto-approval or fake successful email is used. Website-admin credentials remain separately managed deployment settings and are not reset by this volunteer-email feature. This does not provide application-level encryption or remove the private test Site's owner-only ChatGPT access gate.

### Pastoral-first meeting readiness

Meeting readiness is computed on the server across the pastoral and choir/media records of the same occurrence. It is separate from whether either team's saved allocation is draft or confirmed. All planners receive the same readiness:

- **Pastor needed:** no valid primary pastor or explicit emergency prayer-leader cover. A reserve alone does not count.
- **Can go ahead:** at least one eligible, allocated primary pastor who has not marked themselves unavailable and has no conflicting primary duty at another meeting.
- **Prayer leader covering:** a pastoral scheduler explicitly recorded a qualified branch prayer leader and a reason, with no primary pastor selected.
- **Cancelled:** overrides readiness.

Choir/worship lead cover uses the serving role `Lead singer`, not the scheduling/admin `leadId`. Missing choir-lead cover is a separate secondary follow-up. Other empty choir/media places remain visible for local coordination, but do not block the meeting or prevent confirming a partial team plan. Existing invalid or clashing assignments still must be corrected or cleared; relaxing completeness does not relax eligibility or conflict rules. Confirming a pastoral plan requires one primary pastor or valid emergency cover; confirming a choir/media plan does not imply the meeting has pastoral cover. The detail view explicitly labels the team's Draft/Confirmed allocation separately from the meeting's readiness.

Emergency cover is under Pastoral Planner → meeting → Emergency pastor cover (rare). Admins first mark suitable volunteers with `Branch prayer leader` under Roles they can do, plus eligible branches and service teams. The pastoral scheduler selects one, records a mandatory reason and saves/confirms. This is not an automatic promotion to Pastor or an admin-rights grant. Only pastoral scheduling access (or website admin) can record it. The selected emergency leader cannot also be the meeting's reserve and must pass active/role/branch/team/availability/primary-clash checks. It is stored separately from pastor slots, included in audit and update notifications, and counted as a primary commitment for clashes. Their My Week includes the emergency duty and allows them to report unavailability; doing so resets the pastoral plan to draft, notifies the scheduler, and causes meeting readiness to show Pastor needed. Returning to normal pastoral cover means turning off emergency cover and selecting the pastor. Past assignments are not rewritten.

### Availability feedback

The former I can attend control records future availability to serve at that specific dated meeting; it does not allocate a role or mark actual attendance. The initial action is now Confirm I’m available. Once saved, the control becomes a persistent green ✓ I’m available status (not another clickable save), with a specific success message. Assigned-person availability is also labelled Available to serve in the allocation view. A changed positive response from an assigned volunteer or meeting scheduler notifies the relevant schedulers in the app. Repeating the same response does not duplicate availability notifications. Marking an assigned person unavailable still resets the plan to draft and prompts cover. No email/SMS delivery is implied.

### One volunteer covering multiple roles

Small/new branches may allocate the same eligible volunteer to multiple roles within the same meeting. No special override or branch setting is needed. Each role still requires its own serving skill, branch/team eligibility and availability. Main and reserve within one role must be different people; another role's main/reserve selections no longer hide that volunteer. Primary clashes with genuinely different overlapping meetings remain blocked.

Cover and exchange requests follow the same rule: a person already covering another role in that meeting may accept an additional eligible duty, but cannot become both main and reserve of the duty being changed. Exchanges consider any primary duties retained in the original meeting; swapping one of several duties does not allow the person to accept a conflicting meeting elsewhere. My Week lists all of the person's roles, and I need cover asks which duty needs replacing when they have more than one.

### Add a missing volunteer without leaving the allocation

Every serving-role dropdown (including emergency prayer-leader cover) has a + Add volunteer… option. Selecting it captures current primary/reserve choices, scheduler selection, comment and emergency-cover fields in memory. The short inline form uses the current role, branch and service team; the scheduler enters the person's full name and explicitly confirms they can serve in that role. Save person & continue creates a no-login volunteer profile, selects them in the original dropdown and restores the rest of the unsaved allocation. The user then saves/confirms that team's assignments normally. Cancel, Close and Escape return to the original draft without creating a person or dropping earlier choices. Requests in progress prevent double submission/cancellation races. Draft state is not written to browser storage.

Only a scheduler with matching scheduling access or the website admin can create the scoped profile. Submitted admin rights, login credentials, arbitrary branches/teams and unrelated roles are ignored; the new person receives just the explicitly selected serving roles and meeting's branch/team, active status, and no Scheduling access. Profile creation itself does not submit or overwrite allocations. Their login can be established separately by the email registration/approval flow. Existing names require explicit selection rather than silently creating duplicates or guessing identity. Choir/media schedulers can explicitly confirm additional meeting-specific choir/media skills for an active person already eligible for that branch and service team. Extending existing branch/team eligibility or pastoral capabilities requires the website administrator. Existing admin rights and other details are retained. Inactive volunteers are not silently reactivated. The normal admin profile form can edit a no-login profile while leaving username/password blank.

Concurrent changes remain protected by the normal revision check. If the revision changed while adding, nothing is created and the error stays in the inline form; unsaved choices remain in memory. An account/session change clears this temporary draft. The final assignment save still enforces all role, branch/team, availability, reserve and other-meeting clash rules.

### Immediate reuse across role lists

After inline add/update, every allocation dropdown is rebuilt from the returned member list while the allocation draft stays intact. The add-person form offers optional additional roles from the current meeting: record only capabilities explicitly confirmed by the scheduler. A camera-only volunteer is not silently granted screen/sound/pastoral skills. In choir/media dropdowns, other active members of the same branch/team who lack the target skill appear as Name · enable for Role…; selecting that opens the same inline capability-confirmation form with the existing person selected. After confirmation, the serving skill is recorded and the person is selected immediately in the target role. The same person can remain assigned to camera and screen at once. Inactive/unavailable people remain excluded; other branch/team restrictions, pastoral capability and Scheduling access remain protected. No additional profile, login or admin rights are created for an existing person.
