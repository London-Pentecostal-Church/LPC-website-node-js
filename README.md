# LPC website — GitHub publishing release

Prepared 13 October 2026. Read [the publishing handbook](docs/ADMIN-AND-PUBLISHING-HANDBOOK.md), [deployment steps](docs/DEPLOYMENT.md), and [admin procedures](docs/ADMIN-PROCEDURES.md). The editable deck is in `docs/LPC-Publishing-and-Admin-Guide.pptx`.

## Run locally

Install Node.js 22 LTS, then run in this folder:

```powershell
npm ci
npm start
```

Open `http://localhost:4173/#/home` and `http://localhost:4173/#/lpcadmin`. Local evaluation defaults: `admin` / `lpc2026`. Set `PORT=4180` if needed. Production must use different server credentials.

## What is included

`assets` contains CSS, JavaScript, images, videos, current JSON settings, uploads and configuration backups. `preview-server.mjs` is the Node server; `worker` holds calendar/email logic and an alternative Worker adapter. `scripts` contains build, verification and production startup scripts. `Dockerfile` supports Railway and other Docker hosts. `ASSET-MANIFEST.json` records sizes and SHA-256 hashes.

Current saved JSON and uploads take priority. Missing referenced originals/fallbacks were recovered from previous local release copies. URLs remain unchanged. This package is separate from the working local site.

## Deployment status

This release has not been deployed to GitHub or a remote host. Microsoft 365 mail delivery still requires credentials, mailbox-scoped authorisation and an actual receipt test. Calendar images are disabled. External providers control YouTube availability and Outlook publishing delays.

Use the Node/Docker deployment. GitHub Pages and static-only hosting do not run the website APIs. The alternative Worker adapter does not have full feature parity with the Node server, including contact email.

## Updating later

GitHub changes update application files through the deployment pipeline. Live admin edits update the persistent data volume; they do not automatically commit back to GitHub. Back up the full `DATA_DIR` and upload files before a hosting move. Preserve `.gitignore`, and store secrets in host variables.
