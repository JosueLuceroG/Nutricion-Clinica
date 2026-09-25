# Standalone Disaster Recovery Runbook

Scope: one Windows host, SQL Server OLTP plus a distinct DWH database, local
Web/API, Desktop Dexie state and configured external files. Use synthetic
fixtures only. Never point this runbook at production or a real patient.

## 1. Recovery acceptance scenario

Create a disposable instance containing at least:

- two sucursales and two professionals;
- one synthetic patient;
- one consultation;
- anthropometry and lab observations;
- one meal plan and adherence records;
- one governed RAG document/version;
- one SQL Memory entry if Memory is enabled;
- one encrypted document/recording file where the target supports them;
- one local-only Desktop row and a known sync cursor;
- one clean outbox, followed by a separate emergency/outbox fixture.

The fixture must include IDs that are clearly synthetic and must not contain
real names, phones, email addresses or recipients.

## 2. Clean backup and restore

1. Start the standalone host and capture `status.ps1` plus `/health/ready`.
2. Verify OLTP `039`, DWH `dwh-08-003`, Web `/api`, authenticated login and
   sync manifest.
3. Export the authorized Desktop backup with a clean sync queue.
4. Run:

   ```powershell
   pwsh -File deployment/windows/backup.ps1 `
     -InstallRoot <package-root> `
     -DesktopBackupFile <authorized-encrypted-export> `
     -DesktopSyncState clean
   ```

5. Verify `manifest.json`, its digest, all file hashes, and that no secret/PHI
   marker appears in the package metadata or logs.
6. Prepare a current-data rollback backup and run restore only against a
   different disposable instance or after explicit operator approval:

   ```powershell
    pwsh -File deployment/windows/restore.ps1 `
      -InstallRoot <package-root> `
      -BackupPath <full-install-backup> `
      -RollbackBackupPath <independent-current-data-backup> `
      -ConfirmRestore -RollbackPrepared
   ```

7. Import the staged Desktop export through the authorized UI flow.
8. Run runtime preflight, start the host and verify readiness.
9. Reconcile every synthetic row, file hash, cursor, conflict state and DWH
   result. Expected clinical data loss: zero.

## 3. Emergency/outbox recovery

1. Capture an emergency package with `-SnapshotMode emergency` while a
   synthetic outbox operation is pending.
2. Confirm the manifest visibly says `emergency` and does not claim an empty
   outbox.
3. Restore only with `-AllowEmergencySnapshot` into an isolated target.
4. Preserve the pending operation and cursor state; do not clear the queue to
   force a green check.
5. Resolve/replay the operation using the existing conflict protocol and verify
   idempotency after restart.
6. Record the reconciliation decision and mark the target clean only after the
   queue and conflicts are explicitly settled.

## 4. DWH recovery paths

Preferred path is restore of `sql/dwh.bak`, followed by schema compatibility,
freshness and reconciliation checks. The accepted rebuild path is:

1. create a distinct empty DWH database;
2. run the one-shot DWH schema workload through `dwh-08-003`;
3. run the single jobs runner ETL from OLTP;
4. verify dimensions, facts, SCD2 validity, late-arriving rows, soft deletes,
   rejects and `unexpected_loss=0`;
5. verify a second ETL run does not duplicate rows or regress watermarks.

The DWH is analytics-only. No client or restore step may move analytics data
into the OLTP database. `SqlDwhStore` must use the dedicated DWH pool.

## 5. RAG, Memory and observability

- SQL RAG documents, approvals, versions and governed source content are
  restored; a retrieval index may be rebuilt from them.
- SQL Memory is restored and survives a stop/start; `AI_MEMORY_STORE=memory` is
  explicitly ephemeral and cannot be represented as durable recovery evidence.
- SQL telemetry/certification state is restored when configured. Memory-mode
  telemetry is optional and must be reported as rebuildable/ephemeral.
- Retrieval, Memory and telemetry failures must return a visible unavailable or
  abstention state, never fabricated clinical values.

## 6. Host failure and restart

Exercise each action separately:

| Event                  | Expected result                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| API child exits        | Supervisor restarts API with bounded backoff; jobs remains separate.                       |
| Jobs child exits       | Supervisor restarts jobs; API does not start a second jobs loop.                           |
| SQL unavailable        | Readiness is `503`; no fake ready state; recovery after SQL returns.                       |
| Host stop/start        | API/jobs close and reopen pools; no stale jobs marker is trusted.                          |
| OS reboot              | Scheduled task starts supervisor at boot, then both children; capture timestamps and PIDs. |
| Internet disconnected  | Core local ERP remains usable; external AI/SMTP/TURN degrade safely.                       |
| Web artifact missing   | Preflight/install fails; API does not claim a complete standalone package.                 |
| Secret file unreadable | Child startup fails closed without printing secret values.                                 |

If an OS reboot cannot be performed safely, run an equivalent stop/start cycle,
state that limitation explicitly and do not label the reboot gate `PASS`.

## 7. Uninstall and update safety

Before an update, take a clean full-install backup and retain the prior package
digest. Update application files without deleting data/backups/logs. Re-run
preflight and compatibility checks before starting the new supervisor. Never
downgrade OLTP/DWH destructively to match an older binary.

Uninstall removes the scheduled task and optionally application files only. It
must preserve data, backup, log and rollback roots. Verify this with a post-
uninstall directory/hash check.

## 8. Evidence record

For each rehearsal record:

```text
STEP 03B DR: PASS / CONDITIONAL / FAIL
fixture: <synthetic fixture id>
release: <version and full commit>
backup manifest: <sha256>
snapshot mode: clean / emergency
OLTP schema: 039
DWH schema: dwh-08-003
restore target: <disposable identity>
clinical row reconciliation: PASS / FAIL
file/hash reconciliation: PASS / FAIL
Dexie/outbox reconciliation: PASS / FAIL
DWH reconciliation: PASS / FAIL
RAG/Memory/telemetry persistence: PASS / CONDITIONAL / FAIL
offline core: PASS / CONDITIONAL / FAIL
restart/reboot: PASS / CONDITIONAL / FAIL
RTO/RPO: <measured values or NOT MEASURED>
blockers: <explicit, no secrets/PHI>
```
