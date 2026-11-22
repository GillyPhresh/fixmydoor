# Security release process

Production is gated by owner approval. The security branch may deploy only to the isolated staging project. Confirm production GitHub triggers still watch main immediately before push. Commit only reviewed source/tests/docs; preserve unrelated untracked runtime fixtures.

Build the Node 24 container from the frozen lockfile using `corepack pnpm` (the project pins pnpm 10.4.1) and explicit Prisma generation. Run `corepack pnpm check`, `corepack pnpm test`, Prisma validate/deploy/status on disposable SQLite, full and production dependency audits, Docker artifact inspection and Playwright browser checks. The current dependency lockfile audits clean at all severities; recheck on every release. Synthetic SMTP verifies transactional sends; staging provider credentials stay absent. Verify exact commit/image/deployment, health, privacy, SEO and restart persistence.

## Railway deadline

Phase 5.2 verified the exact read-only plan, current backup state and owner approval scope in [PRODUCTION-TRANSITION.md](PRODUCTION-TRANSITION.md). Use that evidence when preparing the cutover.

Phase 5.3 authorized execution. Railway's backup entitlement check blocked the manual recovery point, so the configuration apply remains gated. Refresh the three-field preview after recovery protection is verified.

Official docs: [Config as Code](https://docs.railway.com/config-as-code) and [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code). Config as Code files stop being read on 2026-12-01. Production migration needs owner approval. On 2026-11-22, read-only Railway inspection showed the live-domain environment's service `fixmydoorservices` on `main`, domains `fixmydoor.ca` / `www.fixmydoor.ca` port 8080, Dockerfile builder/path `/Dockerfile`, `/api/health`, one replica in `us-west2`, and the 500 MB production volume mounted `/data`. The last deployment used `/api/health` timeout 300 and ON_FAILURE/retries 10, values supplied by `main:railway.json`; saved API config omits timeout and restart policy. This confirms a dependency on legacy overrides. The service config returned no explicit resource limit or custom start command; do not infer a sizing value from that absence. Preserve Dockerfile/path, built-in image CMD, health `/api/health` timeout 300, restart ON_FAILURE/retries 10, one replica, `us-west2`, existing limits/defaults, source repo/`main`, variables and `/data` mount. Do not move SQLite migrations into pre-deploy: the runtime volume must be mounted.

Supported migration: in a separately linked, isolated directory, `railway config migrate` can translate the legacy config. Alternatively `railway config pull --variables unmanaged` imports configuration. Keep the authoring SDK isolated from app dependencies. Apply only the three approved fields after the backup prerequisite is met and the fresh plan confirms the exact scope. Verify `/api/health`, both domains, one replica and the existing `/data` mount. Before the cutoff, the prior file-backed settings can still be used to recover effective behavior. After the cutoff preserve the saved settings when rolling back application code. Production `main` retains the legacy file until after the settings transition and separate release approval.

## Local development

`pnpm dev` serves the frontend on loopback; `/api` and `/uploads` proxy to Express on 127.0.0.1:4179. Start `pnpm dev:api` with explicit disposable DATABASE_URL, UPLOAD_DIR, SESSION_SECRET and PORT=4179. Initialize SQLite separately, seed a synthetic admin and leave external integrations unset. Express supplies actual authorization/attachment/tracking behavior; Vite does not implement its own API. Use production Docker browser verification for release privacy headers and route/SEO behavior.
