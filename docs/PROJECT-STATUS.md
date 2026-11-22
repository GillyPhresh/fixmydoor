# Engineering status — 2026-11-22

## Baseline

React/Vite + Express modular monolith, Prisma 4.16 + SQLite, Docker/Railway. Production main remains 025c5f9756aa8556af5a1a2a36e74fd0c3f33ddf. Work only in fixmydoor-p0-secure / codex/fixmydoor-security-p0. Original workspace and untracked runtime fixtures are preserved.

Phase 5.1 staging browser-tested revision: `a55d8a01e268a2cd78aef77c6c8c5d65a44598da`, deployment `488d9aea-a648-44bf-98e0-ccfefe176bc8` (SUCCESS). Phase 5.2 verified live recovery on `74313ebca5e4b4f0375b4a6a8d1140827596fb47`. The follow-up commit restores normal startup and records evidence. Project/environment/service IDs are in AGENTS.md. SQLite and private attachment BLOBs persist on the independent `/data` volume. The health JSON `environment: "production"` indicates `NODE_ENV`.

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

**Phase 5.6 real R2 destination remains unverified.** The dedicated staging and production bucket names, temporary credential scopes and synthetic acceptance command are ready. No Cloudflare credentials or provisioning approval are available. The isolated staging maintenance gate on `c96fea40167d0062fb66a5cdba3593a446444659` (deployment `71acefa4-8b38-4866-b4ce-3116e54003cf`) ran the encrypted SQLite and loopback S3 drill before the app started listening. Automated tests exercise duplicate suppression and process timeout. Daily capture while serving traffic still needs a tested application-wide write gate. The normal startup command is restored in the follow-up.

**Phase 5.5 external transfer passed against a loopback S3 fake in staging.** Deployment `419cfd0f-5e03-4e62-b35b-74e6ed91be5b` tested encrypted transfer, interrupted retry, independent retrieval and restored application checks. Full unit and integration suite passed 21/21. Real R2 credentials, retention and transfer are unverified. No suitable external bucket has been confirmed. Production requires owner approval for the private destination, custody, data scope and Node 24 maintenance method. The production settings preview remains confined to the three approved fields. See the [recovery runbook](SECURITY-OPERATIONS.md#external-backup-runner-and-independent-monitor).

**Phase 5.4 portable recovery passed in staging.** The encrypted SQLite/media artifact restored with integrity and foreign keys OK, ten migrations, and a successful restored-application smoke test. The production configuration plan still contains only the three approved settings. Production has no recovery point. See [the two backup paths](PRODUCTION-TRANSITION.md#phase-54-decision) and [the portable recovery runbook](SECURITY-OPERATIONS.md#independent-production-backup-approval-gate).

**Phase 5.3 production preparation is incomplete.** The owner approved the backup and configuration operations. Railway rejected the manual backup because the workspace lacks Pro backup entitlement. Read-back showed no recovery points and no schedules, so the prerequisite for applying the configuration was unmet. Production remains on main at `025c5f9`. The owner must resolve backup eligibility or amend the backup prerequisite. The security candidate remains `1dcd2ef30fce7338b8d9f62346b804f1aa754a71` on successful staging deployment `e765fa2f-e694-4641-b534-9dba0549bda9`. See [PRODUCTION-TRANSITION.md](PRODUCTION-TRANSITION.md) for the API error and scope.

**STAGING RECOVERY PASSED. PRODUCTION RELEASE GATED.** Deployment `9abd67e0-216a-4ef3-a2e2-693b16084b05` backed up and restored the actual staging SQLite schema in temporary storage with no change to its source database. Eight bookings, three attachments and ten migrations passed validation. The restored app passed tracking and media checks. Existing staging media was empty. Synthetic filesystem media, a committed WAL fixture, missing attachments and damaged copies were verified in rehearsal tests. The normal Docker startup was restored for the final candidate.

High / time-sensitive: read-only Railway inspection confirmed serving service `fixmydoorservices` remains on branch `main`, latest successful deployment `29809266-fe37-4e27-abfa-e46ce5b2aa92` at production commit `025c5f9756aa8556af5a1a2a36e74fd0c3f33ddf`, with `fixmydoor.ca` and `www.fixmydoor.ca` on port 8080 and the 500 MB `fixmydoorservices-volume` mounted at `/data` in `us-west2`. Effective deployment configuration uses Dockerfile builder/path `/Dockerfile`, `/api/health` timeout 300, one replica and ON_FAILURE/retries 10. The saved config API omits the timeout and restart fields, while `main:railway.json` supplies them. Before 2026-12-01 preserve those settings through the supported service settings/IaC workflow and review an exact plan. Staging has an independent 5 GB `/data` volume and is on a separate project. Do not merge until production migration is owner-approved. No production configuration was changed.

Critical owner release prerequisite: the production volume API reported no schedules or recovery points. Verify an authorized production backup, privately inventory legacy files, and review credential exposure before approving deployment. The read-only Railway IaC preview showed exactly three saved settings changes and no resource additions or removals. See [the production approval package](PRODUCTION-TRANSITION.md).

## Owner release decisions

Resolve Railway backup entitlement, then run the already approved sequence with fresh target and plan checks. Separately authorize independent database/media backup access, legacy inventory, evidence and provider review, and the application release. Confirm retention and recovery objectives. No confirmed customer incident is asserted.

## Next commercial milestone

Customer/contact/property relationships around existing Booking IDs; contact consent and audit events first, then Job/Appointment scheduling and quotations/invoices. See ARCHITECTURE.md. No payments, provider accounts or AI integrations are implemented in this mission.
