# NUTRICLÍNICA — RELEASE FOUNDATION STEP 02 — PRODUCTION-GRADE INFRASTRUCTURE ARCHITECTURE + IaC FOUNDATION FOR DESKTOP-FIRST + WEB-SECONDARY NUTRICLINICA REPORT

Fecha de cierre local: 2026-09-06. Modo: BUILD / RELEASE ENGINEERING. No
deployment, push, tag, release ni acceso a producción.

## Executive Result

La base portable de infraestructura y release queda implementada y probada en
los gates que este host puede ejecutar. Desktop Tauri continúa como canal
primario; Web es secundario; ambos comparten un único API. Se añadieron
artefactos OCI reproducibles, separación API/jobs/one-shot, contratos de
configuración y target, CI/release fail-closed, health/readiness, shutdown,
proxy WSS, evidencia de artefactos y documentación provider-neutral.

Este cierre no declara infraestructura real provisionada. Docker/Podman,
targets remotos, SQL controlado, SecretProvider, signing, updater y staging no
están disponibles. Los gates que dependen de ellos permanecen bloqueados y no
se sustituyeron con valores ficticios.

## Canonical Implementation Commit

- Branch local: `infra/deployment-foundation-step-02`.
- Commit de implementación:
  `994f5ad40b0e7bb781fc4d89eb21ffac535637e4`.
- Parent al iniciar Step 02:
  `3d988b93bfe1324d6dfd83fd79cb2d59c241cbdb`.
- Baseline canónico Step 01:
  `d0565e8dee075bb9fd64ae266f329f60e5d2d078`.
- `git merge-base --is-ancestor d0565e8... HEAD`: PASS.
- Cambio de implementación: 153 archivos, 17,476 inserciones y 3,535
  eliminaciones.

El reporte se commitea después del código para poder registrar el SHA de
implementación sin crear una referencia Git autorreferencial. No existe tag
Step 02 y no se publicó ningún artefacto.

## Architecture Decision

- `DESKTOP_TAURI` es el canal primario y conserva Dexie/offline-first.
- Web es el canal secundario y usa API same-origin mediante `/api`.
- Desktop y Web consumen el mismo API Express; no se creó backend paralelo.
- La ruta canónica portable usa una imagen Web/Nginx y una imagen API.
- API, jobs, migración OLTP, schema DWH y backfill usan el mismo artefacto API,
  pero comandos, roles y ciclos de vida separados.
- SQL OLTP es autoritativo; DWH es analítico y usa un target lógico distinto.
- El edge TLS, runtime OCI, SQL, registry, DNS, storage, backup, SecretProvider
  y observabilidad son contratos de target; no se inventó proveedor.
- Escala inicial: una réplica API y un runner jobs. Escala horizontal permanece
  bloqueada por estado/broadcast in-process y locks distribuidos incompletos.

ADRs: `0012-desktop-first-shared-backend.md`,
`0013-portable-server-containers.md` y
`0014-sql-lifecycle-and-jobs-runner.md`.

## Portable Infrastructure Foundation

### Web artifact

- `Dockerfile` multi-stage con versiones de Node/pnpm/Nginx controladas.
- Instalación desde lockfile, build con `VITE_API_URL=/api`, runtime no-root,
  filesystem de aplicación inmutable y healthcheck.
- `nginx.conf` sirve SPA, aplica política de cache y enruta `/api/` y WSS.
- `nginx-security-headers.conf` define headers mínimos sin fingir el CSP final
  del edge remoto.
- `.dockerignore` excluye `.env`, outputs, reportes, backups, modelos y material
  sensible.

### API artifact

- `apps/api/Dockerfile` multi-stage, no-root, versionado y con healthcheck.
- `build:deploy` genera `server.js`, `jobs.js`, `migrate.js`, `dwh-schema.js`,
  `retention-backfill.js`, `healthcheck.js`, migraciones y DWH DDL.
