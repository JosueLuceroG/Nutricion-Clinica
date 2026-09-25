# Full Install Backup Contract

Version: `nutriclinica-full-install-v1`. Companion implementation:
`deployment/standalone/contract.mjs` and `deployment/windows/backup.ps1`.

This contract is intentionally different from the limited browser/Dexie export
described in `local-backup-authorization.md`. A full-install backup is an
operator-controlled directory package containing native SQL backups, hashed
external files and an authorized Desktop export. No manifest contains row data,
credentials, tokens or raw patient content.

## 1. Canonical inventory

| Component                            | Classification         | Authority                         | Recovery rule                                                                                 |
| ------------------------------------ | ---------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `oltp.database`                      | `MUST_BACKUP`          | SQL Server OLTP                   | Native SQL restore; schema must remain `039`.                                                 |
| `dwh.database`                       | `MUST_BACKUP`          | Separate SQL Server DWH           | Native restore preferred; rebuild from OLTP/ETL remains possible.                             |
| `files.documents`                    | `MUST_BACKUP`          | Configured file storage           | Copy, hash and restore without path traversal.                                                |
| `files.telemedicina_recordings`      | `MUST_BACKUP`          | Configured encrypted file storage | Copy, hash and retain consent/retention policy.                                               |
| `rag.knowledge_documents`            | `MUST_BACKUP`          | SQL/source store                  | Restore governed documents, versions and approvals.                                           |
| `rag.retrieval_index`                | `REBUILDABLE`          | Derived index                     | Rebuild only from approved source documents.                                                  |
| `ai.memory`                          | `MUST_BACKUP` when SQL | SQL store                         | SQL mode survives restart; memory mode is ephemeral.                                          |
| `observability.telemetry`            | `OPTIONAL`             | SQL or memory store               | Historical telemetry is not required for clinical recovery.                                   |
| `desktop.dexie_local_only`           | `MUST_BACKUP`          | Desktop IndexedDB export          | Restore through the authorized UI.                                                            |
| `desktop.sync_outbox`                | `MUST_BACKUP`          | Desktop Dexie                     | Clean snapshots require zero unsettled operations; emergency snapshots preserve/attest state. |
| `desktop.sync_cursors_and_conflicts` | `MUST_BACKUP`          | Desktop Dexie                     | Restore to prevent silent divergence.                                                         |
| `desktop.session_drafts`             | `MUST_NOT_BACKUP`      | Desktop session policy            | Discard at session boundary; never weaken isolation.                                          |
| `web.build`                          | `REBUILDABLE`          | Release artifact                  | Reinstall from the approved release digest.                                                   |
| `server.secrets`                     | `MUST_NOT_BACKUP`      | Protected secret source           | Re-provision; never copy or log values.                                                       |
| `server.logs`                        | `OPTIONAL`             | Rotating operator logs            | Retain separately if needed; no raw PHI/secrets.                                              |

The SQL backup covers SQL-authoritative clinical entities excluded from the
limited Dexie export: patients, consultations, anthropometry, labs, meal plans,
adherence, audit data, RAG metadata, certification state and other migrated
tables. The Desktop export covers only local state it is authorized to export.

## 2. Package layout

```text
full-install-<UTC>-<unique-id>/
  manifest.json
  manifest.digest
  sql/oltp.bak
  sql/dwh.bak
  files/documents/<relative-file>
  files/telemedicina_recordings/<relative-file>
  desktop/local-backup.enc
```

`manifest.json` contains:

- format and contract version;
- canonical UTC creation time;
- release/app version and full commit when known;
- OLTP, DWH, Dexie and sync schema versions;
- non-secret instance/environment/database identities;
- `snapshot.mode` (`clean` or `emergency`), sync state and outbox state;
- component statuses;
- relative file paths, byte sizes and SHA-256 digests.

Absolute source paths are not put in the manifest. Relative paths reject drive
letters, backslashes, traversal, duplicate separators and control characters.
Manifest validation rejects secret-shaped keys and the synthetic PHI marker.

## 3. Snapshot modes

### Clean

1. Stop the API/jobs supervisor and wait for child exit.
2. Stop or quiesce Desktop writes through the authorized backup flow.
3. Export Desktop state and prove `syncState=clean` with an empty unsettled
   outbox.
4. Issue native OLTP and DWH backups with checksums.
5. Copy configured files and calculate hashes.
6. Generate and validate the manifest.
7. Restart the supervisor only after the package is complete.

Missing Desktop export, an active/pending/failed/conflicting sync operation or a
missing configured file source blocks a clean backup. The script never silently
labels an incomplete package as clean.

### Emergency

`backup.ps1 -SnapshotMode emergency` permits an operational capture when clean
quiescence is unavailable. The manifest records the emergency mode and unknown
or pending sync state. Emergency packages cannot be restored without
`-AllowEmergencySnapshot`; recovery must reconcile outbox/cursors/conflicts
before normal sync resumes.

## 4. Restore contract

Restore is fail-closed unless all of these are explicit:

- `-ConfirmRestore`;
- an independently prepared current-data rollback backup,
  supplied with `-RollbackBackupPath` and acknowledged with
  `-RollbackPrepared`;
- valid manifest and matching file hashes;
- matching instance identity, unless an operator explicitly uses
  `-AllowDifferentInstance` for an isolated restore target;
- `-AllowEmergencySnapshot` for emergency packages.

The restore script verifies both native SQL backup media with
`RESTORE VERIFYONLY ... WITH CHECKSUM` before stopping the supervisor, then
restores OLTP and DWH with native SQL `REPLACE` only after confirmation, copies configured external files without
deleting unlisted target files, stages the Desktop export for authorized UI
import, and runs runtime preflight before restart. A Desktop export is never
written directly into browser IndexedDB by PowerShell.

SQL native restore is not transactionally reversible by the application. The
rollback acknowledgement and isolated restore rehearsal are therefore required
operational controls, not optional UX.

## 5. Encryption and access

SQL backup encryption, backup media retention, key custody and off-host copy are
customer infrastructure decisions. The application package does not invent a
key manager. Desktop exports may use the existing encrypted local backup flow;
the administrator authorization and TOTP/sensitive-action grant remain
required.

The backup directory is not exposed as an API/Web download. File ACLs, storage
encryption, retention and deletion require an owner and evidence. Secret files
are re-provisioned separately and are excluded from both package contents and
manifest metadata.

## 6. Required evidence

An accepted backup rehearsal records, without PHI or secrets:

- release/commit and contract versions;
- instance and disposable target identities;
- clean/emergency mode;
- component statuses and file counts;
- manifest digest and per-file hash verification result;
- native SQL backup success and isolated restore success;
- Desktop authorized import result;
- post-restore OLTP/DWH schema and readiness result;
- RTO/RPO measurements and any conditional blocker.
