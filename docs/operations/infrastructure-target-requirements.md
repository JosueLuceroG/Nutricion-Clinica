# Infrastructure Target Requirements

Fecha: 2026-08-27. Estado: operator handoff, provider-agnostic. Este documento
define criterios de selección y aceptación; no autoriza compras,
provisionamiento ni acceso a producción.

## 1. Required target decision

Antes de Step 03 el operador debe registrar una decisión explícita para cada
input. `TBD` no permite bring-up.

| Input                          | Required decision/evidence                                     | Current state                |
| ------------------------------ | -------------------------------------------------------------- | ---------------------------- |
| Environment owner              | persona/equipo on-call y approver de cambios                   | PENDING                      |
| Environment class/name         | `STAGING`, nombre e instance naming scheme                     | PENDING                      |
| App host/runtime               | OCI runtime, OS, architecture, zones/failure domain            | PENDING; Linux OCI PREFERRED |
| SQL OLTP target                | server/instance, database identity, edition/version, auth, TLS | PENDING                      |
| SQL DWH target                 | distinct database identity; host/auth/TLS                      | PENDING                      |
| DNS                            | public/private names and owner                                 | PENDING                      |
| TLS                            | CA, issuance/renewal, key custody, minimum protocol            | PENDING                      |
| SecretProvider                 | product/process, access policy, audit and rotation owner       | PENDING                      |
| Persistent object/file storage | documents/future uploads, encryption and lifecycle             | PENDING                      |
| Backup target                  | off-host location, encryption, immutability and restore target | PENDING                      |
| RPO/RTO                        | OLTP, DWH, document storage and application separately         | PENDING                      |
| Log/metric sink                | destination, access, retention, alerts and PHI policy          | PENDING                      |
| Egress policy                  | SMTP, TURN, AI/provider destinations                           | PENDING; default DENY        |
| Artifact registry              | immutable image IDs/digests and retention                      | PENDING                      |
| Desktop public API origin      | stable HTTPS/WSS hostname and CSP approval                     | PENDING                      |
| Capacity                       | users, concurrency, storage growth, ETL window and retention   | PENDING                      |
| Budget/data residency          | approved ceiling and legal/organizational region               | PENDING                      |

The non-secret driver shape is
`deployment/config/deployment-inputs.example`; values remain placeholders until
the operator authorizes a target.

## 2. Target options

| Option                     | Fit                                                                                | Required additions                                                                | Classification           |
| -------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| Linux VM/VPS + OCI runtime | simplest portable app-plane target                                                 | patching, firewall, service/runtime supervision, backups/log sink                 | PREFERRED BASELINE       |
| On-prem Linux OCI host     | valid where network/data policy requires                                           | redundant power/storage/network, patch/on-call process                            | ACCEPTABLE WITH EVIDENCE |
| Managed container runtime  | valid if long WSS, one-shot jobs, private SQL, read-only FS and exact secrets work | service-specific adapter/IaC after authorization                                  | ACCEPTABLE WITH EVIDENCE |
| Windows Server native Node | useful with Windows operational standards/NTLM                                     | Node 24, process manager, artifact extraction, ACLs, log/health supervision       | SUPPORTED SECONDARY      |
| Windows containers         | current Linux images do not apply                                                  | separate images and full regression                                               | NOT BASELINED            |
| Kubernetes                 | technically possible                                                               | ingress, jobs, secrets, PVC/SQL networking, observability and operator competence | NOT SELECTED             |

Selection may not change Desktop-first identity, introduce a second backend,
embed credentials in clients or weaken SQL/TLS guards.

## 3. Preferred host OS and architecture

Preferred app-plane host: **LINUX**, x86_64, with a supported OCI runtime.
Rationale: current API/Web Dockerfiles are Linux images; non-root/read-only
behavior and GitHub-hosted Linux CI form one reproducible path. This preference
does not constrain the SQL Server host.

| Target                                        | State                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| Linux x86_64 app plane                        | PREFERRED / artifact definition exists                                 |
| Linux arm64 app plane                         | POSSIBLE but native `argon2` and image build/runtime evidence required |
| Windows Server native app plane               | ALTERNATIVE; no container parity claim                                 |
| SQL Server on Windows                         | SUPPORTED by driver; Windows/NTLM or SQL Auth                          |
| SQL Server on Linux/compatible managed target | SUPPORTED if SQL profile, TLS and backup/restore pass                  |

