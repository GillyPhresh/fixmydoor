# Isolated Railway staging runbook

This runbook covers the authorized deployment of FixMyDoor security staging. Production, its domain, environment, services, volumes, and data remain out of scope.

## Isolation boundary

Create a **separate Railway project** named `FixMyDoor Services - Staging`, with environment `staging`, service `fixmydoor-staging`, and a new, empty volume mounted at `/data`. Do not duplicate the production environment or copy its variables/volume. Railway private networking is isolated by project/environment; a separate project also prevents the staging service from resolving production services over Railway's private network. Configure application Basic Auth before connecting the public Railway domain.

Use a Railway-provided `*.up.railway.app` domain only for staging browser tests. Do not attach the business domain or edit Namecheap records. No production Google Search Console, email, Resend, SMS, payment, analytics, or customer data should be configured.

## Source and deployment gate

Publish the reviewed commit on branch `codex/fixmydoor-security-p0` to `GillyPhresh/fixmydoor` using a normal push. Before pushing, record the final local commit and confirm the remote `main` ref has not changed. Do not include local synthetic fixtures, private runtime files, databases, WAL/SHM files, environment files, or secrets.

Railway metadata showed the domain-serving FixMyDoor service connected to `GillyPhresh/fixmydoor` branch `main` with auto-deploy enabled. A second service in the separately named `production` environment also has a GitHub trigger for `main`. A push to a dedicated staging branch does not match those triggers. Confirm the environment naming with the owner before release; do not rename or change either environment as part of staging setup.

Railway is deprecating `railway.json`/`railway.toml` config-as-code: existing services may use it only until 2026-12-01, and new services cannot opt into that mechanism. For a newly created staging service, configure Dockerfile builder, health check `/api/health` (300-second timeout), and restart policy in Railway service settings and verify them in deployment details. Do not assume this repository's `railway.json` will configure a new service.

## Service configuration

- Builder: Dockerfile, selected in Railway service settings; the Dockerfile starts `pnpm start` (`node dist/index.js`).
- Health check: `/api/health`, timeout 300 seconds, configured in Railway service settings.
- Runtime: `NODE_ENV=production`; listen on Railway's `PORT`.
- New persistent volume: mount at `/data` (never reuse production volume).
- Database: `DATABASE_URL=file:/data/fixmydoor.db`; Prisma's checked-in SQLite migration history is applied at startup. A mandatory production migration failure aborts startup before the HTTP server listens. Attachment rows are stored in SQLite; legacy uploads use `UPLOAD_DIR` if configured, otherwise `/data/uploads` in the production runtime.
- Use fresh, unique values for `SESSION_SECRET`, `STAGING_BASIC_AUTH_USERNAME`, `STAGING_BASIC_AUTH_PASSWORD`, `DEFAULT_ADMIN_USERNAME`, and `DEFAULT_ADMIN_PASSWORD`. Set `STAGING_MODE=true`, `CREATE_DEFAULT_ADMIN=true` only for initial synthetic admin creation, then set it false after first startup. The staging Basic Auth password must be at least 24 characters. Rotate the temporary staging admin password through the app after login.
- Set `PUBLIC_SITE_URL` and `VITE_PUBLIC_SITE_URL` to the Railway staging URL and `ADMIN_URL` to its `/admin` URL. Set `VITE_DISABLE_ANALYTICS=true` in the staging service variables; the Dockerfile declares this as a build `ARG`, so Railway passes it into the Vite build. Do not set `VITE_GA_MEASUREMENT_ID`.
- Leave `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `RESEND_SETUP_AUTOMATION_EVENTS`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `BUSINESS_EMAIL`, `ADMIN_EMAIL`, and promotional provider variables unset. Booking and transactional dispatch must be verified first with the local mocked SMTP suite. Add an isolated mail sink only if the owner approves a separately provisioned staging service.
- Push stays disabled by code. Do not create or copy VAPID values. Promotional dispatch remains suppressed; keep any provider-side campaigns/automations disconnected from staging.

`STAGING_MODE=true` requires Basic Auth credentials, protects all routes except the minimal Railway health endpoint, sends `X-Robots-Tag: noindex`, `Cache-Control: no-store`, and `Referrer-Policy: no-referrer`, serves a disallow-all `robots.txt`, removes Google site verification from rendered pages, and emits noindex HTML metadata. This application guard is defense in depth; use Railway access controls/edge rules if available for the workspace plan, and do not publish the staging URL until access protection has been verified.

## Deployment and verification sequence

1. Recheck production source branches and triggers without changing them. Both FixMyDoor deployment triggers must remain on `main`.
2. Create the separate Railway project, `staging` environment, app service, and empty `/data` volume. Confirm there are no production variables or resource references.
3. Configure Dockerfile builder, `/api/health` health check (300-second timeout), one replica, and restart policy in Railway's supported service settings. Do not rely on `railway.json` for a new service.
4. Generate the Railway-provided domain. Set fresh staging-only values for the variables above, using that domain for all public URL settings. Keep email, SMS, marketing, payment, analytics, and push integrations disconnected.
5. Connect the app service to the verified commit on `codex/fixmydoor-security-p0`; inspect build/start logs for successful `prisma migrate deploy`, database compatibility checks, admin initialization, and healthy `/api/health`.
6. After the synthetic administrator is initialized, set `CREATE_DEFAULT_ADMIN=false` and redeploy. Confirm the staging domain remains protected by Basic Auth.
7. Confirm unauthenticated `/` returns 401; health returns only operational status with noindex/no-store; authenticated pages use the staging canonical URL, noindex metadata/header, and no Google verification tag. Confirm `robots.txt` disallows `/`.
8. With synthetic data only, test booking with/without photos, admin login/logout, authorized/unauthorized attachment reads, tracking privacy, push disabled, promotional sends disabled, and customer communications without real delivery. Check mobile layout and browser console/network errors.
9. Restart only the staging service and verify synthetic booking/attachment persistence on its new volume. Re-run `/api/health`, migration checks, and smoke tests.
10. Record the deployed commit SHA, deployment ID, migration logs, test results, resource configuration, and rollback image. Do not point the production domain or production branch to this service.

## Rollback

Rollback only within the staging project to its prior image/deployment. Preserve the staging volume until test evidence is captured. Do not restore a production volume or database. Since migration history may have advanced, do not roll back by replacing the database with a production copy; rebuild an empty staging volume and replay migrations if a clean staging reset is needed.
