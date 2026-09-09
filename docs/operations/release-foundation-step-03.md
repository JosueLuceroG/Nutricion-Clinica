# NUTRICLÍNICA — RELEASE FOUNDATION STEP 03 REPORT

Fecha: 2026-09-09. Modo: BUILD / OPERATIONS. Alcance: selección de target de
infraestructura y staging real, provider-agnostic, Desktop-first y Web
secundario.

## Executive Result

Step 03 no alcanza PASS. La inspección de contratos, configuración no secreta,
entorno local y tooling no encontró infraestructura real autorizada que pueda
clasificarse como on-premises, servidor dedicado, VM/VPS, cloud administrado o
híbrido.

Clasificación autoritativa encontrada: `NONE_AVAILABLE`.

`REAL STAGING = BLOCKED_BY_INFRASTRUCTURE`.

Se aplicó la condición de parada antes de provisionar, comprar, configurar o
contactar un target. No se construyeron ni publicaron imágenes OCI, no se
ejecutó CI remoto, no se conectó a SQL remoto, no se configuró DNS/TLS/WSS, no
se generó un manifest de staging y no se desplegó ningún artefacto. Local
Compose y SQL Express no fueron renombrados como staging.

La clasificación global es `CONDITIONAL`: el preflight y el handoff del
operador quedan completos, pero el objetivo operacional central no se ejecutó.
Esto no es un PASS de Step 03 ni autorización para Step 04.

## Authoritative Baseline

- Step 01: PASS.
- Step 02: CONDITIONAL PASS.
- Step 02.1: PASS LOCAL.
- HEAD documental recibido:
  `bf2816dab1928da600197ed8897fae04f2a9f3e0`.
- Branch de trabajo Step 03: `infra/release-foundation-step-03`.
- Worktree al iniciar: limpio.
- Source code modificado en Step 03: ninguno.
- Production al iniciar y finalizar: no tocado.
- `v0.1.0-rc.2`: no existe y no se creó.

Los contratos autoritativos revisados fueron:

- `docs/operations/infrastructure-target-requirements.md`;
- `docs/operations/real-staging-requirements.md`;
- `docs/operations/deployment-architecture.md`;
- `docs/operations/release-foundation-step-02.md`;
- `docs/operations/release-foundation-step-02-1.md`.

No se reabrió ninguna decisión aprobada en Step 01, Step 02 o Step 02.1.

## Discovery Method

La selección se limitó a evidencia observable y no a preferencias:

- contratos y reportes trackeados;
- driver provider-neutral `deployment/config/deployment-inputs.example`;
- workflows CI/release y artefactos de deployment existentes;
- presencia de IaC, configuración de edge, registry y destinos remotos;
- estado set/unset de variables de identidad y target, sin imprimir valores
  secretos;
- clasificación segura de `.env` locales sin mostrar credenciales;
- disponibilidad local de runtime OCI y CLIs de infraestructura;
- estado Git, remotes y tags.

No se consultaron cuentas cloud, no se intentó autenticación contra hosts, no
se abrió una sesión SSH y no se asumió que una credencial o CLI implicara
autorización operacional.

## Evidence Found

