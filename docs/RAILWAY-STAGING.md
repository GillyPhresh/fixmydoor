# Isolated Railway staging runbook

This runbook is for the committed FixMyDoor security revision. It does not authorize a Railway deployment, DNS change, or production edit.

## Isolation boundary

Create a **separate Railway project** named for staging, with a single web service built from the Dockerfile and a new, empty volume mounted at `/data`. Do not duplicate the production environment or copy its variables/volume. Railway private networking is isolated by project/environment; a separate project also prevents the staging service from resolving production services over Railway's private network. Keep the service private until the release owner has reviewed the intended public-domain/access configuration.

Use a Railway-provided `*.up.railway.app` domain only for staging browser tests. Do not attach the business domain or edit Namecheap records. No production Google Search Console, email, Resend, SMS, payment, analytics, or customer data should be configured.

## Source and deployment gate

The verified source is branch `codex/fixmydoor-security-p0`, commit `cb325e52baab18ef47c19b27638155d6649dc6b2`. The checkout contains untracked synthetic test fixtures, so deploy only this commit from a clean source snapshot. Before connecting GitHub, inspect the Railway production service's source branch and auto-deploy trigger. Do not push this branch until that check proves it cannot deploy production. If the trigger mapping cannot be inspected, do not connect GitHub or push; request an owner with Railway access to confirm it.

## Service configuration

- Builder: Dockerfile (`railway.json`); start: `pnpm start` via Docker `CMD`.
- Health check: `/api/health`, timeout 300 seconds per `railway.json`.
- Runtime: `NODE_ENV=production`; listen on Railway's `PORT`.
- New persistent volume: mount at `/data` (never reuse production volume).
- Database: `DATABASE_URL=file:/data/fixmydoor.db`; Prisma's checked-in migration history is applied at startup. Attachment rows are stored in SQLite; legacy uploads use `UPLOAD_DIR` if configured, otherwise `/data/uploads` in the production runtime.
- Use fresh, unique values for `SESSION_SECRET`, `STAGING_BASIC_AUTH_USERNAME`, `STAGING_BASIC_AUTH_PASSWORD`, `DEFAULT_ADMIN_USERNAME`, and `DEFAULT_ADMIN_PASSWORD`. Set `STAGING_MODE=true`, `CREATE_DEFAULT_ADMIN=true` only for initial synthetic admin creation, then set it false after first startup. The staging Basic Auth password must be at least 24 characters. Rotate the temporary staging admin password through the app after login.
- Set `PUBLIC_SITE_URL` and `VITE_PUBLIC_SITE_URL` to the Railway staging URL and `ADMIN_URL` to its `/admin` URL. Set `VITE_DISABLE_ANALYTICS=true` in the staging service variables; the Dockerfile declares this as a build `ARG`, so Railway passes it into the Vite build. Do not set `VITE_GA_MEASUREMENT_ID`.
- Leave `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `RESEND_SETUP_AUTOMATION_EVENTS`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `BUSINESS_EMAIL`, `ADMIN_EMAIL`, and promotional provider variables unset. Booking and transactional dispatch must be verified first with the local mocked SMTP suite. Add an isolated mail sink only if the owner approves a separately provisioned staging service.
- Push stays disabled by code. Do not create or copy VAPID values. Promotional dispatch remains suppressed; keep any provider-side campaigns/automations disconnected from staging.

`STAGING_MODE=true` requires Basic Auth credentials, protects all routes except the minimal Railway health endpoint, sends `X-Robots-Tag: noindex`, `Cache-Control: no-store`, and `Referrer-Policy: no-referrer`, serves a disallow-all `robots.txt`, removes Google site verification from rendered pages, and emits noindex HTML metadata. This application guard is defense in depth; use Railway access controls/edge rules if available for the workspace plan, and do not publish the staging URL until access protection has been verified.

## Deployment and verification sequence

1. An owner creates the separate Railway project, web service, and empty `/data` volume. Confirm the project/environment name and that the service has no production variables or resource references.
2. Confirm production source branch/trigger settings without changing them. Only then may the owner authorize connecting the staging project to the verified commit/branch. Set up deployment manually; review the exact staged changes before applying.
3. Set the variable names above with new staging-only values. Confirm `STAGING_MODE=true`, `/data` mount, no production integrations, and no custom business domain.
4. Deploy and inspect build/start logs for successful `prisma migrate deploy`, database compatibility checks, admin initialization, and healthy `/api/health`.
5. Confirm unauthenticated `/` returns 401; Railway health returns healthy with noindex/no-store; authenticated pages use a staging canonical URL, noindex metadata/header, and no Google verification tag. Confirm `robots.txt` disallows `/` and `sitemap.xml` is not submitted to search engines.
6. With synthetic data only, test booking with/without photos, admin login/logout, authorized/unauthorized attachment reads, tracking privacy, push disabled, and transactional email using an isolated sink. Check mobile browser and console/network errors.
7. Restart the service and verify synthetic booking/attachment persistence on the new volume. Re-run `/api/health`, migration status, and the same smoke checks.
8. Retain deployment ID, migration logs, test results, and rollback image reference. Do not point the production domain or production branch to this service.

## Rollback

Rollback only within the staging project to its prior image/deployment. Preserve the staging volume until test evidence is captured. Do not restore a production volume or database. Since migration history may have advanced, do not roll back by replacing the database with a production copy; rebuild an empty staging volume and replay migrations if a clean staging reset is needed.
