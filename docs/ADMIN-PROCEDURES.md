# Admin procedures

## Access

Open `YOUR_DOMAIN/#/lpcadmin`. Sign in with the account configured on the server. The Node implementation has a shared administrator account and an HttpOnly, SameSite=Lax cookie with an eight-hour maximum age. Logout revokes the session. Password changes require host variables, not the admin UI. Production should run behind HTTPS.

## Branches

Open Manage branches, expand a branch card and edit its fields. Save branches publishes the list. Add branch creates a draft card; name, church name and colour are required. A saved branch creates its public themed route and admin hero tile. Remove branch requires confirmation, then Save branches applies removal. Removed branches leave their image files intact.

Maintain logos, visitor address/service/contact details and social/channel URLs here. A specific YouTube video URL overrides the dynamic channel preview. Muted autoplay or click-to-play is selectable. Export saved JSON downloads the saved state; Import JSON stages changes for review and requires Save. Revision checking rejects saves based on outdated branch data. Check backups for missing details fills only blank address, service and contact fields after review.

The calendar's special location label currently uses `calendarLabel` in branches.json; South London has `Bexleyheath, South London`. This optional field is not exposed as a dedicated form input.

## Hero images and video

The main admin shows page and branch preview tiles. Branch tiles follow the current branch list. Open a tile, choose a library image or upload, then save. Upload alone does not change any page. Hero settings include desktop/mobile image, focal point, scale, fit and optional video. Home has separate video and poster settings.

Home/Branches listing cards use the saved branch hero image first, with branch photo as fallback. Cover crops; contain preserves the full image; fill can stretch it. For banners containing text, check mobile cropping carefully. Refresh the public page after saving.

## Other page images

Edit images within pages groups discovered inline page images by page. It excludes heroes, branch cards, footer branding and team-folder portraits. Use the relevant dedicated editor for those. CSS backgrounds, icons and third-party video thumbnails are not included. Choose replacements then Save page images. A change is scoped by page and original image reference.

## Asset library and framing

Upload image adds a file to the library. Search and filters help locate it. Edit framing changes fit, horizontal/vertical position and vertical shift for that image wherever global framing applies. Save framing stores settings with a previous-version backup.

Deletion is permanent for uploaded files. Do not rely only on the Unused filter: Node asset protection does not currently cover every branch, pastor and page-image reference. Check current JSON and the manifest first. The Node library currently displays 0 KB for some assets because size metadata is missing; use ASSET-MANIFEST.json for actual sizes.

## Pastor profiles, thought and header

Manage associate pastors edits name, role, portrait and introduction; adding/removing updates profiles after saving. The founder and fixed page content may still require source edits. Pastor's Thought maintains Watch-page encouragement, author, date and call-to-action. Site Header Message maintains the top-bar slogan. Review desktop and mobile after publishing.

## Calendar maintenance

Events live in Outlook's Church Events calendar, owned by the supplied `guarantor1@londonpentecostalchurch.org` account. Create/edit titles, dates, start/end times, recurrence and locations there. Calendar editors need appropriate Microsoft 365 access.

Publish through Outlook Settings > Calendar > Shared calendars. The website reads the ICS feed, with the current default stored in worker/calendar.mjs. Change `LPC_CALENDAR_ICS_URL` in host variables to replace it, then restart. Do not use the HTML calendar link as the feed.

The server caches five minutes; the public page needs refresh to fetch changes. Outlook can delay publishing. It expands recurrence and exceptions; excludes ended, cancelled, private and confidential events; displays Europe/London time; and shows the next 30 days, currently limited to 30 occurrences before grouping. A busy calendar can therefore omit later events. One local day plus one consistent location creates one tile. Branch names/address determine inferred colour matching. Use consistent locations and meaningful titles; a blank title shows Church event.

Calendar images and popouts are disabled. Maintain date/time information in Outlook only. Cards scroll automatically every six seconds and pause during visitor interaction. Pause/Play and arrows remain available; reduced-motion preference disables automatic scrolling.

## Watch previews and troubleshooting

Channel lookup tries live then latest service. The Node server caches success for five minutes and can reuse a recent success during lookup failure; the browser retries once. Video availability, embedding and autoplay depend on YouTube/browser policies. An unconfigured branch displays Videos coming soon.

An invalid JSON/Not found error usually means the running server lacks the expected endpoint or a different version is deployed. Check the deployed source and server logs. An unchanged image usually means it was uploaded without selecting/saving, a hero override remains, or the browser needs refreshing.
