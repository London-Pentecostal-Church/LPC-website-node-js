# Code maintenance

The current hosted app includes the public church site, website administration,
invite-only team accounts, pastoral and choir/media scheduling, personal lineups,
availability, cover/exchange requests, audit history and mobile layouts.

## Main files

- `assets/js/site.js`: public pages and website administration.
- `assets/js/volunteers.js`: planner and user-management interface.
- `assets/js/team-auth.js`: shared sign-out and account switching.
- `worker/volunteers.mjs`: scheduling rules, account operations and access checks.
- `worker/volunteer-store.mjs`: hosted storage, session namespaces and optimistic concurrency.
- `worker/index.js`: hosted HTTP routes; `preview-server.mjs` is the local Node adapter.
- `scripts/build.mjs`: configuration, media, backup and runtime packaging.

## Checks

Run `npm test` before deploying. It checks all JavaScript source syntax, account
and scheduler workflows, role boundaries, data persistence, sign-out failures,
packaged runtime imports, browser file parity and the dynamic branch route.
`npm run test:volunteers` remains available for the account and planner tests.
`npm audit` checks dependency advisories. Mail serialization tests use an in-memory
transport and never send email.

For visual changes, check 320px and 390px phone widths as well as desktop. Include
open menus, user selection, assignment dialogs and long names. Keep optional
local duties separate from the critical pastor-in-charge status.

## Refactoring constraints

- Site administrators, pastoral schedulers, choir/media schedulers and volunteers
  retain their existing permissions. Serving skills never grant admin access.
- Volunteers see their own meeting occurrences and related lineups. Account
  registration stays admin-invited and requires approval.
- Preserve `volunteers/state.json`, `volunteers/private/`, configuration and backup
  keys. No schema migration or live-data reset is needed for this cleanup.
- Create a fresh hosted store adapter for each request so ETags cannot leak
  between editors. Do not silently retry or overwrite a conflict.
- Keep the website-admin and volunteer sessions separate; sign-out clears both
  before another account signs in.
- The old bulk-edit API remains supported and tested, but its obsolete browser
  table, draft tracking and CSS were removed after user management became a picker.
- Third-party calendar code and public content are intentionally unchanged.

Further extraction of the large page and action handlers should happen in small
tested steps. Avoid a framework rewrite or merging authentication systems as a
side effect of routine cleanup.
