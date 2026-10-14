# LPC website publishing and administration

13 October 2026. Node/Docker deployment.

## LPC website Publishing & administration

- GitHub release and editor handbook
- 13 October 2026

This guide describes the Node/Docker release. It does not imply that production email or a remote deployment has been activated.

## Release contents

- Website source, styles, images and homepage video
- Current JSON settings, uploaded assets and configuration backups
- Docker deployment files, dependency lockfile and verification scripts
- Detailed handbook and editable PowerPoint guide

The release excludes credentials, Git history, dependencies and generated build copies. Missing required originals were recovered from previous local packages.

## Website and hosting model

- Visitors load the website and its hash-based page routes
- The Node server provides admin, calendar, media and contact endpoints
- A persistent data directory holds edited settings and uploads
- GitHub stores code; the hosting service runs it

GitHub Pages alone cannot execute these Node endpoints. The alternate Worker adapter is included but is not the documented deployment target for this release.

## Local evaluation

- Install Node.js 22 LTS and extract the ZIP
- Open a terminal in the extracted project folder
- Run npm ci, then npm start
- Open http://localhost:4173/#/home

Local evaluation credentials are admin / lpc2026 unless overridden. If the port is occupied, PowerShell: $env:PORT="4180"; npm start. Environment variables are read from the process; the server does not automatically load .env files.

## GitHub upload

- Create a private repository for this website
- Extract the ZIP; place its contents at the repository root
- Commit the source, assets, lockfile and documentation
- Keep secrets and node_modules outside Git

GitHub Desktop: Add Local Repository, create repository if needed, review changes, commit and Publish Repository. Terminal alternative: git init; git add .; git commit -m "Initial LPC website release"; connect the actual repository remote and push. Do not overwrite a repository containing unrelated site code.

## Railway deployment

- Connect the intended GitHub repository and branch
- The included Dockerfile starts the Node application
- Attach a persistent volume mounted at /data
- Set production variables before the first deployment

Railway volumes mount at runtime. The startup script seeds missing files from the packaged assets/data directory while preserving existing stored files. Source: https://docs.railway.com/volumes

## Production variables

- DATA_DIR=/data and HOST=0.0.0.0
- LPC_ADMIN_USERNAME and LPC_ADMIN_PASSWORD
- LPC_ADMIN_SESSION_SECRET: a separate random secret
- PORT: use the port supplied by the host

Production startup is node scripts/start-production.mjs. It refuses to run without the three admin settings. Use strong unique values in hosting service variables; never commit them. The sample file documents optional calendar and email variables.

## Domain and HTTPS

- Generate a temporary public domain for testing
- Check the website and admin before changing church DNS
- Add the custom domain in hosting Networking settings
- Apply the displayed DNS records and verify HTTPS

Use the domain root so /api and /uploads paths resolve. Verify Settings > Source points to this repository, not the separate WordPress site. No DNS or deployment changes were performed while preparing this package.

## Persistent data

- DATA_DIR contains JSON settings and uploaded files
- assets/images and assets/videos remain bundled site assets
- The production startup seeds missing files only
- A redeploy must retain the mounted volume

After initial deployment the volume is the source of truth for edited settings. Code updates do not overwrite existing volume configuration. A branch JSON export is only part of a complete backup.

## Admin sign-in

- Open /#/lpcadmin on the deployed domain
- Use the username and password set by the hosting administrator
- The server verifies credentials and sets an HttpOnly cookie
- The session cookie lasts up to eight hours; Logout ends the session

The editor exposes one shared administrator account, not individual editor roles or an audit trail. Credentials are not changed inside the website. Use HTTPS, restrict access appropriately, and rotate server variables when required.

## Admin options

- Manage branches and associate pastors
- Manage asset images and image framing
- Page images and hero image/video editors
- Pastor’s Thought and the site header message

These are the current maintenance areas. General page copy, layout and ministry programme text are maintained in source code unless a dedicated editor exists. The calendar itself is maintained in Outlook.

## Branch editor

- Expand a branch card to edit its fields
- Maintain its name, colour, logo, photo and visitor details
- Add YouTube and social links; choose playback behaviour
- Save branches to publish all changes

The branch record also accepts a calendarLabel such as Bexleyheath, South London. That field currently lives in branches.json rather than a dedicated admin control. Export saved JSON and Import JSON allow review before saving.

## Adding and removing branches

- Add branch opens a new editable card
- A saved branch creates its card and themed landing route
- Its hero tile appears in the admin preview area
- Removing and saving removes its public branch and admin hero tile

Branch identifiers are stable keys and form the hash URL. Removing a branch does not automatically delete images or old hero settings. Back up before removing. Existing populated data is protected by revision checks against concurrent saves.

## Branch photos and hero images

- Branch photo provides the default image
- The branch hero editor can override the landing-page image
- Home and Branches cards use the saved hero image first
- A new upload appears only after selection and Save

Separate the upload action from assigning an image. Hero settings support desktop/mobile crops and optional videos. New branch hero tiles follow the saved list; removed branch tiles disappear.

## Hero editing

- Open a page or branch preview tile
- Choose an image or video from the asset picker
- Adjust desktop and mobile focal point, scale and fit
- Save; refresh the public page to confirm the result

Home has its own video/poster configuration. A blank hero video displays the selected image. Cover crops the image; contain preserves the full image; fill can distort it. Use contain for posters with text where appropriate.

## Images within pages

- Open Edit images within pages from main admin
- Expand the page and choose replacements for listed images
- Save page images to apply the selections
- Use separate branch, pastor and hero editors for their images

