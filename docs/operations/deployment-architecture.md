# NutriClinica Deployment Architecture

Fecha: 2026-09-08. Estado: arquitectura objetivo aprobada para construir y
verificar; ningun target real ha sido provisionado. Provider-agnostic.

## 1. Decision summary

- Canal primario: `DESKTOP_TAURI`; canal secundario: Web.
- Desktop y Web consumen un unico API Express y los contratos API `v1`, sync
  `2`, Dexie `33`, OLTP `039` y DWH head `dwh-08-003`.
- Ruta canonica del servidor: imagen API + imagen Web en un runtime OCI, con
  edge TLS externo y SQL Server privado. Desktop nunca se containeriza.
- API, jobs y migraciones usan la misma imagen API, pero son procesos y ciclos
  de vida distintos.
- Escala inicial: una replica API y un runner de jobs. Escala horizontal esta
  bloqueada hasta externalizar estado/broadcast in-process y completar los
  locks distribuidos restantes.
- Ningun componente elige proveedor, registry, DNS, CA, secret manager,
  storage o scheduler especificos.

ADRs: `0012-desktop-first-shared-backend.md`,
`0013-portable-server-containers.md` y
`0014-sql-lifecycle-and-jobs-runner.md`.

## 2. Logical architecture

```text
Desktop Tauri (Dexie/offline) -------- HTTPS/WSS --------+
                                                       |
Browser Web ---------------- HTTPS/WSS ----------------+--> DNS/TLS edge
                                                             |
                                     +-----------------------+----------------+
                                     |                                        |
                               Web container                            API container
                               Nginx :8080                              Express :3000
                               assets + /api proxy                      HTTP + WebSocket
                                                                              |
                                          +----------------+------------------+-------------+
                                          |                |                                |
                                     OLTP SQL          DWH SQL                     controlled egress
                                     schema 039        dwh-08-003                  SMTP/TURN/AI
                                          ^                ^
                                          |                |
                                    migration job      DWH schema job
                                          ^                ^
                                          +------- jobs runner -------+
                                                  retention + ETL

SQL backup jobs --> protected off-host backup target --> isolated restore target
API/jobs/edge logs --> approved log sink (redacted, no raw PHI/secrets)
```

The diagram describes trust boundaries, not a selected vendor topology. Edge,
runtime, SQL and storage may be separate VMs, managed services or on-prem
hosts as long as the contracts below remain true.

## 3. Physical workload model

| Workload       | Artifact/command                                    |                 Count | Exposure                                        | Lifecycle                               |
| -------------- | --------------------------------------------------- | --------------------: | ----------------------------------------------- | --------------------------------------- |
| Desktop        | signed Tauri bundle                                 |       per workstation | outbound HTTPS/WSS                              | user application; not a server workload |
| DNS/TLS edge   | operator-selected                                   |    1 logical endpoint | public `443`                                    | target infrastructure                   |
| Web            | `Dockerfile`, Nginx `:8080`                         |               1+ safe | edge only                                       | immutable, replaceable                  |
| API            | `apps/api/Dockerfile`, `node dist-deploy/server.js` |       exactly 1 today | edge/private network                            | long-running                            |
| OLTP migration | same API image, `node dist-deploy/migrate.js`       | exactly 1 per rollout | SQL private network                             | one-shot before API replacement         |
| DWH schema     | same API image, `node dist-deploy/dwh-schema.js`    | exactly 1 per rollout | DWH private network                             | one-shot before ETL                     |
| Jobs           | same API image, `node dist-deploy/jobs.js`          |             exactly 1 | SQL private network; optional controlled egress | long-running, supervised                |
| SQL OLTP       | SQL Server compatible target                        |     1 logical primary | API/migration/jobs only                         | persistent                              |
| SQL DWH        | distinct SQL Server database/target                 |     1 logical primary | API/schema/jobs only                            | persistent/rebuildable                  |
| Backup/restore | SQL-native operator job                             |     1 schedule per DB | private storage path                            | external to application image           |
| Observability  | target-selected log/metric sink                     |        target-defined | private/administrative                          | no raw PHI or secrets                   |