## 4. Initial capacity baseline

These are provisional **staging floors**, not production sizing claims. The
operator must replace them with load-test evidence before production.

| Workload | Provisional staging floor                       | Scale trigger / required measurement                                              |
| -------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Edge/Web | 1 vCPU, 512 MiB RAM, 5 GiB OS/runtime           | request rate, TLS handshakes, asset egress, WSS connection count                  |
| API      | 2 vCPU, 4 GiB RAM, 10 GiB non-data disk         | p95/p99 latency, event-loop lag, argon2 concurrency, body/blob size, open sockets |
| Jobs     | 1 vCPU, 2 GiB RAM, 5 GiB non-data disk          | retention rows/run, ETL duration/memory and load window                           |
| SQL OLTP | 4 vCPU, 16 GiB RAM, SSD, capacity formula below | buffer hit, CPU, IOPS, locks/deadlocks, log growth, backup duration               |
| SQL DWH  | 4 vCPU, 16 GiB RAM, SSD, capacity formula below | ETL window, MERGE temp/log use, query concurrency, reconciliation duration        |

No workload stores durable data on app host disk. Container image/cache and
logs are bounded/rotated. SQL/data/backup storage must not share an ephemeral
root volume.

Required load inputs:

- licensed/active professionals, patients and sucursales;
- peak concurrent Desktop/Web sessions and WebSockets;
- concurrent telemedicine rooms and TURN bandwidth;
- auth/argon2 operations per minute;
- API request rate and p95 payload size;
- current OLTP data/index/log size and daily growth;
- recording/photo/document average size and retention distribution;
- DWH row counts, daily deltas, ETL completion window and analytics concurrency;
- log/telemetry events per second and retention;
- backup size, throughput and restore throughput.

Until these values and a load test exist, production capacity status is
`PENDING_MEASUREMENT`.

## 5. Storage sizing and lifecycle

Minimum provisioned capacity is calculated, not guessed:

```text
OLTP data = current data + projected growth through review horizon
OLTP provisioned = (data + indexes + retained blobs) * 1.30 free-space factor
OLTP log = measured peak migration/write/log-backup interval, with alert headroom
DWH provisioned = current facts/dimensions + projected ETL growth + 30% work/headroom
Backup target = retained full + differential/log chain + isolated restore workspace
Document storage = retained object bytes + version/lifecycle overhead + 20% headroom
```

Required controls:

- encrypted persistent storage and encrypted backup target;
- capacity alerts before 70%, 80% and 90%; exact thresholds may be adjusted
  from measured growth but not omitted;
- separate identities/ACLs for SQL data, document storage and backups;
- no backup in Git, image layer, public bucket/share or app filesystem;
- document URL storage must use allowlisted origins, private access and an
  explicit delete/retention contract before real uploads;
- SQL temp/work files and transaction logs included in capacity monitoring;
- Desktop Dexie remains workstation-local and is not counted as server
  recovery coverage.

## 6. RPO/RTO decision matrix

No production RPO/RTO has been approved. Select a tier separately for OLTP,
DWH, document storage and app service, then prove it by timed restore/failover.

| Candidate tier                | RPO mechanism                                                | Target RPO | Target RTO | Operational requirement                                          |
| ----------------------------- | ------------------------------------------------------------ | ---------: | ---------: | ---------------------------------------------------------------- |
| Development/local             | disposable/rebuild                                           |       NONE |       NONE | never clinical production data                                   |
| Staging rehearsal             | daily full + pre-change backup                               |     <=24 h |      <=8 h | isolated restore each release cycle                              |
| Production baseline candidate | daily full + differential + log every 15 min/PITR equivalent |   <=15 min |      <=4 h | monitored chain, off-host copy, quarterly timed restore minimum  |
| High-availability candidate   | target-specific replication + PITR                           |    <=5 min |      <=1 h | redundant failure domains, failover runbook and regular exercise |

`Production baseline candidate` is a recommendation for decision, not a
granted SLA. Clinical/legal owner, infrastructure owner and budget owner must
approve exact values. DWH may accept a longer RPO if rebuild from OLTP meets
its approved RTO; OLTP cannot rely on DWH as backup.

