# Engineering status — 2026-11-22

## Baseline

React/Vite + Express modular monolith, Prisma 4.16 + SQLite, Docker/Railway. Production main remains 025c5f9756aa8556af5a1a2a36e74fd0c3f33ddf. Work only in fixmydoor-p0-secure / codex/fixmydoor-security-p0. Original workspace and untracked runtime fixtures are preserved.

Staging baseline entering this mission: `e7dc533e48c71120dcf490b0e85c28b20d15e737`, deployment `eba920fa-42e0-4bd7-b767-5af10af5e586` (SUCCESS). Current verified staging revision: `a55d8a01e268a2cd78aef77c6c8c5d65a44598da`, deployment `488d9aea-a648-44bf-98e0-ccfefe176bc8` (SUCCESS). Project/environment/service IDs are in AGENTS.md. SQLite and private attachment BLOBs persist on the independent `/data` volume; no PostgreSQL or Redis. The health JSON `environment: "production"` is `NODE_ENV` runtime mode, not the Railway project/environment identity.

## Current milestone

Prepare security release candidate; production remains approval-gated. Node 24 upgrade, shared Express development API, photo upload race/preview fix, browser suite, release/incident/architecture docs implemented. Removed unused Vitest/debug tool dependencies. The release audit identified 14 high, 12 moderate and 2 low findings in the development/build dependency graph. Compatible patch updates and focused pnpm overrides are now recorded in the pinned pnpm 10 lockfile. Full and production audits both report zero advisories. The project pins pnpm 10.4.1; use `corepack pnpm` because the machine-wide pnpm 11 warns that it ignores the older `package.json#pnpm` configuration.

## Verified release evidence

- Dependency update locally verified: pinned-pnpm full audit and production audit both report 0/0/0/0/0 known advisories; typecheck, Prisma generation/validation and 16/16 tests pass. Node 24.22.3 host production build and Docker image build pass. The updated Docker image applies all 10 migrations and reports status up to date on a disposable SQLite database.
- The updated dependency build is deployed to isolated staging (`a55d8a0`, `488d9aea…`) and healthy with the SQLite database connected. Playwright passed all 5/5 tests on desktop 1440px, phone 375px and tablet 768px, covering language/navigation, bookings with and without a photo, admin, authorized attachment access, tracking privacy and invalid-upload containment. Synthetic staging only; no real messages were sent.
- 16/16 Node tests passed on host and Linux Node 24. The final worker regression used read-only mounts of updated tests/public files in the clean runtime image; the final Railway image built the committed worker changes.
- 5/5 Playwright tests passed against this staging revision: 1440 desktop, 375 phone, 768 tablet, navigation, French switch, real form requests with/without photograph, admin, tracking and failed-upload containment.
- 15 canonical routes and 8 aliases passed HTTP checks. Basic Auth, private-image denial without staff, robots and analytics/verification isolation passed.
- Staging restart retained six synthetic bookings, the same booking ID and private attachment SHA256. Startup logs show 10 migrations with none pending, completed compatibility check and healthy database.
- New Docker image inspection found no `/app/runtime`, uploads, env files, browser reports, or the two untracked synthetic SQLite/WAL fixtures. The image includes the full locked dependency tree; the full audit reports zero known advisories for that tree.

## Remaining release gates

**SECURITY RELEASE CANDIDATE NOT READY.** The lockfile updates have passed local checks and the Docker migration rehearsal, but staging redeployment/browser verification is still required. Live staging-schema recovery remains blocked: Railway SSH and volume file browsing require a registered SSH key; Railway returned “No SSH keys found.” Railway’s documented volume browser is file access, not remote command execution, and a live SQLite file download would not prove an online WAL-safe backup. The local staging-only recovery script and synthetic WAL/token/BLOB/legacy/published-file restoration tests pass, but they do not prove a live staging-volume restore. No account key was created or registered.

High / time-sensitive: read-only Railway inspection confirmed serving service `fixmydoorservices` remains on branch `main`, latest successful deployment `29809266-fe37-4e27-abfa-e46ce5b2aa92` at production commit `025c5f9756aa8556af5a1a2a36e74fd0c3f33ddf`, with `fixmydoor.ca` and `www.fixmydoor.ca` on port 8080 and the 500 MB `fixmydoorservices-volume` mounted at `/data` in `us-west2`. Effective deployment configuration uses Dockerfile builder/path `/Dockerfile`, `/api/health` timeout 300, one replica and ON_FAILURE/retries 10. The saved config API omits the timeout and restart fields, while `main:railway.json` supplies them. Before 2026-12-01 preserve those settings through the supported service settings/IaC workflow and review an exact plan. Staging has an independent 5 GB `/data` volume and is on a separate project. Do not merge until production migration is owner-approved. No production configuration was changed.

Critical owner release prerequisite: verified production backup, legacy-file inventory/compatibility rehearsal and credential exposure review/rotation decision. No production customer data was accessed and no incident is asserted. Scope includes existing links and photos; do not delete legacy files or invalidate tokens.

## Owner release decisions

Approve production backup/restore ownership, retention/RPO/RTO, volume snapshot and credential exposure review/rotation if warranted, legacy-file preservation, provider-side campaign suppression and exact configuration migration. No confirmed customer incident is asserted.

## Next commercial milestone

Customer/contact/property relationships around existing Booking IDs; contact consent and audit events first, then Job/Appointment scheduling and quotations/invoices. See ARCHITECTURE.md. No payments, provider accounts or AI integrations are implemented in this mission.