This editor discovers inline image elements in the selected public page. It excludes footer branding, branch cards, hero sections and team-folder images. It does not expose CSS background images, icons or externally generated YouTube thumbnails.

## Asset library

- Upload files, search by name and filter the list
- Choose library assets in the relevant content editor
- Edit framing to change how an image fits its containers
- Delete only after confirming the file has no active use

The current library metadata may show 0 KB because the Node listing does not include size. Automatic protection in the Node adapter is incomplete for branch, pastor and page-image references; review the manifest and current selections before deleting. Deletion is permanent for uploads.

## Pastors and weekly content

- Manage associate pastors adds, edits and removes profiles
- Maintain each pastor’s name, role, portrait and introduction
- Pastor’s Thought controls the Watch-page encouragement
- Site Header Message controls the anniversary/top-bar text

The weekly thought editor includes heading, body, author, date and call-to-action fields. Review long text on mobile after publishing. Founder or other fixed content may still live in source code.

## Calendar ownership

- Maintain events in Outlook’s Church Events calendar
- Owner supplied: guarantor1@londonpentecostalchurch.org
- Website admin does not create or edit calendar meetings
- Titles, dates, start/end times and locations come from Outlook

The site uses the currently published ICS calendar. The supplied ownership address has not been authenticated through Microsoft Graph. Calendar editors need appropriate access to Church Events in Microsoft 365.

## Calendar publishing

- Outlook Settings: Calendar, Shared calendars
- Publish Church Events with appropriate public detail visibility
- Use the ICS subscription link for the website
- Set LPC_CALENDAR_ICS_URL on the host to replace the feed

The current default is in worker/calendar.mjs. Environment variable overrides it; changing the variable requires restart/redeploy. Keep the published feed URL with authorised maintainers. The HTML view is for people; the .ics URL is used by the server.

## Coming up at LPC

- The feed covers the next 30 days
- Recurring events and exceptions are expanded
- Finished, cancelled and private events are excluded
- Current implementation caps output at 30 event occurrences

The limit applies before grouping. A busy calendar can omit later occurrences in the month when it exceeds 30. Maintain accurate locations and use a distinct event title; a blank title becomes Church event. Times display in Europe/London.

## Calendar cards and colours

- One date and one location produce one tile
- Services show their own start and end times
- Branch matching supplies the label and coloured borders
- South London uses Bexleyheath, South London

Southend-on-Sea matching normalises punctuation and common church words. Use consistent venue names to avoid splitting the same location across tiles. Matching is inferred from branch names/address; there is no explicit event-to-branch ID control.

## Calendar refresh and images

- The server caches a feed result for five minutes
- Refresh the page after the cache expires to see changes
- Cards advance every six seconds with Pause/Play controls
- Calendar image previews and popouts have been removed

Outlook publication can add its own delay. Auto-scrolling pauses on interaction, hover, focus, hidden documents and reduced-motion preferences. A page left open does not automatically refetch event data. No Graph calendar connection has been configured.

## Watch page and YouTube

- Channel links look for live or latest service videos
- A specific video/livestream URL overrides channel lookup
- Muted autoplay works where the browser permits it
- Temporary lookup failures retry and reuse a cached video

The Node adapter caches successful lookups for five minutes and may reuse a prior success for up to roughly one hour after expiry. YouTube controls embed availability and browser autoplay policies. Harlow/Southend without channel details show a coming-soon state.

## Contact email status

- Recipient: office@londonpentecostalchurch.org
- Visitor email becomes Reply-To
- Microsoft Graph delivery code is included
- Live delivery still needs credentials and mailbox authorisation

Set CONTACT_MAIL_PROVIDER=microsoft365, MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET and MS_MAIL_SENDER. Grant appropriately scoped app-only sending access. Graph 202 means accepted for processing, not proven inbox delivery. No real email delivery test has completed. Source: https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0

## Backup and hosting moves

- Back up the complete persistent DATA_DIR
- Keep bundled assets and the exact Git commit
- Export branch JSON for a readable branch snapshot
- Restore into staging and test before switching the domain

Configuration saves create previous-version JSON backups. Asset deletion can invalidate old backups because those backups do not contain deleted image bytes. Volume/provider backups are needed for complete recovery. Keep private recovery copies outside the active site.

## Launch checks

- Every public page and branch route loads on desktop/mobile
- Uploaded images and homepage video display correctly
- An admin edit survives a server restart
- Calendar events and YouTube previews match their sources

Also verify custom-domain HTTPS, sign-in/logout, form validation, actual email receipt and Reply-To, and backup restoration. Local checks do not verify remote DNS, Microsoft authorisation or delivery. Record the chosen repository branch and production variables owner.

## Troubleshooting

- Not found / invalid JSON: check endpoint and deployed version
- Image unchanged: select, save, refresh and check hero override
- Missing event: check date window, location and published feed
- YouTube fallback: retry and inspect channel/video permissions

Server logs should remain private; do not expose credentials. The package contains scripts/verify-package.mjs, verify-http.mjs and test-branch-page.mjs. Restart after changing environment variables. Review CONTACT-EMAIL.md for email errors.

## Maintenance ownership

- Website editors: images, branches, pastors and weekly content
- Calendar editors: Outlook Church Events
- Hosting administrator: deployment, access, email and backups
- Developer: layout, general copy, API changes and release updates

The supplied Node admin is a single shared account. Agree named human owners and a weekly content review, plus a backup and restoration schedule. Repository changes and live content changes follow different update paths.
