# Real Staging Requirements

Fecha: 2026-09-08. Estado actual: **REAL STAGING BLOCKED / NOT AVAILABLE**.
Este es el contrato de entrada a Step 03 y la lista de acciones del operador.
No selecciona proveedor ni autoriza provisionamiento.

Este documento complementa `staging-bring-up-runbook.md`. Cuando exista un
target, este contrato actualizado en Step 02 prevalece sobre inventarios/topologias historicos
de 09.5A.

## 1. What qualifies as real staging

Real staging must be all of the following:

- physically/operationally outside the developer workstation;
- explicitly `ENVIRONMENT_CLASS=STAGING`, never inferred from localhost;
- isolated from production accounts, networks, databases, secrets, recipients
  and billable provider credentials;
- deployed from immutable API/Web artifact digests tied to a full Git SHA;
- reachable through approved DNS and HTTPS/WSS with a valid certificate;
- backed by real, non-production SQL Server OLTP and distinct DWH databases;
- using a real SecretProvider/injection mechanism and backup target;
- observable, recoverable and rollback-capable;
- populated only with synthetic/curated/de-identified data;
- capable of the end-to-end acceptance path in section 10.

Docker Compose on localhost, `.invalid` SQL, mocks and unit tests are useful
artifact evidence but **never** real staging.

## 2. Operator prerequisites

| Prerequisite                 | Required evidence                                                   | Current state |
| ---------------------------- | ------------------------------------------------------------------- | ------------- |
| Written authorization/scope  | owner, budget, provider/on-prem target, no-production statement     | BLOCKED       |
| Target architecture decision | completed `infrastructure-target-requirements.md` inputs            | BLOCKED       |
| App runtime                  | approved Linux OCI host/runtime or documented equivalent            | BLOCKED       |
| Immutable artifacts          | API/Web image digest; Desktop artifact/target build where exercised | BLOCKED       |
| SQL OLTP                     | non-default STAGING DB, version/edition/auth/TLS                    | BLOCKED       |
| SQL DWH                      | distinct STAGING DB and schema lifecycle                            | BLOCKED       |
| Network                      | DNS, edge, private runtime/data zones, firewall                     | BLOCKED       |
| TLS/WSS                      | valid cert, renewal, exact origins, long-connection settings        | BLOCKED       |
| Desktop CSP                  | exact staging HTTPS/WSS origin in staging Desktop build             | BLOCKED       |
| SecretProvider               | workload-scoped secrets and audit/rotation                          | BLOCKED       |
| Backup/restore               | selected RPO/RTO, protected target, isolated restore                | BLOCKED       |
| Observability                | logs/metrics/alerts/retention with no PHI                           | BLOCKED       |
| Synthetic fixture plan       | approved personas/tenants/data set and cleanup                      | BLOCKED       |
| External side effects        | disabled/sandbox allowlist and synthetic recipients                 | BLOCKED       |
| Operator/reviewers           | infra owner, release operator, security and clinical reviewers      | BLOCKED       |

Historical SQL credential rotation remains `STILL_REQUIRED` and is completed
only when the operator verifies revocation/rotation. New staging credentials do
not prove the historical credential was rotated.

## 3. Required environment identity

The redacted deployment record must contain at least:

```text
NODE_ENV=production
ENVIRONMENT_CLASS=STAGING
ENVIRONMENT_NAME=<approved-staging-name>
INSTANCE_ID=<unique-workload-instance>
DEPLOYMENT_ID=<rollout/change-id>
RELEASE_VERSION=<immutable-release>
GIT_COMMIT=<full-40-character-sha>
PUBLIC_API_URL=https://<approved-api-or-same-origin-host>
PUBLIC_WEB_URL=https://<approved-web-host>
DB_NAME=<non-default-staging-oltp>
DWH_DATABASE=<different-non-default-staging-dwh>
API_REPLICAS=1
JOBS_REPLICAS=1
EXTERNAL_SIDE_EFFECTS_MODE=DISABLED|SANDBOX
AI_EGRESS_ENABLED=false
AI_PATIENT_ENABLED=false
AI_SHADOW_STATE=DISABLED
```

The operator stores values/SecretProvider references in target configuration,
not Git. Full variable requirements are in
`runtime-configuration-matrix.md`.

## 4. Non-secret deployment driver gate

Materialize the contract represented by
`deployment/config/deployment-inputs.example` at an operator-owned, non-secret
path, then run:

```powershell
pnpm deployment:validate -- --env-file <approved-input-path> --print-runtime-map
```

Required result: `deployment-config: PASS`. The driver rejects unknown
environment, incomplete SHA, artifacts not bound to their digest, equal
OLTP/DWH, missing scan evidence and local/non-HTTPS STAGING endpoints. A PASS
validates shape only; it does not prove resources exist.

## 5. Artifact promotion gate