## 7. Backup, restore, and disaster recovery

Target must provide SQL-native `BACKUP DATABASE` or a demonstrably equivalent
consistent/PITR mechanism. Acceptance evidence:

1. full backup of OLTP and, if required by selected tier, DWH;
2. encryption and restricted backup principal;
3. off-host/independent failure domain and retention/lifecycle;
4. integrity verification/checksum where target supports it;
5. restore into distinct non-production database identities;
6. schema/version, row-count and synthetic functional checks;
7. measured backup/restore durations against RPO/RTO;
8. documented key recovery and ownership;
9. deletion/expiration test without deleting the only valid recovery point;
10. restore rehearsal before high-risk migration and at approved cadence.

The app repository intentionally does not create a generic backup wrapper:
SQL backup syntax, logical file names, managed-service APIs, encryption and
storage paths are target-specific and potentially destructive. The existing
`scripts/verify-deployment-b09-5a.ps1` is local disposable evidence only.

Disaster recovery must address independently:

| Component           | Recovery source                                             |
| ------------------- | ----------------------------------------------------------- |
| API/Web/jobs        | immutable image digest + release manifest + target config   |
| OLTP                | verified SQL backup/PITR chain                              |
| DWH                 | DWH backup or schema + replay/rebuild from OLTP within RTO  |
| Documents           | versioned/encrypted storage backup or replication           |
| Secrets             | SecretProvider recovery/rotation procedure, not app backups |
| Desktop local state | sync from OLTP plus supported user backup boundaries        |
| Logs/audit          | approved sink retention/export policy                       |

## 8. SQL Server support profile

| Capability            | Requirement/evidence                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimum engine        | SQL Server 2016-compatible with database compatibility level >=130                                                                                               |
| Validated engine      | SQL Server 2022 Express in prior real-SQL/local evidence                                                                                                         |
| Driver                | `mssql@11.0.1` / tedious path; explicit TCP preferred                                                                                                            |
| Auth                  | SQL Auth canonical for Linux container; NTLM path only on validated compatible host                                                                              |
| TLS                   | `encrypt=true`, `trustServerCertificate=false`, trusted CA/name outside local                                                                                    |
| OLTP/DWH              | distinct logical databases; may use distinct server/auth                                                                                                         |
| Time                  | application/schema use UTC (`SYSUTCDATETIME`, `DATETIME2`); host clock sync required                                                                             |
| Required SQL features | `OPENJSON`, `ISJSON`, `STRING_SPLIT`, `MERGE ... HOLDLOCK`, transactions, lock hints, filtered indexes, `OFFSET/FETCH`, dynamic SQL, `ROWVERSION`, GUID/identity |
| Not required          | SQL Agent, cross-database queries, linked servers, FILESTREAM, public SQL Browser                                                                                |
| Migrations            | files `001`-`039`, SHA-256 checksums, ordered `GO` batches; no automatic API migration                                                                           |
| DWH                   | idempotent schema `dwh-08-002`, checksum/version table, ETL MERGE/watermarks/reconciliation                                                                      |

SQL Server Express has database size/CPU/memory and SQL Agent constraints. It
is valid for local evidence and possibly small staging, but production
selection requires measured capacity and an approved support/backup model.

Each OLTP migration file and its checksum record execute in one SQL transaction;
the runner stops at the first drift or failure. Existing files remain immutable,
backups are mandatory, and any legacy partial state from an older runner requires
diagnosis plus an explicit forward-repair migration. `--force` is rejected in
STAGING/PRODUCTION.

## 9. Network and firewall requirements

| Zone/flow  | Source -> destination                    | Rule                                    |
| ---------- | ---------------------------------------- | --------------------------------------- |
| Public     | clients -> edge `443/TCP`                | allow HTTPS/WSS only; HTTP may redirect |
| Runtime    | edge -> Web `8080/TCP`                   | private allowlist                       |
| Runtime    | edge/Web -> API `3000/TCP`               | private allowlist; preserve WS upgrade  |
| Data       | API/jobs/one-shot -> SQL TCP             | private allowlist to exact host/port    |
| Management | authorized admin -> hosts/SQL            | VPN/bastion/private route; audited      |
| Egress     | API/jobs -> DNS/NTP/SMTP/TURN/AI/storage | default deny, destination allowlist     |
| Backup     | SQL/backup agent -> backup target        | write/read only as required; not public |

