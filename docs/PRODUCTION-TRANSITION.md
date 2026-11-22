# Production transition approval package

## Railway configuration

Verified on 2026-11-22 against project `a6e2306d-dca7-4dd6-8cb8-2be65b72bcd9`, environment `29134135-d1e0-4cc7-a9c2-3d376c692b74` and service `3f70cb91-a528-4931-80b3-5b2e47839a48`. The service is `fixmydoorservices` in the environment displayed as `openssl rand -base64 32`. The active deployment `29809266-fe37-4e27-abfa-e46ce5b2aa92` uses GitHub `GillyPhresh/fixmydoor` branch `main` at `025c5f9756aa8556af5a1a2a36e74fd0c3f33ddf`. The configured branch trigger remains connected and GitHub checks are not required (`checkSuites=false`).

Effective settings are Dockerfile builder, `/Dockerfile`, default build and start commands, `/api/health` with 300 seconds, restart `ON_FAILURE` with 10 retries, one replica in `us-west2`, and plan defaults for resources (no explicit limits). Preserve both custom domains on 8080 and the 500 MB volume `9c9c26fd-c8c4-4a84-8ac2-ac698925a24e` at `/data`. Preserve existing sealed variables and provider settings. The legacy deployment manifest lists six overrides: builder, null build command, health path, health timeout, restart policy and retries. The Config File path is unset, so the builder discovers the root file automatically.

The Railway CLI preview on the exact environment returned **0 to add, 1 to change, 0 to destroy**. The three saved-field changes were `deploy.healthcheckTimeout: null → 300`, `deploy.restartPolicyType: null → ON_FAILURE`, and `deploy.restartPolicyMaxRetries: null → 10`. It showed no changes to source, triggers, domains, volume or variables. Saved null values here are distinct from the values already used by the live deployment.

To reproduce, work in an isolated local directory linked to the IDs above. Run `railway config pull --variables unmanaged` and install the official `railway` SDK in that scratch directory. In the generated service declaration, replace the `healthcheck` shorthand with the following block. Leave the rest of the generated configuration intact.

```ts
deploy: {
  healthcheckPath: "/api/health",
  healthcheckTimeout: 300,
  restartPolicyType: "ON_FAILURE",
  restartPolicyMaxRetries: 10,
},
```

On this Windows install, the SDK check needed the actual Railway executable rather than the npm shim. Set `$env:_ = Join-Path (npm root -g) '@railway/cli/bin/railway.exe'` and use `& $env:_ config plan --environment 29134135-d1e0-4cc7-a9c2-3d376c692b74 --verbose`. Review again immediately before applying. Keep any approval limited to the three changes. The unset Config File path requires no cutover command. Keep `main:railway.json` until after the approved settings transition. Railway's cutoff is 2026-12-01. [Railway IaC migration](https://docs.railway.com/infrastructure-as-code#no-config-file-path-set)

Treat apply as potentially redeploying until Railway confirms its behavior for the resulting plan. A single replica using a volume can have a brief interruption if redeployed. Capture the pre-change deployment and state, verify /api/health and both public domains, use `railway deployment list --project <project-id> --environment <environment-id> --service <service-id> --limit 3 --json`, and inspect the effective manifest and volume association. If necessary, restore the prior app deployment with the preserved settings; after the cutoff, the legacy file cannot be used to recover those settings. Obtain approval before triggering a rollback.

## Backup and security release

The production instance `e30b920b-8101-47a8-8f83-3e85c6ec8b7c` returned empty lists from `volumeInstanceBackupScheduleList` and `volumeInstanceBackupList`. As of the query it used about 119 MB of 500 MB, below Railway's published 50% manual-backup limit. Actual manual backup creation remains untested. Open Railway → FixMyDoor Services → domain-serving environment → fixmydoorservices → Backups to confirm eligibility and settings. Plan daily backups and encrypted independent retention, with business-owner approval for schedule, cost, RPO, RTO and access. Before a release, verify the snapshot plus a WAL-consistent SQLite backup and quiesced upload tree with integrity and file checks in a restricted restore location. Railway restores within the same environment, so do not approve a volume swap merely to inspect a restore. [Railway backups](https://docs.railway.com/volumes/backups)

The browser-tested application commit is `a55d8a01e268a2cd78aef77c6c8c5d65a44598da`. The Phase 5.2 branch adds recovery tooling and documentation. Use the final staging deployment's exact commit after removing the rehearsal hook as the proposed release revision. Confirm a verified backup and legacy-media inventory before approving a release. Keep booking IDs, tracking tokens, gallery URLs and files. Categorize legacy files privately as customer photos or positively identified CMS assets. Preserve the original files and verify staff-only legacy compatibility and public CMS delivery before any cleanup.

Apply startup migrations with the existing volume mounted and keep the app out of rotation until health succeeds. Check homepage and canonical/alias/SEO files, booking form, staff login, authorized photo delivery, denial of public customer photos, tracking allowlist/cache/referrer headers, service worker updates, and transactional continuity by monitoring normal delivery outcomes. A real production booking or message test needs separate approval. Monitor health, startup migration status, booking failures, asset 401/404/5xx changes and confirmed transactional delivery. Avoid logging tracking links, admin notes or attachment names.

Preserve incident evidence. Public health, headers and ordinary pages can be checked without customer data. Review access logs and prior deployment artifacts privately with explicit scope before deciding whether any customer photo, tracking information or internal notes were exposed. Prioritize static runtime/key and customer-photo access restrictions, private tracking responses, and promotional dispatch containment. Restrict public access without breaking authorized CMS assets. Retire exposed Web Push subscriptions and rotate VAPID material if exposure is confirmed or cannot be ruled out. Review Resend campaign queues and audience rules with the owner and keep transactional delivery separate. The code findings alone establish no breach.

For rollback, retain the known-good deployment, database/media backup and post-backup write timeline. Prefer restoring the previous compatible code only after assessing whether doing so would reintroduce the exposure. If restoration is needed, stop writes, verify an isolated restored volume and reconcile newer bookings before any owner-approved traffic switch.