1. Start from clean Git at the approved commit.
2. Run frozen install, full quality/regression, secret/PHI scans and Tauri/Web/API
   builds.
3. Build API/Web images once. Record registry IDs, platform, digest, base image
   identity, release and commit labels.
4. Generate/verify the existing release manifest with environment/endpoints
   and API/Web IDs bound to OCI digests. Foundation verification must retain
   explicit blockers for the unset primary Desktop artifact and endpoints.
5. Scan/sign/SBOM according to the operator-approved supply-chain policy.
6. Promote the same digest to staging. Do not rebuild on the server and do not
   use `latest`.

Internal workload commands:

| Workload                  | Command                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| API                       | `WORKLOAD_ROLE=api node dist-deploy/server.js`                                     |
| OLTP migration            | `WORKLOAD_ROLE=migration node dist-deploy/migrate.js`                              |
| DWH schema                | `WORKLOAD_ROLE=dwh-schema node dist-deploy/dwh-schema.js`                          |
| Jobs                      | `WORKLOAD_ROLE=jobs node dist-deploy/jobs.js`                                      |
| Retention legacy backfill | `WORKLOAD_ROLE=migration node dist-deploy/retention-backfill.js` (dry-run default) |
| Web                       | Nginx image default command on internal `8080`                                     |

The target's runtime/IaC syntax is intentionally undefined until a provider is
authorized.

## 6. SQL and migration rehearsal

Before application rollout:

1. Print redacted target identity and prove `STAGING`, `production=false`,
   OLTP != DWH and neither name is a local default.
2. Prove SQL version/compatibility >= SQL Server 2016/level 130 and encrypted
   connection with certificate validation.
3. Take/verify OLTP backup; restore a recent backup to an isolated database
   when required by the selected change/RPO policy.
4. Preview ordered migration inventory/checksums `001`-`039`.
5. Run one OLTP migration workload. Each file/checksum is transactional and
   any non-zero result stops rollout.
6. Run a verification/idempotency invocation: all checksums match and no file
   is reapplied.
7. Run one DWH schema workload and verify the immutable `dwh-08-002` base plus
   the additive `dwh-08-003` head and both recorded checksums.
8. Verify SCD2 intraday ordering with `updated_at` + `ROWVERSION`, half-open UTC
   intervals `[valid_from, valid_to)`, idempotent replay and no overlap.
9. Keep ETL disabled until synthetic OLTP fixtures and schema checks pass.

For legacy recordings with null `retention_until`, run
`retention-backfill.js` first in its default dry-run mode. Applying one bounded
batch requires the same remote one-shot preflight plus
`RETENTION_BACKFILL_APPLY=true` and
`RETENTION_LEGAL_HOLD_REVIEW_ATTESTED=true`. A policy-year change never silently
rewrites existing non-null deadlines; it requires a separately approved data
change and legal review.

The runner rejects `--force` in STAGING/PRODUCTION. Never seed/reset/drop a target
without a separate authorized procedure. Production guards must remain false
because this target is STAGING.

## 7. Synthetic data contract

No production copy or real PHI is permitted. Minimum curated fixture:

- at least two synthetic sucursales and professionals with distinct roles;
- active/inactive users, revoked sessions and 2FA test identities;
- synthetic patients assigned across tenants, including denial cases;
- consultations, anthropometry, labs, meal plans and adherence across dates;
- synthetic meal photos/recording blobs small enough to test storage/retention;
- document metadata pointing only to approved synthetic storage objects;
- DWH deltas for every pipeline, malformed/reject fixture and deletion/update;
- approved/revoked/expired RAG documents and no-answer queries;
- memory consent, expiry, same-patient and cross-patient/tenant cases;
- synthetic telemetry and PHI/secret marker strings;
- no real email, phone, provider key, payment or recipient.

Fixture creation and cleanup are versioned/reviewed operations. Generic
production seed is not the acceptance fixture mechanism.

## 8. Workload rollout order

1. Edge/DNS/TLS infrastructure ready but no public app traffic.
2. SQL targets, backups and SecretProvider ready.
3. OLTP migration one-shot PASS.
4. DWH schema one-shot PASS.
5. API replica `1`, `API_REPLICAS=1`, `BACKGROUND_JOBS_ENABLED=false`;
   liveness then readiness.
6. Web artifact and `/api`/WSS proxy; public HTTPS health.
7. Synthetic auth/sync/data smokes.
8. Jobs replica `1`, `JOBS_REPLICAS=1`, explicit retention/ETL
   schedule/timezone; retention begins in dry-run and the first ETL is manually
   observed/reconciled.
9. Desktop staging artifact with exact API URL/CSP, if Desktop remote flow is
   part of the acceptance.
10. Full E2E, backup/restore and rollback evidence.

Do not start jobs before migration/schema/fixture checks. Do not scale API or
jobs horizontally.

