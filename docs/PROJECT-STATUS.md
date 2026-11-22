# Engineering status — 2026-11-22

## Baseline

React/Vite + Express modular monolith, Prisma 4.16 + SQLite, Docker/Railway. Production main remains 025c5f9756aa8556af5a1a2a36e74fd0c3f33ddf. Work only in fixmydoor-p0-secure / codex/fixmydoor-security-p0. Original workspace and untracked runtime fixtures are preserved.

Last verified staging revision before this mission: 3d449bfda787d67ee7750d93876c0313eb87ac58, deployment 5aae74b6-5df8-4b56-9fff-790253a65c52. Project/environment/service IDs are in AGENTS.md. SQLite and private attachment BLOBs persist at /data; no PostgreSQL or Redis.

## Current milestone

Prepare security release candidate; production remains approval-gated. Node 24 upgrade, shared Express development API, photo upload race/preview fix, browser suite, recovery rehearsal, release/incident/architecture docs implemented. Removed unused Vitest/debug tool dependencies. tar override 7.5.19 addresses the audited critical archive issue; remaining development advisories need triage. Runtime application dependency audit found zero advisories.

## Evidence so far

- Host Node 24 typecheck passed; Node test suite 15/15 passed.
- Existing staging desktop/375px phone/768px tablet browser layout, navigation and French checks passed (3 tests).
- Browser booking identified photo race + broken previews; corrected locally. Local real browser bookings/admin/photo/tracking passed; failed-upload containment browser test passed.
- Initial clean Node 24.22.3 Docker build succeeded and generated Prisma 4.16 Client. Superseded container verification was stopped after later source changes; it is not final-release evidence.
- Synthetic WAL backup/restore test preserves token, private photo bytes, legacy and published files and passes integrity/foreign-key checks. Staging-specific live-schema recovery script must still run after deployment.

## Open release gates

Final image/full container suite and new staging deployment verification must be recorded before claiming the new revision is staged. Re-run all 5 browser tests on that exact deployed revision, verify migrations and restart persistence, perform staging recovery script and image artifact scan. Do not count prior-revision checks as final candidate proof.

Production has verified resolved legacy railway.json overrides (Dockerfile builder, health timeout 300, health path and restart policy); saved health timeout is null. December 1 cutoff makes migration urgent. Security branch retires file; do not merge until owner approves preserving production service settings. No production configuration was changed.

## Owner release decisions

Approve production backup/restore ownership, retention/RPO/RTO, volume snapshot and credential exposure review/rotation if warranted, legacy-file preservation, provider-side campaign suppression and exact configuration migration. No confirmed customer incident is asserted.

## Next commercial milestone

Customer/contact/property relationships around existing Booking IDs; contact consent and audit events first, then Job/Appointment scheduling and quotations/invoices. See ARCHITECTURE.md. No payments, provider accounts or AI integrations are implemented in this mission.
