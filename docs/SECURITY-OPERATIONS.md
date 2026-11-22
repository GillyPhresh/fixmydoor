# Security operations and recovery

## Incident review before production release

Source review identified legacy public runtime/push state, public customer photos and overly broad tracking output. This proves risky code paths, not a confirmed production incident. Preserve logs and deployment/version evidence; inspect secret names/storage configuration without fetching public private-key URLs or collecting customer records. Owner must authorize containment and rotation. Disable legacy push, revoke staff/visitor subscriptions and rotate VAPID material if its publication is confirmed or cannot be excluded. Deploy attachment/tracking/marketing boundaries only after backup and legacy rehearsal. Review provider-side Resend audiences, automated events/campaigns and SMS schedules; application suppression cannot cancel previously scheduled provider campaigns. Essential transactional communication remains separate.

## Consistent SQLite and file backups

Production actions below require separate approval. Keep one replica. Stop request acceptance and wait for writes/uploads/background work to finish; stop the app before a whole-volume snapshot. Snapshot the entire `/data` volume, including SQLite WAL/SHM, private files, legacy uploads and published media. Never copy only the main `.db` file from a running WAL database. For an online database-only backup use SQLite's backup API (tested by `tests/recovery.test.mjs`); it includes committed WAL contents. A database-only snapshot does not ensure consistency with concurrent filesystem changes: quiesce all writers for a combined snapshot.

Encrypt backups with independent storage/access, record commit, migration history, UTC capture time, hashes, retention and restoration drill. Never place backups inside the image/static paths, logs or Git. Assign an owner for off-platform storage and scheduled drills. Volume backup availability/retention must be verified with Railway plan and owner.

Restore into an isolated empty volume. Verify hashes, `PRAGMA integrity_check`, `foreign_key_check`, migration history and synthetic counts; test private photo authorization, legacy photos and public media. Rehearse restore before release. Embedded private attachment BLOBs live in SQLite; legacy photos may be embedded data URIs or `/uploads/...` references. Preserve all legacy files and serve them through authenticated compatibility routes. Do not bulk move/delete production photos. Inventory references privately and check missing files without publishing filenames.

### Staging recovery rehearsal

The project-pinned script is `scripts/rehearse-staging-recovery.mjs`. It refuses to run unless `STAGING_MODE=true`, `RAILWAY_PROJECT_ID=66faefcb-b523-47b4-b91c-b96126953e39`, and `DATABASE_URL=file:/data/fixmydoor.db`. It opens the database read-only, uses Node 24's SQLite online backup API, verifies SQLite integrity and foreign keys, checks the expected tables, and copies `/data/uploads` to an ephemeral restore directory when that tree exists. It reports row counts only; it does not print booking fields or customer data and cleans the temporary restore directory after the check.

For an authorized live staging run, after an SSH key is available to Railway, use the CLI in the explicitly linked staging context or pass exact resource IDs:

```powershell
railway ssh --project 66faefcb-b523-47b4-b91c-b96126953e39 --environment 78c4b506-61e1-4792-937c-c4ca7133d3a4 --service 76e8013f-fb71-4aad-8e3b-4c852a3e07c3 -- node scripts/rehearse-staging-recovery.mjs
```

On 2026-11-22, SSH and `railway volume files list` both failed with “No SSH keys found.” No key was created or registered. Railway documents volume browsing and file download, but these commands do not run SQLite's backup API; downloading `/data/fixmydoor.db` from an active WAL database is not an acceptable substitute. Do not register a Railway SSH key without separate owner authorization. A recovery rehearsal is complete only after the online backup runs on the actual staging schema, a separate restore is verified without replacing the active `/data` database, hashes/integrity/foreign keys/migrations pass, and the restored copy is exercised by the application.

### Railway volume backup feature

Railway documents manual and scheduled volume backups for SQLite and other volume files. Backup schedules and retention for the production volume were not visible in the read-only service configuration and remain unverified. Before production release, the owner must check the Backups tab for the domain-serving volume, establish encrypted off-platform retention and a recovery owner, then test an isolated restore under the production approval gate. A Railway volume snapshot alone does not replace an SQLite online backup plus integrity/foreign-key validation, and it cannot be described as a completed restore rehearsal until the application has run against the restored data.

## Rollback

Record current deployment image and exact application revision. Restore code only when schema remains compatible. If migration/data incompatibility exists, stop writes and restore the consistent pre-release volume to an isolated replacement before switching traffic under owner approval. Preserve failed-release evidence. Do not blindly overwrite newer customer requests with an older backup; reconcile post-backup writes under a documented recovery decision. Set RPO/RTO and retention with the owner.
