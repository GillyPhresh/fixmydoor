# FixMyDoor engineering guide

## Autonomous engineering policy

- Own technical problems through resolution. Inspect the current repository and runtime state, diagnose the cause, implement the smallest effective fix, run relevant tests and builds, verify adjacent workflows, and continue the original assignment. Change the approach before repeating a failed operation.
- Use standing authorization for routine engineering in the approved development checkout and isolated staging. This includes bugs, type errors, compatible dependency repairs, local database fixes, security controls, app configuration, tests, documentation, commits, and approved staging deployments. Resolve ordinary technical choices independently.
- Group related fixes, reuse working code and prior verified evidence, and avoid unnecessary dependencies, services, and recurring costs. Preserve valid work and synthetic fixtures. Keep business expansion features out of security and infrastructure releases.
- When an external blocker or approval boundary prevents an operation, prepare the exact scoped action and continue independent work. Ask only for the decision or authorization still needed.
- Report what failed, the cause if verified, what changed, the checks and their results, whether the original objective was reached, and what still blocks it. Update project status when implementation, verified revisions, release gates, or the next authorized work materially change.

## Owner approval boundaries

- Obtain explicit owner authorization for production merges, deployments and Railway mutations, production database or customer file changes, credential rotation, DNS changes, real customer messages, financial transactions, subscription upgrades, significant recurring costs, destructive operations, and external transfers of customer data.
- Apply existing approvals only to their exact targets, scope, and prerequisites. Staging authorization does not extend to production. Preserve the live service and use synthetic data for development and verification.

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

- Keep customers, organizations, properties, providers, jobs, scheduling, quotes, payments, dispatch, B2B contracts, subscriptions, remote consultations, and regional eligibility modular.
- Model regional service eligibility and regulated-trade qualification as data and policy checks; do not hardcode national availability or imply unverified licensing.
- Build future AI and workflow automation behind auditable, human-reviewable service boundaries. Do not add marketplace, payment, or AI features as part of security-only work.

## Durable mission and release context

- Business goal: grow the Montréal service business into a Canadian multi-service platform. Advertise only verified services, regions and qualifications.
- Production project: `FixMyDoor Services`, service `fixmydoorservices`, branch `main`, domain `fixmydoor.ca`, volume `/data`. Live environment display name is `openssl rand -base64 32`; a separate environment named `production` also exists. Resolve IDs before any operation.
- Staging project `66faefcb-b523-47b4-b91c-b96126953e39`, environment `78c4b506-61e1-4792-937c-c4ca7133d3a4`, service `76e8013f-fb71-4aad-8e3b-4c852a3e07c3`. Stage only on the dedicated security branch.
- Read `docs/PROJECT-STATUS.md` first. Architecture and commercial sequence: `docs/ARCHITECTURE.md`. Release/recovery/containment: `docs/SECURITY-OPERATIONS.md` and `docs/RELEASE-PROCESS.md`.
- Review `docs/PRODUCTION-TRANSITION.md` before production work. Phase 5.3 approved a limited backup and settings operation. Railway denied the backup for lack of Pro entitlement, and the configuration apply remains gated by verified recovery protection. Workspace billing and the security release require separate authorization.
- Phase 5.4 verified encrypted portable recovery on staging. See `docs/SECURITY-OPERATIONS.md` for tooling, key custody and exact production gates. Production capture requires separate approval for access, the Node 24 maintenance runtime, write quiescence and external storage.
- Phase 5.5 adds R2-compatible transfer, independent restore checks and backup freshness monitoring. Keep real provider credentials off development and staging; use the loopback fake until an isolated provider test is approved. Recovery remains a prerequisite for the existing three-field production settings approval.
- Phase 5.7 verified independent encrypted restore against the private US `fixmydoor-staging-backups` bucket. Its test credentials were revoked. The existing production backup bucket reports WEUR with a default jurisdiction. Phase 5.8 proposes a separate EU-restricted R2 bucket after privacy and owner approval. See `docs/PRODUCTION-TRANSITION.md`.
- Phase 5.8 rehearses a Node 24 quiesced snapshot followed by Node 20 application resumption and sealing after health returns. Keep plaintext in restricted ephemeral scratch. Monitor independent restore and protect the newest verified archive and all rollback holds. Production access, storage provisioning, credentials, transfer, and the maintenance cutover remain explicitly gated.
- Phase 5.9 confines synthetic EU acceptance to the explicitly approved bucket and `staging/` object prefix. The legacy app runs Prisma and compatibility changes during startup. Validate schema and migration metadata before authorizing an exact production restart. Keep the unrelated UniEco token unchanged until its consumers are identified and a scoped transition is separately approved.
- Required release gate: typecheck, all Node tests, Prisma generate/validate, disposable SQLite migrations/recovery, clean Docker build/image inspection, desktop/phone/tablet Playwright, staged booking/admin/private attachments/tracking/SEO/messaging checks and restart persistence.
- Vite must proxy to Express; never reintroduce duplicate authentication or booking handlers. Local APIs listen on loopback. Use synthetic credentials/data and no outbound providers.

## Visual feature verification

- Every substantial FixMyDoor feature must be demonstrated in the actual running application. Start or maintain a local preview where practical, share accessible routes, and provide genuine desktop and mobile screenshots after major milestones. Verify desktop and mobile usability and demonstrate significant workflows before completion. After successful isolated Railway staging deployment, provide its protected preview URL and verify the deployed interface. Use synthetic records and never expose credentials in screenshots or artifacts.
