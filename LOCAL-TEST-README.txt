LPC VOLUNTEER SCHEDULES - LOCAL TEST

1. Install Node.js 20 or later from https://nodejs.org/ if it is not already installed.
2. Extract the entire ZIP into a normal folder on your computer.
3. On Windows, double-click START-LOCAL-TEST.cmd.
   The first run downloads the website's npm dependencies.
   Keep the command window open while testing.
4. Open http://localhost:4173/#/volunteers if the browser does not open automatically.

DEMO ACCOUNTS
Administrator: tester / Lpc-Test-2026!
Service lead: lead.test / LocalTest-2026!
Volunteer: volunteer.test / LocalTest-2026!
Ministry scheduler: pastor.test / LocalTest-2026!

For the administrator, use the "Administrator sign-in" link, or open
http://localhost:4173/#/lpcadmin, sign in, then choose Volunteer schedules.

TRY IT
- As administrator: open Members & Skills, tick roles or service teams, and save.
- As lead.test: select a dated service, edit main/backup volunteers, and save a draft.
- As lead.test: arrange a swap with volunteer.test; choose an exchange date and comment.
- Use a private/incognito browser window to sign in as volunteer.test and accept the swap.
- Return to the lead/scheduler window, Refresh, and open Notifications or Change history.
- Explore Ministry Volunteers and the separate recurring settings for Malayalam/English.

Names and service times are synthetic examples, not the church's actual rota.
Test data is stored separately in .local-test/data and retained between restarts.
There is no live hosting, GitHub publication or WhatsApp/email notification delivery.
The server listens only on your own computer (127.0.0.1).
Press Ctrl+C in the command window to stop it.
To reset the demo, stop the server and delete the .local-test folder.

macOS/Linux: open a terminal in the extracted folder, run "npm ci", then "npm run dev:test".
If port 4173 is busy, close the other local server, or set LOCAL_TEST_PORT to another port.