## 9. Infrastructure and security smokes

| Smoke           | Acceptance                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- |
| DNS/TLS         | expected names resolve; chain valid; TLS 1.2+; renewal monitored                          |
| HTTP redirect   | public HTTP redirects or is closed; no plaintext API                                      |
| Web cache       | HTML/SW revalidate; hashed assets immutable; rollback serves prior HTML/assets coherently |
| CORS            | approved Browser/Tauri origins allowed; wildcard/unapproved origin denied                 |
| Proxy identity  | correct client/proto behind bounded `TRUST_PROXY`; spoofed forwarded headers ineffective  |
| WSS             | authenticated upgrade, heartbeat/idle duration, reconnect and graceful deployment drain   |
| Firewall        | SQL/runtime/admin ports inaccessible from public network                                  |
| Filesystem/user | API/Web non-root; runtime works read-only with only declared tmpfs                        |
| Secret leak     | image/history/labels/env output/logs/manifest contain no values                           |
| PHI leak        | synthetic marker absent from logs, telemetry, error responses, artifacts and proxy pages  |
| Side effects    | provider counters/recipient sink prove no real contact/billing                            |

## 10. Required staging acceptance E2E

The acceptance path is one connected execution, not a collection of mocks:

```text
Frontend (Web and approved Desktop target where applicable)
  -> authentication / 2FA / tenant selection
  -> shared API over HTTPS/WSS
  -> OLTP read/write + sync conflict/idempotency
  -> DWH ETL + semantic analytics + reconciliation
  -> governed RAG retrieval/no-answer
  -> memory consent/isolation/expiry
  -> observability/alerts without PHI
  -> AI local-auto evaluation => ABSTAIN_NO_ELIGIBLE_MODEL
  -> Patient AI remains DISABLED
  -> professional shadow remains BLOCKED_BY_MODEL
```

### Auth and authorization

- login, refresh/session behavior, logout/revocation and inactive denial;
- admin/nutritionist/patient-portal role boundaries;
- tenant/sucursal and patient scope allow/deny;
- sensitive action grant one-time/replay/expiry behavior;
- no tokens/cookies/credentials in logs.

### Desktop/Web sync

- server manifest API `v1` + sync `2` accepted;
- pull cursor, atomic Dexie batch and soft delete;
- push idempotency, expected row version, explicit conflict and retry recovery;
- offline create/edit/reconnect flow with synthetic data;
- API/sync mismatch fixture fails closed before Dexie/server mutation;
- cache/version skew for previous Web artifact inside API `v1`.

### WebSocket/telemedicine/chat

- ticket/auth success and rejection through `Sec-WebSocket-Protocol`;
- query-string tickets rejected and no ticket/subprotocol credential in edge,
  proxy or application logs;
- cross-tenant/cross-patient subscription denied;
- Web chat/telemedicine message flow over WSS;
- camera/microphone permission policy allows self;
- TURN config only from the authenticated server-controlled endpoint, which
  declares `OPTIONAL_DIRECT_ALLOWED`; endpoint failure blocks signaling,
  `configured=false` permits direct ICE, and `configured=true` requires valid
  ephemeral TURN credentials; no durable credential in frontend artifact;
- reconnect and graceful shutdown close behavior.

### OLTP

- CRUD for all synthetic sync entities with authorization;
- photos/recording/document reference paths where implemented;
- UTC timestamps, row versions, unique/foreign/check constraints;
- migration table `039/039`, checksums and second-run idempotency.

### DWH/ETL

- all pipelines complete with head `dwh-08-003`, preserving the immutable
  `dwh-08-002` lineage record;
- watermarks advance only after success;
- rerun produces no duplicates;
- multiple same-millisecond changes use source `ROWVERSION` ordering and retain
  non-overlapping `[valid_from, valid_to)` history;
- source = inserted/updated + filtered + rejected per reconciliation contract;
- unexpected row loss = `0`;
- malformed rows appear in rejects;
- freshness and semantic analytics match curated expected values;
- overlapping trigger is refused; exactly one scheduler observed because ETL
  remains `BLOCKED_NO_LEASE_RENEWAL` for multi-runner operation.

### RAG and memory

- approved/current docs retrievable with valid citation;
- revoked/expired/unauthorized docs excluded;
- unsupported query returns explicit no-answer;
- same patient/tenant memory allowed only with consent;
- cross-patient/cross-tenant memory denied, TTL/retention exercised;
- production-persistence choice is SQL, not process memory, if restart
  persistence is part of target acceptance.

### Observability and AI safety