- `pnpm deployment:api-artifact:test` comprueba startup/shutdown, jobs y guards
  de workloads one-shot sin requerir SQL real.
- Un deploy probe con `pnpm deploy --prod` confirmó que el paquete conserva
  `dist-deploy`, migraciones y DWH DDL fuera del workspace.

### Workload lifecycle

| WORKLOAD           | COMMAND                                  |        REQUIRED COUNT | STATUS                         |
| ------------------ | ---------------------------------------- | --------------------: | ------------------------------ |
| API                | `node dist-deploy/server.js`             |                     1 | IMPLEMENTED                    |
| Jobs               | `node dist-deploy/jobs.js`               |             exactly 1 | IMPLEMENTED                    |
| OLTP migration     | `node dist-deploy/migrate.js`            | exactly 1 per rollout | IMPLEMENTED / REAL SQL BLOCKED |
| DWH schema         | `node dist-deploy/dwh-schema.js`         | exactly 1 per rollout | IMPLEMENTED / REAL SQL BLOCKED |
| Retention backfill | `node dist-deploy/retention-backfill.js` |      bounded one-shot | IMPLEMENTED / DRY-RUN DEFAULT  |

API startup no ejecuta migraciones, seed, DWH schema, backup ni restore.
Sensitive one-shots exigen rol exacto, target permitido, change request,
attestation backup/restore y rollback digest. Producción requiere además el
control `ALLOW_PRODUCTION_*` correspondiente.

## Runtime Safety

- `ENVIRONMENT_CLASS` explícito: `LOCAL`, `TEST`, `STAGING` o `PRODUCTION`.
- `NODE_ENV=production` sin clase explícita produce `UNKNOWN` y falla cerrado.
- Startup valida identidad, release/commit, targets, TLS, CORS, proxy, jobs,
  side effects, storage, artefactos y evidencia según rol/entorno.
- `EXTERNAL_SIDE_EFFECTS_MODE` usa `DISABLED`, `SANDBOX` o `PRODUCTION`.
- SMTP solo envía cuando entorno y modo son ambos `PRODUCTION`; logs omiten
  destinatario y asunto.
- API shutdown retira readiness, cierra WebSockets con `1001`, drena HTTP y
  cierra pools SQL dentro del timeout.
- Liveness no depende de SQL; readiness exige OLTP y DWH cuando corresponde.
- La simulación local usa deliberadamente `sql-not-provisioned.invalid` y por
  ello espera readiness `503`; nunca se presenta como staging.

## Realtime and Client Safety

- WebSocket usa ticket de un solo uso como segundo `Sec-WebSocket-Protocol`
  después de `nutriclinica-ticket`.
- `/ws/*` rechaza query strings para evitar credenciales en URL/logs.
- El cliente conserva polling como fallback controlado.
- WebRTC conserva anti-glare: el participante existente crea la oferta al
  recibir `peer-joined`; ICE temprano se encola y cleanup libera recursos.
- TURN permanece fail-closed cuando faltan endpoint/credenciales autorizados.
- Service worker nunca cachea rutas API-like ni respuestas clínicas.
- Quick Notes E2E espera la animación restaurada antes de comparar geometría;
  no se modificó la lógica de persistencia de producción.

## Data and Schema Integrity

- Migraciones OLTP `001`-`039`: sin cambios.
- `apps/api/src/modules/dwh/schema/dwh-schema.sql`: sin cambios.
- `git diff --exit-code` focal para ambos historiales: PASS.
- OLTP schema: `039`.
- DWH runtime schema: `dwh-08-002`.
- SHA-256 canónico DWH tras normalizar CRLF a LF:
  `9fd179f5a9821930d99c5b87a2e17043eab94f5aa54726d620513fd096dcab40`.
- SHA-256 raw observado en Windows:
  `c7eacac50cfd58f76984ddd5c33336093851f26a6813cd59d096327126f13a5d`.