The Web image can be scaled independently because assets are immutable. API
must remain single-replica despite being stateless for many HTTP routes; see
the replica matrix.

## 4. Trust boundaries and flows

1. Desktop and Browser trust only the approved public HTTPS origin. Desktop
   uses an exact build/CSP allowlist; Browser uses same-origin `/api`.
2. Edge authenticates the public server identity with TLS, forwards only
   required headers, supports WebSocket upgrade and never exposes SQL ports.
3. API performs auth, RBAC, tenant/patient scope, validation and rate limits.
   It is the only application trust boundary for backend secrets.
4. SQL credentials, JWT signing keys, field encryption keys, SMTP credentials
   and AI provider keys are injected server-side. No `VITE_*` value may be a
   durable secret.
5. Jobs use service credentials scoped to required OLTP/DWH actions. They are
   not reachable from public networks.
6. OLTP is authoritative. DWH is analytics-only and is populated from OLTP;
   clients never write DWH directly.
7. Backup artifacts leave the SQL data volume only for a protected, encrypted,
   off-host target. Restore verification uses a distinct database identity.

## 5. Persistence and storage map

| Data                           | Authoritative location                        | Durability/backup                                               | Deployment rule                                                    |
| ------------------------------ | --------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Offline Desktop state          | WebView Dexie/IndexedDB schema `33`           | workstation policy + supported local export limits              | preserve across app updates; never place in server container       |
| Sync queue/checkpoints         | Dexie                                         | local transactional recovery                                    | protocol `2`; mismatch fails closed before mutation                |
| Clinical OLTP entities         | SQL Server OLTP schema `039`                  | SQL-native full/diff/log policy selected by operator            | authoritative; private network; migration checksums immutable      |
| Meal photos/recording blobs    | OLTP `VARBINARY` columns where implemented    | part of OLTP backup capacity                                    | include in capacity/RPO sizing; no ephemeral filesystem assumption |
| Document content               | external URL referenced by OLTP `url_storage` | storage target must define durability, encryption and deletion  | current repo stores metadata/reference, not an upload backend      |
| Patient photo                  | OLTP value/URL according to current module    | part of OLTP or referenced storage policy                       | validate target size and retention before staging                  |
| DWH facts/dimensions/lineage   | distinct SQL Server DWH head `dwh-08-003`     | backup if RTO requires; otherwise tested rebuild from OLTP      | never same logical DB as OLTP                                      |
| RAG knowledge metadata/content | configured application store/source           | production target must document persistence and source recovery | no provider implied; memory mode is non-durable                    |
| AI memory                      | `memory` or SQL store by configuration        | use SQL for durable staging/production requirements             | tenant/patient isolation remains mandatory                         |
| AI telemetry/certification     | `memory` or SQL store                         | use SQL where restart persistence is required                   | certification failure remains fail-closed                          |
| Logs                           | stdout/stderr -> approved sink                | target retention/access policy                                  | structured operational metadata only; redact PHI/secrets           |
| CSV exports                    | Desktop Downloads directory                   | workstation/user responsibility                                 | never a server persistent volume                                   |
| SQL backups                    | operator `BACKUP DATABASE` target             | encrypted, protected, off-host and restore-tested               | not a container layer, Git artifact or Web download                |

No implemented application path relies on writable server filesystem as an
authoritative store. Container filesystems are read-only; only Nginx runtime
temp paths use `tmpfs`. A future upload implementation must add a storage
adapter and lifecycle contract rather than writing into a container.

The existing `docs/operations/local-backup-authorization.md` describes a
limited Desktop/Dexie export. It is not an infrastructure backup and does not
replace SQL backup/restore.

## 6. Containerization matrix

| Component                 | Containerized                             | Reason                                                             |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Desktop Tauri             | NO                                        | workstation application, WebView, platform signing and local Dexie |
| Web                       | YES                                       | immutable static assets and portable Nginx runtime                 |
| API                       | YES                                       | reproducible Node runtime and dependencies                         |
| Migration/DWH schema jobs | YES, same API image                       | exact code/schema identity, one-shot command                       |
| Retention/ETL jobs        | YES, same API image                       | isolated lifecycle and schedules                                   |
| Edge                      | TARGET-DEPENDENT                          | may be appliance, managed load balancer or reverse proxy container |
| SQL Server                | TARGET-DEPENDENT, separate from app image | persistent state, licensing/operations and independent lifecycle   |
| Backup storage            | NO application container                  | must survive host/image replacement                                |
| SecretProvider/log sink   | TARGET-DEPENDENT                          | infrastructure contract, never bundled into app image              |

