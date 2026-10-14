# Deployment steps

## GitHub

1. Extract the ZIP. Its root must contain `Dockerfile`, `package.json`, `index.html`, `assets` and `preview-server.mjs`.
2. In GitHub Desktop choose Add Local Repository. Create a repository for this folder if it has no Git history.
3. Review the files, commit, and Publish Repository. A private repository is suitable because the snapshot includes published feed configuration and content backups.
4. Do not upload the ZIP as the website source. Upload/commit the extracted folder contents. Do not commit `node_modules`, `.env`, logs or credentials.

Terminal alternative (replace the remote with your real repository):

```text
git init
git add .
git commit -m "Initial LPC website release"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

## Railway

1. Create a service connected to this repository and the chosen branch. Confirm Source uses this website, not the separate WordPress repository.
2. Let Railway use the supplied Dockerfile. Its command runs `node scripts/start-production.mjs`.
3. Attach a persistent volume mounted at `/data` before first launch. Set `DATA_DIR=/data` and `HOST=0.0.0.0`. Allow the host to set PORT.
4. Configure `LPC_ADMIN_USERNAME`, `LPC_ADMIN_PASSWORD`, and `LPC_ADMIN_SESSION_SECRET`. Use a unique strong password and a separate random session secret. Startup refuses to run if these are absent.
5. Deploy and generate a public domain. Verify all pages, admin login, images, calendar and video previews.
6. Save a harmless admin change and restart. Confirm it survived. The runtime volume stores settings and uploads; it is not present during image build.
7. Add your church custom domain and follow the provider's DNS instructions. Verify HTTPS before sharing the site.

The startup script copies missing packaged data to the volume without overwriting existing files. Live volume settings remain authoritative after first deployment. An initial DATA_DIR backup should be taken before any redeploy or migration.

Source: [Railway volumes](https://docs.railway.com/volumes).

## Microsoft 365 email

Set `CONTACT_MAIL_PROVIDER=microsoft365`, `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` and `MS_MAIL_SENDER` as private hosting variables. A Microsoft 365 administrator must authorise appropriately mailbox-scoped application sending access. The sender must be a permitted mailbox. The fixed recipient is `office@londonpentecostalchurch.org`.

Keep the secret outside Git and chat. Restart after variable changes. Send a controlled test, confirm receipt and test Reply-To before launch. The website's success response means Graph accepted processing; inbox delivery still depends on Exchange.

Source: [Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0). Detailed variables are in CONTACT-EMAIL.md.

## Verification and backups

```text
node scripts/verify-package.mjs
node scripts/verify-http.mjs
node scripts/test-branch-page.mjs
npm run build
```

Back up DATA_DIR (including uploads and backups), the code commit and environment configuration through a secure process. Never restore old JSON over a newer production volume without review. Test restoration on a staging copy.