Public SQL, runtime admin ports, Docker socket and metrics with sensitive
labels are prohibited. Edge must sanitize forwarded headers. Rate limiting,
body limits and timeout values require load evidence and WebSocket exceptions.

## 10. DNS, TLS, CORS, and Desktop CSP

Required before any real staging claim:

- operator-owned DNS names for Web/API or one same-origin name;
- TLS 1.2+ certificate chain accepted by browser and Tauri WebView;
- automated renewal with alerting and documented key custody;
- exact `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `CORS_ORIGIN` and `TRUST_PROXY`;
- WSS upgrade/idle timeout/reconnect smoke;
- no wildcard CORS or CSP;
- Tauri build/config with the exact HTTPS/WSS API origin;
- HSTS only after name/renewal verification;
- cache behavior proving HTML/service-worker revalidation and immutable hashed
  assets during release/rollback.

Desktop remote CSP remains `PENDING_TARGET_ORIGIN`; Step 02 does not invent a
domain.

## 11. SecretProvider contract

The architecture names an abstraction, not a vendor. A valid SecretProvider
must support workload-scoped read access, audit, encryption, rotation,
revocation, version recovery and no plaintext in CI logs. Current code consumes
environment variables; a mounted-file/workload-identity adapter would require
explicit implementation and tests.

| Secret                        | Workloads                                                                     | Rotation impact                                                | Required separation                                        |
| ----------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `DB_PASSWORD`                 | API/jobs/OLTP migrate                                                         | recycle pools/workloads; coordinate principal                  | dedicated non-admin app/migration rights as target permits |
| `DWH_PASSWORD`                | API readiness/jobs/DWH schema                                                 | recycle pools/workloads                                        | distinct from OLTP when independent target                 |
| `JWT_SECRET`                  | API                                                                           | active token compatibility/revocation plan                     | never shared with encryption/TOTP                          |
| `FIELD_ENCRYPTION_KEY`        | API                                                                           | key-versioned data migration/recovery required before rotation | backed up under restricted key custody                     |
| `TOTP_ENCRYPTION_KEY`         | API                                                                           | re-encryption/re-enrollment plan                               | independent recommended                                    |
| `SMTP_PASS`                   | API                                                                           | no data migration                                              | side effects disabled until verified                       |
| `TURN_SHARED_SECRET`          | API only; derives ephemeral coturn REST credentials for authenticated clients | rotate with overlap/call-drain plan                            | never `VITE_*`, response payload or image metadata         |
| `OPENAI_API_KEY`/`AI_API_KEY` | API/evaluation only if authorized                                             | egress disabled during rotation                                | no frontend/Patient AI implication                         |
| Registry/deploy credential    | CI/operator driver                                                            | artifact promotion only                                        | never passed to app containers                             |
| Desktop signing keys          | release CI only                                                               | platform-specific                                              | not runtime/staging secrets                                |

Startup/logging must emit variable names/status only, never values. A committed
`.env`, generic shared admin password or credential in image history is a
release blocker.

## 12. Runtime configuration

The exhaustive matrix is
`docs/operations/runtime-configuration-matrix.md`. Target acceptance must
produce a redacted configuration inventory with:

- source/owner for every non-secret value;
- SecretProvider reference and version for every secret (not the value);
- workload scope and restart/rotation behavior;
- explicit values for environment identity, hosts, DB names, TLS, CORS,
  proxy, jobs and kill switches;
- exact `WORKLOAD_ROLE` per entrypoint and no API-only JWT/encryption secrets in
  jobs/one-shot workloads;
- proof that API has `BACKGROUND_JOBS_ENABLED=false` and the sole jobs process
  has it `true`;
- commit-bound secret-scan evidence and `repo@sha256` API/Web references;
- AI egress off, Patient AI off, shadow disabled and external effects
  disabled/sandbox unless separately authorized.

## 13. External side-effect policy

| Integration           | Current implementation                                 | Staging default                                                            | Production prerequisite                                                    |
| --------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| SMTP                  | actual Nodemailer adapter                              | DISABLED or approved sandbox synthetic recipients                          | approved sender, recipient policy, SecretProvider, audit and egress        |
| TURN/STUN             | authenticated ICE endpoint; no browser/public fallback | approved staging TURN or explicit STUN-only endpoint with known limitation | capacity/region/retention/security assessment, ephemeral credentials       |
| AI OpenAI/Ollama      | adapters with egress/qualification gates               | egress false; eligible model NONE                                          | provider data policy, credential, residency/retention, model certification |
| Patient AI            | routes/config exist                                    | DISABLED and startup rejects true                                          | separate clinical gate; not granted                                        |
| Payments/SMS/webhooks | no real provider found                                 | NOT_CONFIGURED                                                             | new design/threat/side-effect contract required                            |

No staging smoke may contact a real patient/user or billable production
provider. Provider-call counters and synthetic recipients prove zero unintended
effects.

## 14. Observability and operations

Target must provide:

- process/container logs with service, release, commit, environment and
  instance labels;
- no raw request bodies, tokens, SQL errors with credentials, recipient,
  subject, patient IDs or synthetic PHI marker;
- metrics/alerts for API liveness/readiness, latency/errors, event-loop lag,
  WebSocket connections, SQL pool/connectivity, disk/log growth, job success,
  ETL freshness/reconciliation, backup age and certificate expiration;
- clock synchronization and timestamps in UTC;
- log retention, deletion, access reviews and incident owner;
- restart policy with bounded backoff; migration jobs never auto-retry without
  operator review;
- maintenance/change windows for migrations and restore drills;
- release rollback artifact/digest retained for the approved window.

Current app outputs stdout/stderr and coarse health. External sink, dashboards,
SLOs and alert routing are `PENDING_TARGET`.

## 15. CI/CD and artifact supply chain

Required portable gates before promotion:

1. frozen dependency install;
2. lint, typecheck, unit/integration suites and builds;
3. API deploy bundle startup/jobs/one-shot guard checks;
4. Web artifact secret/localhost/source-map and Nginx contract check;
5. API/Web image builds from exact commit;
6. image vulnerability/SBOM/signing policy selected by operator (currently
   `NOT_IMPLEMENTED`, therefore a production blocker if required);
7. release manifest and OCI labels with SHA/release/artifact IDs/digests;
8. Compose local simulation only as an artifact smoke;
9. secret/PHI scans;
10. promotion of the same digest, never rebuild-on-server or `latest`.

CI has no deployment credential and must not add a fake deploy job before a
target is authorized.

## 16. Application-impact checks for target choices

| Infrastructure choice             | Required application verification/change                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| More than one API replica         | BLOCKED: add shared WebSocket broker/routing and externalize in-process state/rate limits |
| More than one jobs replica        | BLOCKED: add atomic distributed leases for every job, especially retention                |
| SQL host/port/auth change         | connection/TLS/least-privilege and migration/DWH real-SQL tests                           |
| Managed SQL without native `.bak` | define equivalent PITR/export and prove isolated restore                                  |
| CDN/cache                         | verify service worker, HTML no-cache, hashed assets, rollback skew/API v1 compatibility   |
| Different public API hostname     | rebuild Desktop with exact `VITE_API_URL` and CSP HTTPS/WSS allowlist                     |
| Object storage introduction       | implement adapter, signed/private access, malware/content controls, lifecycle and backup  |
| Secret files/workload identity    | implement provider adapter; current code reads env                                        |
| ARM host                          | rebuild/test native dependencies and both images on ARM                                   |
| Public AI/TURN/SMTP               | update egress/data policy and run sandbox/zero-PHI evidence                               |

## 17. Acceptance gate

A target is acceptable only when every required decision in section 1 is
resolved and evidence shows:

- non-production identity and no production connectivity;
- immutable API/Web artifacts from an approved commit;
- private, encrypted, distinct OLTP/DWH;
- backup and isolated restore within selected RPO/RTO;
- DNS/TLS/WSS/CORS/Desktop CSP exact;
- non-root runtime, bounded filesystem, ports/firewall and SecretProvider;
- one API and one jobs runner, with migrations one-shot;
- observability/alerts and zero PHI/secrets in logs/artifacts;
- synthetic staging E2E and rollback result;
- no unauthorized external side effects.

Current target gate: **PENDING_OPERATOR_INPUT / REAL STAGING BLOCKED**.