## 7. Runtime artifacts and traceability

The Web image is built from root `Dockerfile`; the API image from
`apps/api/Dockerfile`. Both:

- pin build/runtime base image versions;
- install with `pnpm-lock.yaml` and `--frozen-lockfile`;
- run non-root;
- expose health checks;
- carry OCI labels `org.opencontainers.image.version` and
  `org.opencontainers.image.revision`;
- receive immutable `RELEASE_VERSION` and full 40-character `RELEASE_COMMIT`;
- exclude `.env`, credentials, dumps, backups, local builds and model weights
  through `.dockerignore`.

The API deployment build generates:

| File                                | Purpose                                         |
| ----------------------------------- | ----------------------------------------------- |
| `dist-deploy/server.js`             | API HTTP/WebSocket process                      |
| `dist-deploy/jobs.js`               | dedicated retention/ETL scheduler               |
| `dist-deploy/migrate.js`            | OLTP migrations `001`-`039`                     |
| `dist-deploy/dwh-schema.js`         | applies DWH chain through `dwh-08-003`           |
| `dist-deploy/retention-backfill.js` | bounded legacy retention dry-run/apply one-shot |
| `dist-deploy/healthcheck.js`        | role-aware API/jobs container probe             |
| `dist-deploy/dwh-schema.sql`        | immutable DWH DDL input                         |
| `dist-deploy/dwh-upgrade-08-003.sql` | additive intraday SCD2 upgrade                 |
| `migrations/*.sql`                  | immutable OLTP migration inputs                 |

The existing `release-manifest.json` builder captures release/commit,
environment and instance identity, an ISO generation timestamp in the legacy
`deployedAt` field, Desktop/Web/API versions, API/sync/Dexie/OLTP/DWH contracts,
endpoints, commit-bound scan evidence and artifact references bound to OCI
digests. It records requested API/jobs replicas, certified maximum `1/1`, ETL
`BLOCKED_NO_LEASE_RENEWAL` and retention
`BLOCKED_NO_DISTRIBUTED_LOCK`. Foundation verification may retain explicit Desktop/endpoint blockers;
deployment verification does not. It never contains credentials or PHI.

## 8. Network contract

| Flow                      | Default port/protocol           | Required control                                                |
| ------------------------- | ------------------------------- | --------------------------------------------------------------- |
| Client -> edge            | `443/TCP` HTTPS/WSS             | public; TLS 1.2+; approved DNS names                            |
| Edge -> Web               | `8080/TCP` HTTP private         | only edge/runtime network                                       |
| Edge/Web proxy -> API     | `3000/TCP` HTTP/WS private      | only edge/Web; preserve upgrade and forwarding headers          |
| API/jobs/migration -> SQL | target SQL TCP, normally `1433` | private ACL; encrypted driver connection; validated certificate |
| Named-instance discovery  | `1434/UDP` only if unavoidable  | avoid for canonical containers; prefer explicit host+port       |
| Jobs/API -> SMTP/TURN/AI  | target-specific TLS/UDP         | disabled by default; explicit allowlist and mode                |
| Admin -> runtime/SQL      | target-specific                 | VPN/bastion/private management plane; never public SQL          |

`TRUST_PROXY` is `false`, an exact hop count, or an explicit IP/CIDR list. It
must never be universal. The edge strips client-supplied forwarding headers
and sets its own `X-Forwarded-For`, `X-Forwarded-Proto` and `Host` values.

## 9. Health and readiness