- ETL propaga `maxSourceUpdatedAt`, avanza watermark aun con rejects y carga
  `fact_lab` de forma transaccional.
- Lease ETL es atómico por pipeline, pero su expiración de 60 minutos no se
  renueva; jobs continúa limitado a una réplica.
- Retención tiene SQL validado y dry-run/backfill, pero no lock distribuido ni
  scheduler de purge de producción.

## AI and Clinical Safety

- `AIOrchestrator` conserva gate estático fail-closed y la secuencia
  consentimiento -> audit manifest -> adapter.
- Egreso AI, Patient AI y shadow permanecen apagados por defecto.
- Current eligible clinical model: `NONE`.
- `LOCAL_AUTO`: `ABSTAIN`.
- Persistencia de certificación conserva orden SQL -> memoria; fallo SQL no
  muta el registry in-memory.
- Requalification solo agrega/refresca bloqueos; no puede otorgar estados
  `APPROVED_*`.
- No se cambiaron thresholds para convertir falta de evidencia en aprobación.
- Validación clínica profesional y certificación de producción no realizadas.

## Compatibility Tuple

| COMPONENT            |                         VERSION | STATUS                 |
| -------------------- | ------------------------------: | ---------------------- |
| Desktop channel      |                         primary | ENFORCED               |
| Tauri                |                        `2.11.2` | LOCKED                 |
| Desktop candidate    |                    `0.1.0-rc.2` | MANIFEST IDENTITY ONLY |
| Web/API package base |                         `0.1.0` | ALIGNED                |
| Web channel          |                       secondary | ENFORCED               |
| Dexie                |                            `33` | ENFORCED               |
| Sync protocol        |                             `2` | ENFORCED               |
| API contract         |                            `v1` | ENFORCED               |
| OLTP                 |                           `039` | IMMUTABLE HISTORY      |
| DWH                  |                    `dwh-08-002` | ENFORCED               |
| Semantic catalog     |         `smae-catalog-de212940` | ENFORCED               |
| Knowledge policy     |           `knowledge-policy.v2` | ENFORCED               |
| Retrieval policy     |           `retrieval-policy.v2` | ENFORCED               |
| AI/memory policy     |              `policy-bundle.v1` | ENFORCED               |
| Evaluation dataset   |           `nutrition-golden-v1` | ENFORCED               |
| Toolset              |              `toolset.45419c48` | ENFORCED               |
| Prompt bundle        |        `prompt-bundle.a2e0df87` | ENFORCED               |
| Output schema bundle | `output-schema-bundle.294a0b60` | ENFORCED               |

`0.1.0-rc.2` identifica únicamente la evidencia local Step 02. No existe tag,
release ni autorización de publicación para ese candidato.

## Validation Evidence

| GATE                      | RESULT           | EVIDENCE / LIMIT                                |
| ------------------------- | ---------------- | ----------------------------------------------- |
| Frozen dependency install | PASS             | already up to date with pnpm 11.5.0             |
| `pnpm lint`               | PASS             | 0 errors; 6 historical warnings                 |
| Frontend typecheck        | PASS             | `pnpm typecheck`                                |
| API typecheck             | PASS             | `pnpm --filter @nutriclinica/api typecheck`     |
| Frontend unit/integration | PASS             | 2001 passed, 1 skipped; 150 files               |
| API unit/integration      | PASS             | 1267 passed, 54 SQL-skipped; 156 files          |
| Deployment contract tests | PASS             | 36/36                                           |
| API deploy build          | PASS             | `build:deploy`                                  |
| Native API artifact test  | PASS             | startup/jobs/one-shot fail-closed               |
| Web release build         | PASS             | `VITE_API_URL=/api`                             |
| Web artifact verification | PASS             | 156 files; no source maps/localhost API         |
| Portable UI E2E           | PASS             | 60/60                                           |
| Quick Notes isolated      | PASS             | 26.5 s with normal timeout                      |
| `cargo check --locked`    | PASS             | Rust/Cargo 1.96.0                               |
| `cargo test --locked`     | PASS             | warning histórico `ping` only                   |
| Windows Tauri build       | PASS             | EXE + MSI + NSIS, package version 0.1.0         |
| Windows Authenticode      | BLOCKED          | MSI/NSIS `NotSigned` as expected                |
| macOS/Linux Tauri         | BLOCKED          | host OS unavailable                             |
| Compose/image execution   | BLOCKED          | Docker/Podman unavailable                       |
| SQL-backed suites         | BLOCKED          | no controlled SQL/real staging target           |
| `cargo fmt --check`       | BLOCKED          | rustfmt component unavailable                   |
| Global `format:check`     | BASELINE BLOCKED | Prettier config discovery/debt, about 990 files |
| `git diff --check`        | PASS             | no whitespace errors; CRLF warnings only        |

