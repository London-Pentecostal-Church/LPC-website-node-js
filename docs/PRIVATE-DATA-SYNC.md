# Sync private users and meeting cards to localhost

GitHub carries application code and public media. The live planner database is a
separate private snapshot: users, password hashes, serving roles, scheduling
permissions, regular meetings, occurrences/cards, assignments, availability,
cover requests, notifications and audit history.

1. Sign in as the website administrator on the live site.
2. Open **Users & access → Private backup & local sync → Download private planner backup**.
3. Keep the downloaded JSON outside GitHub, preferably in the local checkout's
   ignored `.private-volunteers` directory. Do not email it or attach it to a PR.
4. Stop the local website server. In the checkout, run:

   ```powershell
   npm run data:import -- "C:\path\to\lpc-private-planner-backup.json"
   ```

5. Restart the local website. Existing volunteer usernames and passwords now
   work against the imported snapshot. Roles, meetings and assignments match
   the live snapshot. Existing local data is saved beside the restored state
   before replacement, and old local volunteer sessions are invalidated.

If the local server uses `DATA_DIR`, set the same environment variable when
running the importer; it writes `DATA_DIR/volunteer-private/state.json`.
Otherwise it writes `.private-volunteers/state.json` beside `package.json`.

This is a one-way snapshot restore, not a live two-way database connection.
Local edits remain local. Repeat export/import when a newer live snapshot is
needed. A restore replaces the local planner; it does not merge conflicting edits.

Website-administrator credentials and hosting secrets are separate environment
settings and are not included. Active login sessions, verification links and
hosted site sharing permissions are not copied. Users sign in again locally.
Passwords are preserved as salted hashes, never exported as plaintext.

Only a website administrator can export the full database. Backup downloads
have `Cache-Control: no-store`; ordinary volunteer and scheduler responses remain
filtered and never expose password hashes.