| Probe                | Meaning                                         | Dependencies                                                | Failure action                                          |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| Web `/healthz`       | Nginx process serves responses                  | no API/SQL dependency                                       | restart/replace Web workload                            |
| API `/health/live`   | Node event loop and HTTP listener alive         | no SQL, DWH or AI                                           | restart API only on repeated liveness failure           |
| API `/health/ready`  | OLTP reachable; DWH reachable only when enabled | OLTP + required DWH                                         | remove from traffic; do not liveness-loop on SQL outage |
| Legacy API `/health` | alias of liveness                               | process only                                                | compatibility endpoint                                  |
| Jobs process         | role-aware marker + process supervision         | at least one explicit job and required SQL/schema preflight | restart with backoff; alert on repeated exit            |
| Migration/schema job | process exit `0`                                | target guard + SQL operation                                | stop rollout on non-zero                                |

AI provider/model eligibility is intentionally not an API readiness
dependency. Readiness reports model eligibility as `not_checked`; the separate
release gate currently reports `eligibleClinicalModel=NONE`. AI egress off and Patient AI off are
valid infrastructure states. Health responses expose only coarse status and
release metadata, never SQL error details, host credentials or request data.

## 10. Background jobs inventory

| Job                 | Code                       | Data/effect                                                                                     | Default deployed process                                | Multi-replica safe                                                                          |
| ------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Recording retention | `services/retention`       | dry-run by default; bounded deletion only after legal-hold review attestation; aggregate counts | exactly one `jobs.js`; explicit cron/timezone/retention | `BLOCKED_NO_DISTRIBUTED_LOCK`                                                               |
| DWH ETL             | `modules/dwh/scheduler.ts` | validates the one-shot DWH schema, then reads OLTP and loads/reconciles DWH                     | exactly one `jobs.js`; explicit cron/timezone           | `BLOCKED_NO_LEASE_RENEWAL`; atomic lease expires after 60 minutes                           |

Canonical deployed API sets `BACKGROUND_JOBS_ENABLED=false`. The jobs
workload sets it to `true` and must explicitly enable at least one job. API
startup does not run migrations, backup, restore, seed or DWH schema changes.

## 11. Replica-safety matrix

| Concern                             | Current state                            | Horizontal classification                                           |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| Stateless authenticated HTTP routes | mostly request/SQL scoped                | potentially safe after full route audit                             |
| WebSocket client registry/broadcast | process-local maps                       | BLOCKED without shared broker/routing                               |
| Rate limits/circuit/provider state  | process-local in several modules         | BLOCKED for globally consistent behavior                            |
| Memory RAG/memory/telemetry stores  | process-local when selected              | BLOCKED; SQL stores required for restart/replica durability         |
| Certification bootstrap             | SQL-capable, fail-closed                 | compatible only with SQL persistence and identical fingerprint      |
| Retention                           | no distributed lock                      | BLOCKED; exactly one jobs replica                                   |
| DWH ETL                             | process no-overlap plus atomic SQL lease | exactly one jobs replica until expiry renewal/ownership is hardened |

API replicas = `1`; jobs replicas = `1`. Sticky sessions alone are
insufficient because cross-process broadcasts and state still diverge.
`API_REPLICAS` and `JOBS_REPLICAS` default to `1`; malformed values fail in
every environment and values above `1` fail STAGING/PRODUCTION validation with
`MULTI_REPLICA_NOT_CERTIFIED`.

## 12. WebSocket and long-lived connection requirements

- Edge idle/read timeouts must exceed application heartbeat/session needs and
  must be tested with authenticated synthetic sessions.
- Preserve HTTP/1.1 upgrade, `Upgrade`, `Connection` and
  `Sec-WebSocket-Protocol` headers and original host/protocol metadata.
- The one-time ticket travels as the second WebSocket subprotocol after
  `nutriclinica-ticket`; query-string tickets are rejected. Edge logs must not
  capture the subprotocol header or any other credential.
- WSS is mandatory at public endpoints. Private edge-to-API HTTP/WS is allowed
  only on the isolated runtime network.
- Graceful termination removes the API from readiness, stops accepting new
  traffic, closes clients with code `1001`, drains HTTP up to
  `SHUTDOWN_TIMEOUT_MS`, then closes SQL pools.
- Current WebSocket tickets, auth and tenant scopes remain application-level
  controls. Edge reachability never substitutes for authorization.

