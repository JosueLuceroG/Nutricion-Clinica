# Local backup authorization

Local Dexie backup export and restore are restricted to the current `admin`
role. The API re-reads the account from SQL Server before authorization and
again before grant consumption, so a stale JWT or modified frontend role does
not grant access.

## Step-up flow

1. The administrator submits the account password and a current TOTP code when
   2FA is enabled.
2. `POST /auth/sensitive-action-grants` issues a five-minute JWT bound to either
   `backup.export` or `backup.restore`.
3. The local backup service calls
   `POST /auth/sensitive-action-grants/consume` before reading or replacing
   Dexie data.
4. SQL Server atomically consumes the one-time grant and writes the required
   audit event. Replays, expired grants, action mismatches, inactive accounts,
   and non-admin roles fail closed.

Apply `apps/api/migrations/024-sensitive-action-grants.sql` before deploying
the API and frontend that use this flow. Do not apply it directly to the local
development database as a substitute for the postponed staging rehearsal.

## Restore safety

- The complete manifest is validated before mutation.
- All restorable tables are cleared and populated in one Dexie transaction.
- A failed row or table rolls back the complete restore.
- Sync and backup/restore share an exclusive Web Lock across browser contexts.
- SQL Server-managed tables are outside the restore transaction, so ordinary
  clinical writes keep their normal sync hooks during a portable restore.
- Export and restore are refused while pending, failed, conflicting, or active
  sync operations exist.
- Restore requires the typed confirmation `RESTAURAR`.
- Files larger than 50 MB and incompatible schema versions are rejected.

The portable backup intentionally excludes SQL Server-managed clinical tables,
local audit history, sync queue and checkpoints, AI cache, and telemedicine
recording blobs. Export and restore require a clean sync queue. SQL Server
remains authoritative for patients, consultations, anthropometry, labs, meal
plans, and adherence; local JSON restore never overwrites those entities.

## Trust boundary

This protects the supported application workflow, but WebView-owned IndexedDB
is not a tamper-proof security boundary. A truly authoritative infrastructure
backup remains a SQL Server operational task and still requires the staging
backup/temporary-restore rehearsal in the pre-production checklist.
