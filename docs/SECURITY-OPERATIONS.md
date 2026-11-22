# Security operations and recovery

## Incident review before production release

Source review identified legacy public runtime/push state, public customer photos and overly broad tracking output. This proves risky code paths, not a confirmed production incident. Preserve logs and deployment/version evidence; inspect secret names/storage configuration without fetching public private-key URLs or collecting customer records. Owner must authorize containment and rotation. Disable legacy push, revoke staff/visitor subscriptions and rotate VAPID material if its publication is confirmed or cannot be excluded. Deploy attachment/tracking/marketing boundaries only after backup and legacy rehearsal. Review provider-side Resend audiences, automated events/campaigns and SMS schedules; application suppression cannot cancel previously scheduled provider campaigns. Essential transactional communication remains separate.

## Consistent SQLite and file backups

Production actions below require separate approval. Keep one replica. Stop request acceptance and wait for writes/uploads/background work to finish; stop the app before a whole-volume snapshot. Snapshot the entire `/data` volume, including SQLite WAL/SHM, private files, legacy uploads and published media. Never copy only the main `.db` file from a running WAL database. For an online database-only backup use SQLite's backup API (tested by `tests/recovery.test.mjs`); it includes committed WAL contents. A database-only snapshot does not ensure consistency with concurrent filesystem changes: quiesce all writers for a combined snapshot.

Encrypt backups with independent storage/access, record commit, migration history, UTC capture time, hashes, retention and restoration drill. Never place backups inside the image/static paths, logs or Git. Assign an owner for off-platform storage and scheduled drills. Volume backup availability/retention must be verified with Railway plan and owner.

Restore into an isolated empty volume. Verify hashes, `PRAGMA integrity_check`, `foreign_key_check`, migration history and synthetic counts; test private photo authorization, legacy photos and public media. Rehearse restore before release. Embedded private attachment BLOBs live in SQLite; legacy photos may be embedded data URIs or `/uploads/...` references. Preserve all legacy files and serve them through authenticated compatibility routes. Do not bulk move/delete production photos. Inventory references privately and check missing files without publishing filenames.

## Rollback

Record current deployment image and exact application revision. Restore code only when schema remains compatible. If migration/data incompatibility exists, stop writes and restore the consistent pre-release volume to an isolated replacement before switching traffic under owner approval. Preserve failed-release evidence. Do not blindly overwrite newer customer requests with an older backup; reconcile post-backup writes under a documented recovery decision. Set RPO/RTO and retention with the owner.