- release/commit/environment/instance labels correct;
- AI infrastructure status separated from model eligibility;
- kill switch returns safe disabled response and provider calls = `0`;
- current eligible clinical model = `NONE`;
- `NUTRICLINICA_LOCAL_AUTO=ABSTAIN_NO_ELIGIBLE_MODEL` is expected PASS;
- failed/non-eligible models are never invoked;
- Patient AI = `DISABLED`;
- professional shadow = `BLOCKED_BY_MODEL`, clinical sample `0`;
- synthetic PHI/secret marker leakage = `0`.

## 11. Backup, restore, and rebuild acceptance

- take OLTP backup after fixture/migration checkpoint;
- restore to a distinct database and run schema + synthetic functional checks;
- measure duration and compare to selected RTO;
- verify backup age/chain against selected RPO;
- prove DWH backup restore or full schema+ETL rebuild within DWH RTO;
- verify referenced document objects and key recovery separately;
- never restore into the active target during rehearsal;
- record artifact IDs, checksums and operator, not secret values.

## 12. Rollback acceptance

1. Retain previous known-good API/Web digests and compatible config.
2. Deploy current artifacts, complete smoke, then intentionally roll app
   artifacts back in a controlled rehearsal.
3. Re-run health, auth, sync, WSS and key synthetic data checks.
4. Do not downgrade OLTP/DWH destructively. If prior app is schema-incompatible,
   rollback is blocked and a forward repair plan is required.
5. Re-enable exactly one jobs runner only after rollback checks.

If no prior compatible artifact exists, record
`BLOCKED_BY_NO_PRIOR_ARTIFACT`; do not claim rollback PASS.

## 13. Side-effect matrix for staging

| Effect                | Required staging setting                                                                    | Acceptance evidence                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Email                 | `DISABLED` or approved sandbox                                                              | synthetic sink only; no recipient/subject in logs                                       |
| TURN                  | server-controlled `OPTIONAL_DIRECT_ALLOWED`; staging TURN or explicit direct/STUN limitation | authenticated response, endpoint-failure signaling block, capacity/connectivity, no bundle secret |
| AI cloud              | `AI_EGRESS_ENABLED=false` unless separately approved synthetic test                         | provider calls `0` by default                                                           |
| Patient AI            | `AI_PATIENT_ENABLED=false`                                                                  | startup/readiness and route denial                                                      |
| Professional shadow   | `AI_SHADOW_STATE=DISABLED`                                                                  | readiness honestly `BLOCKED_BY_MODEL`                                                   |
| Payments/SMS/webhooks | NOT_CONFIGURED                                                                              | no endpoints/credentials/calls                                                          |
| Retention deletion    | synthetic recordings only; dry-run first, legal-hold review attested, approved UTC schedule | one runner because status is `BLOCKED_NO_DISTRIBUTED_LOCK`; aggregate result, no patient ID in logs |

## 14. Stop conditions

Immediately stop rollout on:

- any production hostname/account/database/credential/connectivity;
- UNKNOWN/LOCAL identity or equal/default OLTP/DWH;
- unsigned/unidentified mutable artifact or SHA mismatch;
- backup unreadable, restore failure or RPO/RTO violation;
- migration checksum drift, partial migration or DWH schema drift;
- plaintext/public SQL, invalid TLS, wildcard CORS/CSP or unbounded proxy trust;
- secret/PHI marker in image, labels, logs, telemetry or response;
- unauthorized side effect/provider call;
- cross-tenant/patient data leak;
- unexpected DWH row loss or duplicate jobs;
- Patient AI/model/shadow becoming enabled/eligible without its own gate;
- regression or rollback failure without an approved forward-only decision.

## 15. Evidence package

The staging report must include:

- authorization/change ID and owners;
- target architecture and redacted configuration/SecretProvider references;
- source SHA, release, API/Web/Desktop artifact IDs/digests and manifest;
- SQL engine/profile, OLTP/DWH identities, versions/checksums;
- migration/schema job logs sanitized;
- DNS/TLS/WSS/CORS/firewall evidence;
- E2E result per section 10;
- DWH reconciliation/freshness;
- backup/restore/rebuild timings and selected RPO/RTO;
- rollback result or exact blocker;
- secret/PHI scans and side-effect counters;
- AI/Patient AI/model/shadow exact statuses;
- unresolved risks and operator actions.

## 16. Current gate

No host, SQL target, DNS/TLS, SecretProvider, backup target, storage, artifact
registry or authorized operator inputs exist. No part of sections 3-15 has
been executed against real infrastructure.

REAL STAGING = `BLOCKED`.

`ENVIRONMENT_CLASS=STAGING` declares identity only. Machine-readable
availability remains `NOT_AVAILABLE` until
`STAGING_AVAILABILITY_ATTESTED=true`, `STAGING_SMOKE_STATUS=PASS`, an external
`STAGING_EVIDENCE_ID`, and `STAGING_EVIDENCE_COMMIT` matching `GIT_COMMIT` are
supplied together.

STAGING IS LOCALHOST = `NO`.

PRODUCTION TOUCHED = `NO`.
