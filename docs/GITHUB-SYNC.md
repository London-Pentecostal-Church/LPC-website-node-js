# GitHub source sync - 27 October 2026

This checkout includes the latest published LPC website source (Site version 52,
source commit `e28dae7865baeb517152aad69fd58e8e1c9c6cd8`). It includes the weekly
planner, role-based access, return navigation, meeting editing, compact mobile
cards, and image/video serving fixes.

The eight public website configuration files in `assets/data/` were refreshed
from the hosted website. Uploads referenced by those settings are bundled under
`assets/data/uploads/`, including the current ministries and branches banners,
pastor group photo, and Southend images. Existing packaged media remains present.
`ASSET-MANIFEST.json` records file sizes and SHA-256 checksums; run
`node scripts/verify-package.mjs` to regenerate it and check local references.

Production volunteer records, accounts, credentials, sessions, and private R2
data are not exported to GitHub. Unreferenced hosted uploads and runtime backups
remain in hosted storage. Public media/settings changes made after this snapshot
must be synced again.

Install with `npm ci --ignore-scripts`, validate with `npm test`, and build with
`npm run build`. Runtime environment secrets must be configured separately.
Pushing this repository does not itself deploy the ChatGPT-hosted Site.
