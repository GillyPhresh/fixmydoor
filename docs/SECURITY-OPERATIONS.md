# Security operations and recovery

## Incident review before production release

Source review identified legacy public runtime/push state, public customer photos and overly broad tracking output. This proves risky code paths, not a confirmed production incident. Preserve logs and deployment/version evidence; inspect secret names/storage configuration without fetching public private-key URLs or collecting customer records. Owner must authorize containment and rotation. Disable legacy push, revoke staff/visitor subscriptions and rotate VAPID material if its publication is confirmed or cannot be excluded. Deploy attachment/tracking/marketing boundaries only after backup and legacy rehearsal. Review provider-side Resend audiences, automated events/campaigns and SMS schedules; application suppression cannot cancel previously scheduled provider campaigns. Essential transactional communication remains separate.

## Consistent SQLite and file backups

Production actions below require separate approval. Keep one replica. Stop request acceptance and wait for writes/uploads/background work to finish; stop the app before a whole-volume snapshot. Snapshot the entire `/data` volume, including SQLite WAL/SHM, private files, legacy uploads and published media. Never copy only the main `.db` file from a running WAL database. For an online database-only backup use SQLite's backup API (tested by `tests/recovery.test.mjs`); it includes committed WAL contents. A database-only snapshot does not ensure consistency with concurrent filesystem changes: quiesce all writers for a combined snapshot.

Encrypt backups with independent storage/access, record commit, migration history, UTC capture time, hashes, retention and restoration drill. Never place backups inside the image/static paths, logs or Git. Assign an owner for off-platform storage and scheduled drills. Volume backup availability/retention must be verified with Railway plan and owner.

Restore into an isolated empty volume. Verify hashes, `PRAGMA integrity_check`, `foreign_key_check`, migration history and synthetic counts; test private photo authorization, legacy photos and public media. Rehearse restore before release. Embedded private attachment BLOBs live in SQLite; legacy photos may be embedded data URIs or `/uploads/...` references. Preserve all legacy files and serve them through authenticated compatibility routes. Do not bulk move/delete production photos. Inventory references privately and check missing files without publishing filenames.

### Staging recovery rehearsal

Run `node scripts/rehearse-staging-recovery.mjs` inside the approved staging runtime. The script requires the exact Railway project, environment and service IDs in AGENTS.md, staging mode, and the expected database and upload paths. Prefer a maintenance window before the app starts accepting writes. It opens SQLite read-only, takes an online backup from a consistent read snapshot, hashes the database and media, and verifies a separate restore. It compares booking IDs, tokens, photo references and attachment content by fingerprint. It then tests corrupt and incomplete copies, restoring from its archive before launching a loopback-only app with synthetic fixtures and no provider credentials. Only counts and pass/fail markers are emitted. Each run cleans its temporary copies on normal completion or a handled failure.

For an authorized live staging run, after an SSH key is available to Railway, use the CLI in the explicitly linked staging context or pass exact resource IDs:

```powershell
railway ssh --project 66faefcb-b523-47b4-b91c-b96126953e39 --environment 78c4b506-61e1-4792-937c-c4ca7133d3a4 --service 76e8013f-fb71-4aad-8e3b-4c852a3e07c3 -- node scripts/rehearse-staging-recovery.mjs
```

On 2026-11-22, a staging startup maintenance command ran the script before the public app started. Deployment `9abd67e0-216a-4ef3-a2e2-693b16084b05` reported `STAGING_RECOVERY_PASS`: 8 bookings, 3 attachments, 10 migrations, zero existing filesystem media files, integrity and foreign keys both OK. Corrupt and incomplete copies were rejected. Restored-app checks covered tracking privacy, private photo hashes and authorization, legacy photo authorization, missing legacy photo 404, and public media hashes using synthetic fixtures in the restore. The local WAL test verified copying committed WAL data and preserving pre-existing synthetic legacy and CMS files. The temporary startup command was removed from the release candidate. No SSH key or HTTP maintenance endpoint was used.

Public and legacy files should be immutable during the filesystem copy. The pre/post media hashes detect drift but cannot establish atomicity with SQLite. Stop all writers before a combined database/files backup. Do not download the live main SQLite file as a backup. A personal SSH key uses account permissions, and key registration still requires separate approval if used for a future run.

### Railway volume backup feature

The live production volume API returned no schedules and no recovery points on 2026-11-22. See [the production approval package](PRODUCTION-TRANSITION.md) for the exact target, backup options and owner decisions.

## Rollback

Record current deployment image and exact application revision. Restore code only when schema remains compatible. If migration/data incompatibility exists, stop writes and restore the consistent pre-release volume to an isolated replacement before switching traffic under owner approval. Preserve failed-release evidence. Do not blindly overwrite newer customer requests with an older backup; reconcile post-backup writes under a documented recovery decision. Set RPO/RTO and retention with the owner.