## 13. Migration and data lifecycle

The immutable base DWH file has a historical header mismatch documented in
`dwh-schema-version-erratum.md`; that exact artifact remains registered as
`dwh-08-002`. The current chain head is `dwh-08-003`, applied additively by
`dwh-upgrade-08-003.sql`. The upgrade converts SCD2 validity to `DATETIME2(3)`,
orders source states by `updated_at` plus OLTP `ROWVERSION`, and preserves
existing rows.

Canonical rollout order:

1. Validate `repo@sha256` artifact bindings, full commit, commit-bound secret
   scan evidence, environment identity, targets, SecretProvider and storage.
2. Before a remote SQL one-shot, require its exact `WORKLOAD_ROLE`, validated
   TLS, `CHANGE_REQUEST_ID`, `BACKUP_RESTORE_ATTESTED=true` and
   `ROLLBACK_ARTIFACT_DIGEST`. PRODUCTION additionally requires the matching
   `ALLOW_PRODUCTION_*` control.
3. Take SQL-native backups according to RPO and prove that a recent backup is
   readable. High-risk changes require isolated restore rehearsal before the
   rollout.
4. Run exactly one `node dist-deploy/migrate.js`; non-zero stops deployment.
5. Run it again in rehearsal/verification to prove all files skip with matching
   checksums. The CLI rejects `--force` in STAGING/PRODUCTION.
6. If DWH is enabled, run exactly one `node dist-deploy/dwh-schema.js` and
   verify both immutable records plus the `dwh-08-003` head checksum.
7. Replace API/Web; check liveness, readiness, auth/sync/WebSocket smokes.
8. Start exactly one jobs runner only after API and SQL checks pass.
9. Rollback application artifacts if needed. Do not downgrade OLTP/DWH
   destructively; incompatible schema changes require a forward repair.

The local `scripts/verify-deployment-b09-5a.ps1` remains a destructive,
Windows/SQL Express verification harness. It proves fresh migrations,
idempotency and a backup/restore roundtrip on disposable databases; it is not
a portable production backup wrapper and must not be pointed at a real target.

## 14. Edge, TLS, CORS, cache, and headers

- Public HTTP redirects to HTTPS at the edge. TLS certificates, renewal and
  private keys belong to target infrastructure, never the images/repository.
- HSTS is enabled only after the approved hostname and renewal path are proven.
- `PUBLIC_API_URL`, `PUBLIC_WEB_URL` and `CORS_ORIGIN` are exact remote HTTPS
  values in STAGING/PRODUCTION. CORS wildcards are prohibited.
- Web assets with content hashes use long immutable cache. `index.html`,
  service worker and manifest use no-cache/revalidation. Navigation is
  network-first; API-like requests are never service-worker cached.
- Security headers include nosniff, frame deny, no-referrer and a permissions
  policy that permits camera/microphone only from self for telemedicine.
- CSP must be defined at the final edge. Desktop CSP must list the exact API
  HTTPS/WSS origin; this remains a target-specific blocker, not a wildcard.
- The internal Nginx template routes `/api/` to the API and supports WSS. It
  does not terminate public TLS and is not itself proof of real staging.

## 15. Configuration and secrets

Configuration sources, highest authority first:

1. Immutable artifact metadata: release/commit and code/schema versions.
2. Non-secret target driver: hosts, artifact IDs, DB identities, storage and
   provider contract IDs (`deployment/config/deployment-inputs.example`).
3. Runtime environment variables from the orchestrator/service manager.
4. SecretProvider injection into the API/jobs/one-shot workload only.

Never bake secrets into Docker `ARG`, image labels, frontend `VITE_*`, compose,
release manifest, logs or files committed to Git. Secret injection may be env,
mounted file or workload identity if the future target/adapters support it;
the repository currently consumes env values and does not claim a specific
vault integration.

## 16. External side effects