Focused AI tests passed 49/49, TURN/error/WebSocket tests 40/40 and WebRTC
tests 5/5. The full portable E2E pass includes the stabilized Quick Notes
geometry assertion.

## Release Manifest Evidence

`release-manifest.json` was regenerated after the implementation commit and is
ignored build output, not a source-controlled deployment claim.

- Release identity: `0.1.0-rc.2`.
- Git commit: `994f5ad40b0e7bb781fc4d89eb21ffac535637e4`.
- Environment class: `TEST`.
- Environment name: `release-foundation-step-02`.
- SHA-256 of the generated local JSON:
  `2d94b876e27c16552fe63012cac747a81e2e7e47d00994cdf8df0b8f97ee6831`.
- API/Web public endpoints: `UNCONFIGURED`.
- API/Web/Desktop immutable artifacts: `UNSET`.
- Commit-bound CI secret scan evidence: `UNVERIFIED`.
- AI/shadow/Patient AI: false.

Foundation verification was executed with expected version and full commit.
It failed closed for exactly these absent prerequisites:

- commit-bound CI secret scan attestation;
- immutable API image digest;
- immutable Web image digest;
- remote HTTPS API endpoint;
- remote HTTPS Web endpoint;
- immutable primary Desktop artifact digest.

The endpoint and Desktop gaps are reported as foundation blockers. Missing
API/Web digests and scan attestation are hard failures. No synthetic digest,
fake endpoint or fake CI attestation was inserted to force a PASS.

## Secret and Artifact Safety

- Tracked `git grep` for the canonical compromised-secret fixture and private
  key headers: 0 findings.
- Staged/canonical commit scan using the same focused pattern: 0 findings.
- Generated Web artifact: no secret fixture markers, source maps or localhost
  API endpoint.
- Windows EXE/MSI/NSIS scan: no canonical secret marker, private key header,
  synthetic PHI marker or localhost API endpoint.
- Local `.env` files remain ignored and were not staged.
- `gitleaks` is unavailable on this host; therefore no CI-equivalent
  attestation is claimed.
- `actionlint`, `rg` and Unix `strings` are also unavailable locally.

## Dependency and Toolchain

- `pnpm-lock.yaml` changed only to add API dev dependency
  `esbuild@0.25.12`.
- Node `v24.13.0`.
- pnpm `11.5.0`.
- Rust/Cargo `1.96.0`.
- Tested native target: `x86_64-pc-windows-msvc`.
- CI uses Node 24, pnpm 11.5.0, Linux/Windows quality jobs, Linux portable E2E,
  Docker Buildx and the Rust stable runner for release targets.

## CI and Release Contract

- CI scans tracked files and uses `gitleaks` on Linux.
- CI builds API/Web images with release/commit OCI labels and captures Buildx
  image digests.
- CI builds and verifies a commit-bound foundation manifest.
- CI validates Compose and executes the no-SQL local simulation.
- Tag workflow validates semantic version, refuses an existing immutable GitHub
  release and reuses the foundation workflow for the tagged SHA.
