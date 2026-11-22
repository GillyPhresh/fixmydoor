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
- The repository currently pins Node 20, which is end-of-life. Before release, plan a supported-LTS runtime upgrade and validate Prisma, Sharp, SQLite, Docker, builds, and tests; do not change the runtime pin without that compatibility evidence.
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