`EXTERNAL_SIDE_EFFECTS_MODE` is `DISABLED`, `SANDBOX` or `PRODUCTION`.
STAGING may use only `DISABLED`/`SANDBOX`; the current SMTP adapter sends only
when both environment class and side-effect mode are `PRODUCTION`. Logs omit
recipient and subject. The authenticated ICE endpoint is authoritative and
declares `OPTIONAL_DIRECT_ALLOWED`: endpoint failure blocks signaling,
`configured=false` permits direct ICE, and `configured=true` provides validated
credentialed TURN entries. AI egress, TURN and any future
notification/payment adapters require separate allowlists/credentials and
synthetic recipients in staging. Patient AI remains disabled and no clinical
model is eligible.

## 17. Observability and audit

- Application logs go to stdout/stderr and are collected by target runtime.
- Current application logs include service/coarse operational results and
  redact remote errors. The target collector must attach environment,
  release/commit and instance labels; a complete structured log envelope is
  not yet guaranteed by the application.
- Remote logs exclude request bodies, tokens, SQL credentials,
  recipient/subject, patient IDs and raw error objects.
- Health endpoints are not log dumps. SQL connection errors are reduced to
  readiness booleans.
- Target requirements must define retention, access control, encryption,
  alert destinations, clock sync and deletion. No external logging provider is
  selected here.
- Deployment events must record immutable artifacts, operator/change ID,
  migration result, smoke result and rollback decision without secrets/PHI.

## 18. CI/CD contract

Portable CI performs quality gates, deployment contract tests, API bundle
startup/jobs/one-shot guard checks, release-manifest validation, Docker image
builds, Compose syntax, a no-SQL local simulation and a portable UI E2E subset
with offline fixtures. The SQL-backed full E2E remains a real-target gate. CI
never deploys to a real host and has no provider credential.

Every external GitHub Action is pinned to an immutable 40-character commit SHA
with an adjacent version comment. Workflow permissions default to read-only;
only release publication receives `contents: write`. Dependabot opens reviewed
weekly GitHub Actions update PRs. Mutable refs and automatic dependency merges
are not permitted.

The tag workflow invokes that same CI foundation for the tagged SHA, validates
release identity and public endpoints, then fails closed while Desktop target,
signing, updater or authorization remain unconfigured. Once those prerequisites
are real, it builds the three Desktop targets, verifies updater/platform
signatures and publishes API/Web image archives, Desktop bundles, a final
digest-bound manifest and checksums. It still performs no provider deployment.

Any authorized target delivery must promote those already-built immutable
artifacts; it must not rebuild from a different commit on the target. Required
target evidence: full SHA, release, image digest, manifest, scan results,
migration preview/result, environment/instance identity and smoke/rollback
result.

## 19. Host OS alternatives

| Option                               | Status                | Notes                                                                                                                                              |
| ------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linux OCI host for edge/API/Web/jobs | PREFERRED             | canonical Dockerfiles, non-root runtime, simplest portable path                                                                                    |
| Windows Server native Node service   | SUPPORTED_ALTERNATIVE | requires Node 24, service manager, exact artifacts, graceful stop, log collection and equivalent security; enables Windows/NTLM-specific operation |
| Windows Server containers            | NOT_BASELINED         | different images/base/runtime would need separate evidence                                                                                         |
| Managed container platform           | POSSIBLE              | only if it supports private SQL network, long-lived WSS, one-shot jobs, read-only FS and exact secret contract                                     |
| Kubernetes                           | NOT_SELECTED          | no operational need/provider decision yet                                                                                                          |

SQL host OS is independent. SQL Server compatibility and backup operations,
not the API host OS, decide whether Windows, Linux or a compatible managed SQL
target is acceptable.

## 20. Local deployment simulation

`deployment/compose/compose.yaml` is explicitly
`LOCAL_DEPLOYMENT_SIMULATION`. It builds API/Web, proves process liveness,
Web proxying and PHI-marker non-echo, and intentionally uses
`sql-not-provisioned.invalid`; API readiness returns `503`. It has no real SQL,
TLS, DNS, backup, secret provider or side effects and can never satisfy a
staging gate.

Current host limitation: no Docker/Podman-compatible engine is installed.
Native API/Web artifacts and static container contracts are verified locally;
container build/Compose execution must run in CI or an authorized host before
Step 02 can claim an unconditional container simulation PASS.
