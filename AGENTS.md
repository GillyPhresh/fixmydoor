# FixMyDoor engineering guide

## Project shape

- React and TypeScript client built with Vite (`client/` and `shared/`).
- Express and TypeScript server in `server/`, bundled by esbuild to `dist/`.
- Prisma with SQLite; production and staging persistence belongs on a Railway volume mounted at `/data`.
- Docker is the deployed runtime. Check `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `Dockerfile`, and `railway.json` before changing toolchain assumptions.

## Data and security boundaries

- Treat booking details, tracking tokens, attachments, admin notes, and runtime files as private customer data.
- Keep customer attachments outside public website assets. Enforce ownership and staff authorization on the server; never use a static URL as authorization.
- Customer tracking responses must use explicit public-field allowlists. Keep tokens out of analytics, logs, caches, and referrer headers.
- Keep visitor events separate from administrative data. Web Push remains disabled unless its credentials, subscription authorization, delivery destination checks, and admin-only behavior are reviewed.
- Transactional service communication is distinct from marketing. Do not connect or enable promotional sends without explicit contact-level consent and owner approval.
- Never print, commit, copy, or test with production secrets or customer records. Use synthetic fixtures and mocked outbound providers.

## Development workflow

- Start with `git status --short --branch`; preserve existing untracked files and work only on the authorized feature branch.
- `main` is connected to Railway deployment triggers. Recheck live Railway source and triggers before any push or release; do not push or merge to `main` without explicit release authorization.
- Do not run migrations, file operations, messaging, or integrations against production. Use an isolated staging project and a new empty `/data` volume.
- Respect the checked-in lockfile and package-manager pin. Use `corepack pnpm` to select the pinned `pnpm@10.4.1`; do not let package-manager compatibility checks purge or reinstall `node_modules` without reviewing the exact effect.
- The runtime target is Node 24 LTS. Validate Prisma native engines, Sharp, bcrypt, SQLite migrations, Docker and all tests before changing runtime pins.
- Add focused tests for security boundaries and preserve existing public routes and customer workflows. Run the project’s defined checks in a runtime compatible with its declared engine.
- Avoid broad refactors, framework changes, or unrelated features. Document security-sensitive decisions and verify changes with tests before reporting completion.

## Railway staging and release

- Staging must use a separate Railway project, new service, new empty `/data` volume, synthetic data, and independent secrets. Never reuse production environment variables, volumes, or integrations.
- Set `STAGING_MODE=true` and valid staging Basic Auth credentials before startup. Keep the Railway health route limited to generic process/database status; verify access control, noindex, cache, and referrer behavior before sharing a test URL.
- Keep email, SMS, marketing, payment, analytics, and Web Push credentials absent from staging unless an isolated test sink is separately approved.
- Confirm the intended source commit, branch, builder, mount path, health check, and rollback target before deployment. Railway configuration or CLI actions that create resources, deploy, or change settings require explicit authorization.

## Future platform direction

- Keep future customer/organization, provider/technician, property, service request/job, scheduling, quotation/payment, and geographic eligibility concepts modular.
- Model regional service eligibility and regulated-trade qualification as data and policy checks; do not hardcode national availability or imply unverified licensing.
- Build future AI and workflow automation behind auditable, human-reviewable service boundaries. Do not add marketplace, payment, or AI features as part of security-only work.

## Durable mission and release context

- Business goal: grow the Montréal service business into a Canadian multi-service platform. Advertise only verified services, regions and qualifications.
- Production project: `FixMyDoor Services`, service `fixmydoorservices`, branch `main`, domain `fixmydoor.ca`, volume `/data`. Live environment display name is `openssl rand -base64 32`; a separate environment named `production` also exists. Resolve IDs before any operation.
- Staging project `66faefcb-b523-47b4-b91c-b96126953e39`, environment `78c4b506-61e1-4792-937c-c4ca7133d3a4`, service `76e8013f-fb71-4aad-8e3b-4c852a3e07c3`. Stage only on the dedicated security branch.
- Current mission authorizes development, tests, commits and staging deployments. Production merges/deploys, secrets, volumes, DNS, billing and real messages require separate explicit approval.
- Read `docs/PROJECT-STATUS.md` first. Architecture and commercial sequence: `docs/ARCHITECTURE.md`. Release/recovery/containment: `docs/SECURITY-OPERATIONS.md` and `docs/RELEASE-PROCESS.md`.
- Review `docs/PRODUCTION-TRANSITION.md` before production work. Phase 5.3 approved a limited backup and settings operation. Railway denied the backup for lack of Pro entitlement, and the configuration apply remains gated by verified recovery protection. Workspace billing and the security release require separate authorization.
- Required release gate: typecheck, all Node tests, Prisma generate/validate, disposable SQLite migrations/recovery, clean Docker build/image inspection, desktop/phone/tablet Playwright, staged booking/admin/private attachments/tracking/SEO/messaging checks and restart persistence.
- Vite must proxy to Express; never reintroduce duplicate authentication or booking handlers. Local APIs listen on loopback. Use synthetic credentials/data and no outbound providers.