- Release remains fail-closed unless exact endpoints, authorization, Desktop
  signing and updater prerequisites are configured.
- Final release manifest binds API/Web/Desktop artifacts to SHA-256 digests.
- The workflow publishes immutable assets only after all prerequisites pass;
  it never deploys them to a provider target.

The workflows were reviewed and their Node deployment script contracts passed,
but `actionlint` and hosted GitHub Actions execution are external to this host.

## Known Technical Limits

- API must remain one replica because WebSocket broadcast, rate limits and
  selected stores are process-local.
- Jobs must remain one replica; retention lacks distributed locking and ETL
  lease renewal is not implemented.
- SQL migrations, DWH schema, backup/restore and full sync/E2E need an
  authorized disposable target.
- Desktop CSP needs the exact future HTTPS/WSS API origin.
- Signing/updater and platform release credentials are absent.
- Web hosting, DNS, TLS edge, registry, SecretProvider, persistent storage,
  backup target and log sink are not selected.
- RPO/RTO, residency, legal hold, retention approval and secret rotation need
  operator/legal decisions.
- Historical SQL credential rotation remains required.
- No clinical model is eligible; professional validation remains not done.

## Production Safety

- Production touched: NO.
- Real staging touched: NO.
- Provider selected: NO.
- Real credentials created/read: NO.
- Destructive SQL executed: NO.
- Migration history rewritten: NO.
- DWH canonical DDL rewritten: NO.
- Git history rewritten: NO.
- Push/tag/release performed: NO.

## Commits

- `994f5ad40b0e7bb781fc4d89eb21ffac535637e4`: portable infrastructure,
  runtime/release contracts, safety hardening, tests and architecture docs.
- Documentary closure: this report, intentionally after the implementation
  SHA.

## Final Gate Block

RELEASE FOUNDATION STEP 02 IMPLEMENTATION:
PASS

PORTABLE API/WEB ARTIFACTS:
PASS NATIVE; OCI EXECUTION BLOCKED_BY_MISSING_CONTAINER_ENGINE

DESKTOP IS PRIMARY CHANNEL:
YES

WEB IS SECONDARY CHANNEL:
YES

SHARED BACKEND:
YES

TAURI VERSION:
2.11.2

DEXIE / SYNC / API:
33 / 2 / v1

OLTP / DWH:
039 / dwh-08-002

LOCKFILE DRIFT:
PASS — esbuild 0.25.12 only

LOCAL QUALITY / UNIT / PORTABLE E2E:
PASS

WINDOWS TAURI BUILD:
PASS — UNSIGNED / NOT PUBLISHABLE

RELEASE MANIFEST GENERATION:
PASS — COMMIT-BOUND IDENTITY

RELEASE MANIFEST FOUNDATION VERIFICATION:
BLOCKED_FAIL_CLOSED — OCI DIGESTS + CI SCAN + ENDPOINTS + DESKTOP ARTIFACT

CONTAINER SIMULATION:
BLOCKED_BY_MISSING_CONTAINER_ENGINE

REAL SQL / BACKUP / RESTORE:
BLOCKED_BY_NO_AUTHORIZED_TARGET

REAL STAGING:
BLOCKED

CURRENT ELIGIBLE CLINICAL MODEL:
NONE

PATIENT AI:
DISABLED

PROFESSIONAL CLINICAL VALIDATION:
NOT_DONE

PRODUCTION-GRADE TARGET READY:
NO — EXTERNAL INFRASTRUCTURE AND OPERATOR DECISIONS REQUIRED

PRODUCTION TOUCHED:
NO

OVERALL STEP 02 CLASSIFICATION:
CONDITIONAL PASS — IMPLEMENTATION COMPLETE; RELEASE/DEPLOYMENT REMAINS BLOCKED
