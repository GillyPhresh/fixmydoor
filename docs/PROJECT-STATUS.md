# Engineering status — 2026-11-22

## Baseline

React/Vite + Express modular monolith, Prisma 4.16 + SQLite, Docker/Railway. Production main remains 025c5f9756aa8556af5a1a2a36e74fd0c3f33ddf. Work only in fixmydoor-p0-secure / codex/fixmydoor-security-p0. Original workspace and untracked runtime fixtures are preserved.

Last verified staging revision before this mission: 3d449bfda787d67ee7750d93876c0313eb87ac58, deployment 5aae74b6-5df8-4b56-9fff-790253a65c52. Project/environment/service IDs are in AGENTS.md. SQLite and private attachment BLOBs persist at /data; no PostgreSQL or Redis.

## Current milestone

Prepare security release candidate; production remains approval-gated. Node 24 upgrade, shared Express development API, photo upload race/preview fix, browser suite, recovery rehearsal, release/incident/architecture docs implemented. Removed unused Vitest/debug tool dependencies. tar override 7.5.19 addresses the audited critical archive issue; remaining development advisories need triage. Runtime application dependency audit found zero advisories.

## Verified release evidence

- Application revision `5c52b9ddb7852685d30c1404ebec5125d40764db`; staging deployment `02f78e9f-0060-426e-bb76-9715011c3cb4` SUCCESS; image sha256:3b2e02fe1fbb2584ee76701ad6dec85b9b92afc42d5c0b64b3d315b786752631. Documentation-only follow-ups do not change this tested application.
- Node 24.22.3 clean Docker build and container typecheck passed. Prisma 4.16 generation/validation and all 10 fresh SQLite migrations/status passed, without native-library dependency upgrades.
- 16/16 Node tests passed on host and Linux Node 24. The final worker regression used read-only mounts of updated tests/public files in the clean runtime image; the final Railway image built the committed worker changes.
- 5/5 Playwright tests passed against this staging revision: 1440 desktop, 375 phone, 768 tablet, navigation, French switch, real form requests with/without photograph, admin, tracking and failed-upload containment.
- 15 canonical routes and 8 aliases passed HTTP checks. Basic Auth, private-image denial without staff, robots and analytics/verification isolation passed.
- Staging restart retained six synthetic bookings, the same booking ID and private attachment SHA256. Startup logs show 10 migrations with none pending, completed compatibility check and healthy database.
- Image scan found no runtime fixtures, environment files, SQLite files, browser artifacts or nested Vite cache. Limited tracked credential-pattern scan returned zero candidates (not a comprehensive secret audit).
- Dependency audit: critical 0 / high 14 / moderate 12 / low 2, all in development/build dependencies; production dependency audit zero. See DEPENDENCY-REVIEW.md. Audit remains a failed release gate.

## Remaining release gates

**SECURITY RELEASE CANDIDATE NOT READY.** High: remaining build-tool advisories need compatibility-scoped patching/reachability review; no owner exception is assumed. High: live staging-schema recovery rehearsal blocked because Railway SSH reports no local/agent SSH keys. The staging-only rehearsal script exists and local synthetic WAL/token/BLOB/legacy/published-file restoration passes, but that is not proof of a complete live-volume restore. Owner must authorize/register an appropriate SSH key or provide an approved staging execution method; no account access was changed.

High / time-sensitive: production has resolved legacy railway.json overrides (Dockerfile builder, health timeout 300, health path and restart policy); saved health timeout is null. Before 2026-12-01 preserve those settings through the supported service settings/IaC workflow and review exact plan. Security branch has retired the file and staged deployments now report empty file overrides. Do not merge until production migration is owner-approved. No production configuration was changed.

Critical owner release prerequisite: verified production backup, legacy-file inventory/compatibility rehearsal and credential exposure review/rotation decision. No production customer data was accessed and no incident is asserted. Scope includes existing links and photos; do not delete legacy files or invalidate tokens.

## Owner release decisions

Approve production backup/restore ownership, retention/RPO/RTO, volume snapshot and credential exposure review/rotation if warranted, legacy-file preservation, provider-side campaign suppression and exact configuration migration. No confirmed customer incident is asserted.

## Next commercial milestone

Customer/contact/property relationships around existing Booking IDs; contact consent and audit events first, then Job/Appointment scheduling and quotations/invoices. See ARCHITECTURE.md. No payments, provider accounts or AI integrations are implemented in this mission.