| EVIDENCE AREA           | OBSERVATION                                                                                    | CONSEQUENCE                      |
| ----------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| Written authorization   | No owner, approver, scope, budget or change ID supplied                                        | Provisioning prohibited          |
| Existing contract state | Required target inputs remain `PENDING`                                                        | No accepted target               |
| Real staging contract   | Explicitly `BLOCKED / NOT AVAILABLE`                                                           | Bring-up prohibited              |
| App runtime             | No approved remote OCI host/runtime identity                                                   | API/Web/jobs cannot deploy       |
| IaC                     | No provider/on-prem IaC found                                                                  | No reproducible target exists    |
| Container engine        | Docker and Podman unavailable locally                                                          | No real local OCI build/digest   |
| Provider tooling        | Azure, AWS, GCP, Kubernetes, Terraform/OpenTofu and common PaaS CLIs unavailable               | No provider path evidenced       |
| Environment inputs      | Staging identity, attestation, endpoints, artifacts, targets and evidence variables unset      | Machine gate cannot pass         |
| Local root `.env`       | Frontend endpoint classified local/placeholder                                                 | Not staging                      |
| Local API `.env`        | SQL classified local; no DWH/target identity/attestation                                       | Not staging                      |
| Compose                 | Explicit `LOCAL_DEPLOYMENT_SIMULATION`, `TEST`, loopback and `.invalid` SQL                    | Cannot count as staging          |
| SQL                     | Only prior local SQL Express evidence                                                          | No staging OLTP/DWH              |
| DNS/TLS/WSS             | No approved FQDN, DNS owner, CA or edge config                                                 | Public client path blocked       |
| Registry                | No approved registry/repository or deploy credential                                           | Immutable promotion blocked      |
| SecretProvider          | Contract placeholder only                                                                      | Runtime secret injection blocked |
| Storage/backup          | No persistent object target, off-host backup target or restore workspace                       | Recovery gate blocked            |
| Observability           | stdout/stderr contract only; no approved sink, retention or alerts                             | Operations gate blocked          |
| CI evidence             | Workflow capability exists, but no exact-SHA remote run/attestation was authorized or produced | Secret attestation blocked       |

`gh` and `ssh` executables exist locally. Their presence proves neither a
staging target nor authorization and was not used to infer one.

## Target Classification

| CLASSIFICATION     | AVAILABLE/AUTHORIZED EVIDENCE                                                       | DECISION                |
| ------------------ | ----------------------------------------------------------------------------------- | ----------------------- |
| `ON_PREMISES`      | No host inventory, owner, network, SQL, backup or access approval                   | NOT AVAILABLE           |
| `DEDICATED_SERVER` | No server identity, owner, OS/runtime or authorization                              | NOT AVAILABLE           |
| `VM_VPS`           | Documented as a preferred future baseline only; no actual VM/VPS exists in evidence | NOT AVAILABLE           |
| `MANAGED_CLOUD`    | No provider, account scope, region, budget, services or authorization               | NOT AVAILABLE           |
| `HYBRID`           | No authorized components from which to define a hybrid topology                     | NOT AVAILABLE           |
| `NONE_AVAILABLE`   | Matches all observed evidence and current contracts                                 | SELECTED CLASSIFICATION |

No provider was selected. The Linux VM/VPS preference in the architecture is a
design baseline, not evidence that a VM exists or may be purchased.

## Selection Decision

There were no two or more authorized options to compare. A weighted provider
comparison would invent cost, latency, availability, maintenance and governance
facts, so it was not performed.

When the operator supplies candidates, selection must compare each candidate
with measured or contractual evidence for:

| CRITERION                | REQUIRED EVIDENCE BEFORE SELECTION                                                     |
| ------------------------ | -------------------------------------------------------------------------------------- |
| SQL Server compatibility | Engine/edition, compatibility level >=130, required feature test, auth and trusted TLS |
| Private networking       | Exact edge/runtime/data/admin flows and firewall proof                                 |
| HTTPS/WSS                | Approved DNS, trusted TLS 1.2+, renewal and long-connection behavior                   |
| Persistent storage       | Encryption, ACL, capacity, lifecycle and recovery path                                 |
| Backup/restore           | Off-host target, selected RPO/RTO and isolated restore capability                      |
| Availability             | Failure domain, supervision, maintenance and measured recovery                         |
| Maintenance              | Patching, ownership, windows and on-call process                                       |
| Deployment automation    | Immutable digest promotion, one-shot workloads and rollback                            |
| Desktop latency          | Measurements from expected Desktop client locations                                    |
| Cost                     | Approved budget and target-specific recurring/egress/licensing estimate                |
| Future AI runtime        | Controlled egress, capacity, residency and provider-neutral integration                |
| Data governance          | Legal region, access, audit, encryption, retention and deletion                        |

## Mandatory Operator Handoff

Step 03 may resume only after the operator supplies the following non-secret
decisions and evidence. Supplying credentials alone is insufficient.

### Authorization and ownership

- Written authorization/change ID covering staging only.
- Named environment owner, release operator, security reviewer and clinical
  reviewer.
- Explicit statement that no production account, host, network, database,
  secret, recipient or provider credential is in scope.
- Selected classification from `ON_PREMISES`, `DEDICATED_SERVER`, `VM_VPS`,
  `MANAGED_CLOUD` or `HYBRID`.
- Approved budget ceiling, purchasing authority, legal region/data residency
  and maintenance window.
- Expected users, concurrency, Desktop locations, WebSocket sessions, storage
  growth and ETL window.

### App runtime

- Host/platform identity, OS, architecture, zone/failure domain and management
  access path.
- Approved OCI runtime or documented equivalent supporting Linux images,
  non-root users, read-only filesystems, health probes, one-shot jobs and WSS.
- Initial capacity decision. Current provisional floors are Web 1 vCPU/512 MiB,
  API 2 vCPU/4 GiB and jobs 1 vCPU/2 GiB; they are not production sizing claims.
- Exactly one API workload and exactly one jobs workload.
- Runtime supervision, restart/backoff, patching and clock synchronization.

### Artifact registry and CI

- Approved immutable OCI registry/repository identities for API and Web.
- Registry retention, access, audit and promotion policy; no `latest`.
- Authorization to run the actual pinned CI workflow for the exact committed
  SHA, or an approved equivalent runner that produces genuine OCI digests and
  gitleaks evidence.
- Commit-bound evidence ID with `confirmed secrets = 0`.
- Build platform and base-image/SBOM/vulnerability policy decision.
- Registry/deploy credentials held outside app containers and Git.

### Network, DNS and edge

- Approved public API and Web FQDNs and their DNS owner.
- Edge identity/topology exposing only HTTPS/WSS on `443/TCP`.
- Private routes from edge to Web/API and from workloads to SQL.
- Firewall evidence that SQL, runtime admin ports, Docker socket and metrics are
  not public.
- Exact `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `CORS_ORIGIN` and bounded
  `TRUST_PROXY` values.
- Desktop CSP approval for the exact HTTPS/WSS API origin.
- Cache, forwarded-header sanitization, WSS timeout and graceful drain policy.

### TLS

- Trusted CA/certificate chain for browser and Tauri WebView.
- TLS 1.2+ policy, issuance/renewal automation, expiration alert and key custody.
- Certificate hostname validation and no wildcard CORS/CSP substitution.
- WSS upgrade/reconnect test window.

### SQL OLTP and DWH

- Private staging SQL Server/instance identity, edition/version and compatibility
  level for OLTP.
- Non-default OLTP database identity dedicated to staging.
- Distinct DWH database identity and its host if separate.
- Explicit TCP endpoint, trusted TLS with
  `trustServerCertificate=false`, and approved auth mechanism.
- Separate least-privilege app, jobs and migration access as the target permits.
- Capacity for OLTP data/index/log/blob and DWH data/work/log growth.
- Permission and change window for fresh `001` through `039`, idempotency,
  physical checks and checksum/drift checks.
- Permission and inputs for `dwh-08-002` to `dwh-08-003`, intraday SCD2, ETL
  and reconciliation using synthetic data only.

### SecretProvider

- Approved provider/process identity and owner.
- Workload-scoped read policy, encryption, audit, version recovery, rotation and
  revocation procedure.
- Secret references, never values, for OLTP, DWH, JWT, field encryption, TOTP
  encryption and applicable sandbox integrations.
- No secret in Git, CI output, Desktop, Web bundle, image layers/labels, logs or
  deployment manifest.
- The current app consumes environment variables. Mounted-file or workload
  identity use that changes this contract requires an explicit adapter and
  tests.

### Storage, backup and recovery

- Persistent encrypted storage identity and lifecycle for documents/uploads if
  exercised.
- Protected, encrypted, off-host SQL backup target.
- Distinct restore workspace/database identities.
- Operator-selected staging RPO/RTO. The documented rehearsal candidate is
  daily full plus pre-change backup, RPO <=24 h and RTO <=8 h; it requires
  explicit approval.
- Backup principal, retention, integrity/checksum, key recovery and deletion
  policy.
- DWH decision: protected backup or demonstrated schema+ETL rebuild within its
  approved RTO.
- Prior compatible API/Web digests or an explicit
  `BLOCKED_BY_NO_PRIOR_ARTIFACT` rollback decision.

### Observability and operations

- Approved log/metric sink, access policy, encryption, retention and deletion.
- Alert owner/routing for liveness/readiness, latency/errors, WSS, SQL,
  disk/log growth, jobs, DWH freshness/reconciliation, backup age and TLS expiry.
- Labels for service, release, commit, environment and instance.
- A synthetic PHI/secret marker plan proving zero leakage from logs, telemetry,
  errors, artifacts and proxy pages.
- On-call, incident and maintenance procedures.

### Synthetic data and side effects

- Approved, versioned synthetic fixture and cleanup plan with at least two
  tenants/sucursales and explicit authorization-denial cases.
- No production copy, real PHI, real patient email/phone or real recipient.
- `EXTERNAL_SIDE_EFFECTS_MODE=DISABLED` or an explicitly approved sandbox.
- AI egress disabled by default, Patient AI disabled and Shadow disabled.
- TURN decision preserving server-controlled `OPTIONAL_DIRECT_ALLOWED`; no
  silent third-party STUN/TURN.
- Sandbox counters or disabled-provider proof for email and any integration.

## Required Non-Secret Driver

After authorization, the operator must materialize a non-secret input file
outside Git with real values for:

```text
DEPLOYMENT_ENVIRONMENT=STAGING
RELEASE_VERSION=<approved-semver>
RELEASE_COMMIT=<full-40-char-sha>
API_ARTIFACT=<registry/repository>@sha256:<digest>
API_ARTIFACT_DIGEST=sha256:<same-digest>
WEB_ARTIFACT=<registry/repository>@sha256:<digest>
WEB_ARTIFACT_DIGEST=sha256:<same-digest>
API_HOST=https://<approved-api-host>
WEB_HOST=https://<approved-web-host>
API_REPLICAS=1
JOBS_REPLICAS=1
OLTP_TARGET=<staging-oltp-identity>
DWH_TARGET=<distinct-staging-dwh-identity>
SECRET_PROVIDER=<approved-provider-contract-id>
STORAGE_TARGET=<persistent-storage-identity>
BACKUP_TARGET=<off-host-backup-identity>
SECRET_SCAN_STATUS=PASS
SECRET_SCAN_COMMIT=<same-full-sha>
SECRET_SCAN_EVIDENCE_ID=<real-ci-evidence-id>
```

The operator must then run
`pnpm deployment:validate -- --env-file <approved-input-path> --print-runtime-map`.
A PASS validates shape only; resource existence still requires independent
evidence.

## Stop Decision

The stop occurred before the first external side effect because all of these
mandatory prerequisites were absent together:

- written authorization;
- target owner and environment identity;
- remote app runtime;
- registry and immutable images;
- staging OLTP and DWH;
- DNS/TLS/WSS;
- SecretProvider;
- storage and backup target;
- observability destination;
- synthetic fixture approval;
- CI attestation tied to the exact source SHA.

No partial local substitute can remove that stop condition.

## Release Source

The clean committed baseline available for a future staging attempt is
`bf2816dab1928da600197ed8897fae04f2a9f3e0`. It contains the completed Step 02.1
documentation; its parent `3e0e8ffece174832efcb3afdda8242417c2d2686` is the
last technical commit.

No release commit was deployed. A future attempt must use `bf2816d...` or a new
clean commit containing only reviewed staging fixes, and must bind all
artifacts and evidence to that exact full SHA. It may not deploy from a dirty
worktree.

## OCI and CI Evidence

The repository contains Step 02 Dockerfiles and a pinned CI path capable of
building API/Web images with commit labels. On this attempt:

- local Docker/Podman: unavailable;
- authorized remote builder: unavailable;
- approved registry: unavailable;
- API image: not built;
- Web image: not built;
- API immutable digest: not produced;
- Web immutable digest: not produced;
- actual gitleaks CI run for `bf2816d...`: not produced;
- secret-scan attestation/evidence ID: not produced.

No `sha256` value, registry identity or CI evidence was fabricated.

## HTTPS, WSS and Secrets

No remote API/Web endpoint exists in supplied evidence. No `.invalid`, `.test`,
localhost or fixture domain was promoted into deployment configuration.

No SecretProvider exists in supplied evidence. Local `.env` credentials remain
local and were neither read as target credentials nor copied into a report,
artifact, manifest or deployment input.

Consequently API HTTPS, Web HTTPS, WSS, Desktop CSP, CORS, trusted TLS and
server-side staging secret injection remain blocked.

## Staging Release Manifest

No staging deployment manifest was generated. The existing ignored local
manifest belongs to Step 02.1 `TEST` evidence and is not reused as a staging
claim. A valid Step 03 manifest requires the exact deployed commit, real
API/Web OCI digests, real HTTPS/WSS endpoints, actual schema versions and an
actual commit-bound CI secret-scan evidence ID together.

`v0.1.0-rc.2` remains only a provisional identity from earlier local evidence;
no tag or public release was created.

## SQL and DWH

No operation was attempted against staging SQL because no staging SQL target
exists or is authorized.

- Staging OLTP migrations applied: `0/39`.
- Staging OLTP idempotency: not executed.
- Staging checksum/drift verification: not executed.
- Staging DWH schema/upgrade: not executed.
- Staging DWH intraday SCD2 regression: not executed.
- Staging ETL: not executed.
- Staging unexpected-loss reconciliation: not measured.

Step 02.1 local SQL Express evidence remains valid local evidence only: fresh
`39/39`, DWH `dwh-08-003`, intraday SCD2, ETL rehearsal and local
backup/restore passed there. None is relabeled as real staging.

The canonical OLTP migrations `001`-`039` and frozen
`apps/api/src/modules/dwh/schema/dwh-schema.sql` were not modified.

## Replicas and Distributed Readiness

No workload was deployed. The only accepted future staging topology remains:

- `API_REPLICAS=1`;
- `JOBS_REPLICAS=1`;
- ETL `BLOCKED_NO_LEASE_RENEWAL` for multi-runner operation;
- retention `BLOCKED_NO_DISTRIBUTED_LOCK` for multi-runner operation.

Redis, Kafka, a distributed broker, lease renewal or a distributed retention
lock were not introduced. Multi-replica readiness remains blocked.

## Backup, Restore and Rollback

No staging backup could be taken because no staging database or backup target
exists. No restore could be performed because no isolated restore target exists.
No document-storage recovery could be exercised because no storage target was
authorized.

The prior local SQL Express backup/restore rehearsal is not counted. A future
staging PASS requires both a protected backup and verified isolated restore,
plus DWH backup/rebuild and a compatible app-artifact rollback rehearsal.

## Staging E2E Status

All target-dependent E2E work stopped before execution:

| GATE                                | RESULT  | REASON                             |
| ----------------------------------- | ------- | ---------------------------------- |
| Desktop -> HTTPS API                | BLOCKED | No staging origin/runtime          |
| Desktop auth/sync/offline/reconnect | BLOCKED | No staging API/SQL                 |
| Desktop patient isolation           | BLOCKED | No staging data path               |
| Desktop WSS/logout/revocation       | BLOCKED | No WSS endpoint                    |
| Web HTTPS/auth/API                  | BLOCKED | No Web/API endpoint                |
| Web WSS                             | BLOCKED | No edge/runtime                    |
| OLTP/DWH analytics                  | BLOCKED | No staging SQL                     |
| TURN/ICE                            | BLOCKED | No staging endpoint/config         |
| RAG approved/no-answer/revoked      | BLOCKED | No staging runtime/data            |
| Memory patient/tenant isolation     | BLOCKED | No staging runtime/store           |
| Observability/alerts                | BLOCKED | No staging sink                    |
| PHI leak scan                       | BLOCKED | No staging artifacts/logs/traffic  |
| Secret leak scan                    | BLOCKED | No staging artifacts/logs/manifest |

No real PHI or production data was used.

## Telemedicine Policy

The implemented policy classification remains `DIRECT_ALLOWED` through the
server-controlled `OPTIONAL_DIRECT_ALLOWED` contract; it is not relay-only.
Real staging TURN/ICE connectivity is still `BLOCKED` because no authenticated
HTTPS/WSS endpoint, approved TURN service or network path exists. No third-party
STUN/TURN service was introduced or contacted.

## AI and Side Effects

- Current eligible clinical model: `NONE`.
- `LOCAL_AUTO`: `ABSTAIN_NO_ELIGIBLE_MODEL`.
- Patient AI: `DISABLED`.
- Professional Shadow: `NOT_STARTED`.
- Professional validation: `NOT_DONE`.
- AI egress: disabled by inherited policy; no provider call made.
- SMTP/SMS/payment/external notification: no staging invocation made.
- External staging side effects: absent; required future mode remains
  `DISABLED` or `SANDBOX`.
- Historical SQL credential rotation: `STILL_REQUIRED`; no inference was made
  from local or future staging credentials.

The lack of an eligible clinical model is expected and is not the cause of the
infrastructure block.

## Desktop Signing and Updater

Signing and updater remain Step 04 concerns and were not simulated. No signing
key, updater endpoint or publication authorization was introduced.

`PUBLICATION_READY=NO`.

## Applicable Local Gates

Only gates that do not cross the mandatory infrastructure stop were run:

| GATE                          | RESULT         | EVIDENCE                                     |
| ----------------------------- | -------------- | -------------------------------------------- |
| Git clean-source preflight    | PASS           | Started at committed `bf2816d...`            |
| Deployment contract tests     | PASS           | 40/40                                        |
| Mutable Action/policy checks  | PASS           | Included in 40/40                            |
| Replica/config guards         | PASS           | Included in 40/40                            |
| Placeholder deployment driver | EXPECTED BLOCK | 15 missing/placeholder requirements rejected |
| Provider provisioning         | NOT RUN        | Prohibited without authorization             |
| OCI/Compose                   | BLOCKED        | No engine/authorized builder                 |
| Actual CI secret scan         | BLOCKED        | No authorized exact-SHA remote run           |
| Real staging gates            | BLOCKED        | `NONE_AVAILABLE`                             |

The placeholder driver rejected release SHA/version, API/Web digests and
bindings, scan evidence, OLTP/DWH identities, SecretProvider, storage, backup
and remote HTTPS hosts. This is expected fail-closed behavior, not a staging
deployment attempt.

The unchanged Step 02.1 source already had full local evidence of frontend
`2019/2020` and API `1281/1336`. Those counts are carried forward only to
identify the last full regression at the exact code lineage; they were not
rerun or represented as staging E2E in Step 03.

## Operations Not Executed

- No resource purchase or account creation.
- No cloud/provider API call.
- No remote host login or SSH session.
- No branch push or GitHub workflow dispatch.
- No image build, push, pull or registry mutation.
- No DNS record, TLS certificate or firewall change.
- No SecretProvider read/write.
- No SQL staging connection, migration, seed, ETL, backup or restore.
- No Desktop/Web staging build or E2E.
- No external integration call.
- No production access or mutation.
- No public Desktop release, signing or updater work.
- No tag or GitHub Release.

## Definition of Done

- [ ] Real authorized staging exists.
- [ ] Staging is remotely reachable and not localhost.
- [x] Production untouched.
- [ ] HTTPS/WSS real.
- [ ] OCI API digest real.
- [ ] OCI Web digest real.
- [ ] CI secret evidence tied to SHA.
- [ ] SecretProvider configured.
- [ ] OLTP real staging SQL PASS.
- [ ] DWH `dwh-08-003` real staging SQL PASS.
- [ ] ETL reconciliation unexpected loss 0.
- [ ] API workload observed at one replica.
- [ ] Jobs workload observed at one replica.
- [ ] Backup + restore PASS against staging.
- [ ] Desktop real-staging E2E PASS.
- [ ] Web real-staging E2E PASS.
- [ ] WSS PASS.
- [ ] TURN policy PASS against staging.
- [ ] RAG PASS against staging.
- [ ] Memory isolation PASS against staging.
- [ ] Observability PASS against staging.
- [ ] Staging PHI leak 0.
- [ ] Staging secret leak 0.
- [x] No unauthorized external side effect occurred.
- [x] Patient AI remains disabled.
- [x] Eligible clinical model remains `NONE`.
- [x] Professional Shadow was not started.
- [ ] Full target-dependent regression PASS.
- [x] Worktree clean after documentary commit.

Step 03 cannot become PASS by checking only the safety invariants. Every
unchecked staging requirement needs real target evidence.

## Resumption Gate

Do not resume automatically. The operator must first provide the complete
authorization and infrastructure handoff above. After that, the next safe
action is target comparison/selection and a read-only connectivity/configuration
preflight, followed by an explicitly approved bring-up plan.

Step 04 is not eligible because Step 03 is not PASS. Model qualification and
Professional Shadow also remain out of scope.

The two binary SQL sub-gates below use `FAIL` because no staging acceptance
evidence exists; they do not represent an observed SQL execution failure. Their
parent real-SQL gates remain explicitly `BLOCKED`.

RELEASE FOUNDATION STEP 03:
CONDITIONAL

INFRASTRUCTURE TARGET:
NONE_AVAILABLE

REAL STAGING:
BLOCKED

STAGING IS LOCALHOST:
NO

PRODUCTION TOUCHED:
NO

DEPLOYED COMMIT:
NOT_DEPLOYED

API OCI DIGEST:
BLOCKED

WEB OCI DIGEST:
BLOCKED

SECRET SCAN ATTESTATION:
BLOCKED

HTTPS API:
BLOCKED

HTTPS WEB:
BLOCKED

WSS:
BLOCKED

SECRET PROVIDER:
BLOCKED

OLTP REAL SQL:
BLOCKED

OLTP MIGRATIONS:
0/39

OLTP IDEMPOTENCY:
FAIL

DWH VERSION:
dwh-08-003

DWH REAL SQL:
BLOCKED

DWH SCD2 INTRADAY:
FAIL

DWH RECONCILIATION UNEXPECTED LOSS:
NOT_MEASURED

API REPLICAS:
NOT_DEPLOYED

JOBS REPLICAS:
NOT_DEPLOYED

BACKUP:
BLOCKED

RESTORE:
BLOCKED

DESKTOP REAL-STAGING E2E:
BLOCKED

WEB REAL-STAGING E2E:
BLOCKED

TURN/ICE:
BLOCKED

RAG:
BLOCKED

MEMORY:
BLOCKED

OBSERVABILITY:
BLOCKED

PHI LEAK:
NOT_MEASURED

SECRET LEAK:
NOT_MEASURED

EXTERNAL SIDE EFFECTS:
SANDBOXED_OR_DISABLED

CURRENT ELIGIBLE CLINICAL MODEL:
NONE

PATIENT AI:
DISABLED

PROFESSIONAL SHADOW:
NOT_STARTED

HISTORICAL SQL CREDENTIAL ROTATION:
STILL_REQUIRED

PUBLIC DESKTOP RELEASE:
BLOCKED

v0.1.0-rc.2 TAG:
NOT_CREATED

FRONTEND TESTS:
2019/2020

API TESTS:
1281/1336

WORKTREE CLEAN:
YES
