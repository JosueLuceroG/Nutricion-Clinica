# Runtime Configuration Matrix

Fecha: 2026-09-08. Alcance: variables leidas por Web, API, jobs, migraciones,
DWH, release tooling y deployment package. Fuente de verdad final: codigo y
tests referenciados; los `.env.example` son plantillas locales sin secretos.

## 1. Rules

- `VITE_*` es publico y queda en JavaScript/binarios. Nunca contiene un
  secreto durable.
- API/jobs/one-shot reciben secretos solo desde el SecretProvider del target.
- `STAGING`/`PRODUCTION` usan `NODE_ENV=production` y
  `ENVIRONMENT_CLASS` explicito. Un valor invalido es `UNKNOWN` y falla
  cerrado.
- Campos DWH vacios heredan el `DB_*` equivalente; `DWH_DATABASE` nunca puede
  identificar la misma base logica que `DB_NAME`.
- Valores de test/fault injection no se configuran en staging/production.
- Variables no listadas aqui no forman parte del contrato Step 02. En
  particular `LOG_LEVEL`, `AI_EGRESS_MANIFEST_STORE`,
  `SHADOW_EGRESS_APPROVED`, `SHADOW_OBSERVABILITY_READY` y
  `SHADOW_ZERO_TOLERANCE_PHENOTYPES` no son leidas por runtime y no deben usarse
  como evidencia operativa.

Leyenda scopes: `WEB` build/browser, `API` servidor, `JOBS` runner,
`MIG` migracion/seed/reset, `DWH` schema/ETL, `REL` manifest/predeploy,
`EVAL` CLI de evaluacion y `DRV` deployment driver/Compose.

## 2. Frontend-public build variables

| Variable           | Default/requirement                                                                           | Secret | Scope   |
| ------------------ | --------------------------------------------------------------------------------------------- | ------ | ------- |
| `VITE_API_URL`     | DEV `http://localhost:3000`; release Web `/api`; Desktop requiere HTTPS absoluto              | NO     | WEB     |
| `VITE_AI_ENABLED`  | `false`                                                                                       | NO     | WEB     |
| `VITE_AI_PROVIDER` | `openai`; UI-only, API usa `AI_PROVIDER`                                                      | NO     | WEB     |
| ICE WebRTC         | sin variables `VITE_*`; el cliente usa exclusivamente `/telemedicina/turn-config` autenticado | NO     | WEB/API |

`MODE`, `DEV` y `PROD` son built-ins de Vite, no inputs del operador.

## 3. Identity, network, and process

| Variable                                                                                                  | Default/requirement                                                                                   | Secret | Scope                |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------ | -------------------- |
| `NODE_ENV`                                                                                                | local libre; `production` en artifacts desplegados                                                    | NO     | API/JOBS/MIG/DWH     |
| `ENVIRONMENT_CLASS`                                                                                       | sin valor en dev -> `LOCAL`; `LOCAL / TEST / STAGING / PRODUCTION`; explicito fuera de local          | NO     | API/JOBS/MIG/DWH/REL |
| `WORKLOAD_ROLE`                                                                                           | `api / jobs / migration / dwh-schema`; obligatorio STAGING/PRODUCTION y debe coincidir con entrypoint | NO     | API/JOBS/MIG/DWH     |
| `ENVIRONMENT_NAME`                                                                                        | `<class>-default`; explicito STAGING/PRODUCTION para todo workload                                    | NO     | API/JOBS/MIG/DWH/REL |
| `INSTANCE_ID`                                                                                             | `DEPLOYMENT_ID` o `host-<hostname>`; explicito STAGING/PRODUCTION                                     | NO     | API/JOBS/MIG/DWH/REL |
| `DEPLOYMENT_ID`                                                                                           | `INSTANCE_ID`; explicito para API/JOBS y one-shots remotos                                            | NO     | API/JOBS/MIG/DWH/REL |
| `RELEASE_VERSION`                                                                                         | `0.0.0-dev`; semver explicito STAGING/PRODUCTION                                                      | NO     | API/JOBS/MIG/DWH/REL |
| `DESKTOP_RELEASE_VERSION`                                                                                 | mismo semver completo del release Desktop compartido                                                  | NO     | API/image            |
| `GIT_COMMIT`                                                                                              | Git local/`UNKNOWN`; SHA completo requerido STAGING/PRODUCTION                                        | NO     | API/JOBS/MIG/DWH/REL |
| `PORT`                                                                                                    | `3000`, rango 1-65535                                                                                 | NO     | API                  |
| `API_BIND_HOST`                                                                                           | `127.0.0.1`; imagen usa `0.0.0.0`; explicito STAGING/PRODUCTION                                       | NO     | API                  |
| `TRUST_PROXY`                                                                                             | `false`; 1-16 hops o IP/CIDR exacto; no universal                                                     | NO     | API                  |
| `SHUTDOWN_TIMEOUT_MS`                                                                                     | `15000`, rango 1000-120000                                                                            | NO     | API/JOBS validation  |
| `BACKGROUND_JOBS_ENABLED`                                                                                 | local opcional; STAGING/PRODUCTION exige API `false`, JOBS `true`                                     | NO     | API/JOBS             |
| `API_REPLICAS`                                                                                            | `1`; entero positivo; STAGING/PRODUCTION rechaza `>1` con `MULTI_REPLICA_NOT_CERTIFIED`                | NO     | API/JOBS/REL/DRV     |
| `JOBS_REPLICAS`                                                                                           | `1`; entero positivo; STAGING/PRODUCTION rechaza `>1` con `MULTI_REPLICA_NOT_CERTIFIED`                | NO     | API/JOBS/REL/DRV     |
| `PUBLIC_API_URL`                                                                                          | local opcional; HTTPS remoto exacto requerido para API STAGING/PRODUCTION                             | NO     | API/REL              |
| `PUBLIC_WEB_URL`                                                                                          | local opcional; HTTPS remoto exacto requerido para API STAGING/PRODUCTION                             | NO     | API/REL              |
| `CORS_ORIGIN`                                                                                             | HTTPS origins exactos y `tauri://localhost`; sin wildcard, HTTP remoto, paths ni credenciales         | NO     | API                  |
| `STAGING_AVAILABILITY_ATTESTED`, `STAGING_SMOKE_STATUS`, `STAGING_EVIDENCE_ID`, `STAGING_EVIDENCE_COMMIT` | disponibilidad solo con `true`, `PASS` y evidencia externa segura ligada exactamente a `GIT_COMMIT`   | NO     | REL/API              |

## 4. OLTP SQL Server

| Variable            | Default/requirement                                           | Secret       | Scope                     |
| ------------------- | ------------------------------------------------------------- | ------------ | ------------------------- |
| `DB_SERVER`         | `localhost`; explicito STAGING/PRODUCTION                     | NO           | API/JOBS/MIG/DWH fallback |
| `DB_PORT`           | omitido; preferir puerto TCP explicito en containers          | NO           | API/JOBS/MIG/DWH fallback |
| `DB_NAME`           | `nutriclinica`; identidad no-default explicita fuera de local | NO           | API/JOBS/MIG/DWH/REL      |
| `DB_TRUSTED`        | `false`; NTLM solo en host compatible                         | NO           | API/JOBS/MIG/DWH fallback |
| `DB_TRUSTED_USER`   | usuario OS                                                    | SENSITIVE ID | API/JOBS/MIG/DWH fallback |
| `DB_TRUSTED_DOMAIN` | dominio OS/vacio                                              | SENSITIVE ID | API/JOBS/MIG/DWH fallback |
| `DB_USER`           | `sa`; usar principal dedicado                                 | SENSITIVE ID | API/JOBS/MIG/DWH fallback |
| `DB_PASSWORD`       | vacio local; obligatorio en STAGING/PRODUCTION SQL Auth       | YES          | API/JOBS/MIG/DWH fallback |
| `DB_ENCRYPT`        | `false` local; `true` requerido STAGING/PRODUCTION            | NO           | API/JOBS/MIG/DWH fallback |
| `DB_TRUST_CERT`     | `true` local; `false` requerido STAGING/PRODUCTION            | NO           | API/JOBS/MIG/DWH fallback |

## 5. DWH and ETL

| Variable                     | Default/requirement                                     | Secret       | Scope            |
| ---------------------------- | ------------------------------------------------------- | ------------ | ---------------- |
| `DWH_SERVER`                 | hereda `DB_SERVER`                                      | NO           | API/JOBS/DWH     |
| `DWH_PORT`                   | hereda `DB_PORT`                                        | NO           | API/JOBS/DWH     |
| `DWH_DATABASE`               | `nutriclinicadw`; explicita y distinta fuera de local   | NO           | API/JOBS/DWH/REL |
| `DWH_TRUSTED`                | hereda `DB_TRUSTED`                                     | NO           | API/JOBS/DWH     |
| `DWH_TRUSTED_USER`           | hereda `DB_TRUSTED_USER`/OS                             | SENSITIVE ID | API/JOBS/DWH     |
| `DWH_TRUSTED_DOMAIN`         | hereda `DB_TRUSTED_DOMAIN`/OS                           | SENSITIVE ID | API/JOBS/DWH     |
| `DWH_USER`                   | hereda `DB_USER`                                        | SENSITIVE ID | API/JOBS/DWH     |
| `DWH_PASSWORD`               | hereda `DB_PASSWORD`                                    | YES          | API/JOBS/DWH     |
| `DWH_ENCRYPT`                | hereda `DB_ENCRYPT`; efectivo `true` fuera de local     | NO           | API/JOBS/DWH     |
| `DWH_TRUST_CERT`             | hereda `DB_TRUST_CERT`; efectivo `false` fuera de local | NO           | API/JOBS/DWH     |
| `DWH_ENABLED`                | `false`                                                 | NO           | API/JOBS/DWH     |
| `DWH_STORE`                  | `memory`; `sql` para DWH persistente                    | NO           | API/JOBS/DWH     |
| `DWH_LOAD_WINDOW_DAYS`       | `7`, entero >=1                                         | NO           | JOBS/DWH         |
| `DWH_MAX_FRESHNESS_DAYS`     | `3`, entero >=1                                         | NO           | API/DWH          |
| `DWH_SMALL_CELL_MIN`         | `5`, entero >=1                                         | NO           | API/DWH          |
| `DWH_SCHEDULED_LOAD_ENABLED` | `false`; solo JOBS canonicamente                        | NO           | JOBS             |
| `DWH_CRON_SCHEDULE`          | `30 4 * * *`                                            | NO           | JOBS             |
| `DWH_CRON_TIMEZONE`          | `UTC`; zona IANA valida                                 | NO           | JOBS             |
| `DWH_FAIL_INJECTION`         | vacio; test controlado solamente                        | NO           | DWH TEST ONLY    |

El head actual es `dwh-08-003`. El artefacto congelado registrado como
`dwh-08-002` se aplica primero en instalaciones nuevas y nunca se reescribe;
`dwh-upgrade-08-003.sql` convierte vigencia SCD2 a `DATETIME2(3)` y usa
`updated_at` + `ROWVERSION` como orden de captura. ETL sigue limitado a un
runner con estado `BLOCKED_NO_LEASE_RENEWAL`.

## 6. Retention jobs

| Variable                               | Default/requirement                                               | Secret            | Scope                 |
| -------------------------------------- | ----------------------------------------------------------------- | ----------------- | --------------------- |
| `RECORDING_RETENTION_YEARS`            | `10`, entero 1-100; invalido falla, no usa fallback silencioso    | NO                | API/JOBS/MIG backfill |
| `RETENTION_CLEANUP_ENABLED`            | `false`; solo `true` explicito habilita cleanup                   | NO                | JOBS                  |
| `RETENTION_CRON_SCHEDULE`              | `0 3 * * *`                                                       | NO                | JOBS                  |
| `RETENTION_CRON_TIMEZONE`              | `UTC`; zona IANA valida                                           | NO                | JOBS                  |
| `RETENTION_CLEANUP_DRY_RUN`            | `true`; `false` habilita borrado solo con atestacion legal        | HIGH-RISK CONTROL | JOBS                  |
| `RETENTION_LEGAL_HOLD_REVIEW_ATTESTED` | `false`; exact `true` requerido para borrado/backfill apply       | HIGH-RISK CONTROL | JOBS/MIG              |
| `RETENTION_CLEANUP_BATCH_SIZE`         | `100`, entero 1-1000                                              | NO                | JOBS/MIG              |
| `RETENTION_BACKFILL_APPLY`             | `false`; default reporta candidatos con `retention_until IS NULL` | HIGH-RISK CONTROL | MIG                   |

JOBS falla al arrancar si retencion y DWH schedule estan ambos apagados.
Retencion permanece `BLOCKED_NO_DISTRIBUTED_LOCK`; `noOverlap` solo protege una
instancia y no certifica multiples runners.

## 7. Authentication and encryption

| Variable               | Default/requirement                                                                   | Secret                  | Scope |
| ---------------------- | ------------------------------------------------------------------------------------- | ----------------------- | ----- |
| `JWT_SECRET`           | minimo 32 chars y no trivial/placeholder fuera de local; rotatable con session impact | YES                     | API   |
| `JWT_EXPIRES_IN`       | `8h`                                                                                  | NO                      | API   |
| `JWT_ISSUER`           | `nutriclinica-api`                                                                    | NO                      | API   |
| `JWT_AUDIENCE`         | `nutriclinica-web`                                                                    | NO                      | API   |
| `ARGON2_MEMORY_COST`   | `19456` KiB                                                                           | NO                      | API   |
| `ARGON2_TIME_COST`     | `2`                                                                                   | NO                      | API   |
| `ARGON2_PARALLELISM`   | `1`                                                                                   | NO                      | API   |
| `FIELD_ENCRYPTION_KEY` | minimo 32 chars y no trivial/placeholder fuera de local; exige backup/rotation plan   | YES                     | API   |
| `TOTP_ENCRYPTION_KEY`  | fallback a field key/JWT; preferir clave independiente                                | YES                     | API   |
| `CRYPTO_SALT`          | `nutriclinica-server-v1`; estable por lineage                                         | NO, STABILITY SENSITIVE | API   |

## 8. SMTP, WebRTC, and external effects

| Variable                           | Default/requirement                                                                      | Secret       | Scope                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ------------ | ------------------------------ |
| `EXTERNAL_SIDE_EFFECTS_MODE`       | `DISABLED / SANDBOX / PRODUCTION`; STAGING no permite production mode                    | NO           | API/JOBS validation            |
| `SMTP_HOST`                        | vacio; requerido para envio real                                                         | NO           | API                            |
| `SMTP_PORT`                        | `587`; `465` activa secure                                                               | NO           | API                            |
| `SMTP_USER`                        | vacio                                                                                    | SENSITIVE ID | API                            |
| `SMTP_PASS`                        | vacio                                                                                    | YES          | API                            |
| `EMAIL_FROM`                       | local placeholder; identidad aprobada para envio real                                    | NO           | API                            |
| `EMAIL_FROM_NAME`                  | `NutriClinica`                                                                           | NO           | API                            |
| `STUN_URLS`                        | vacio; sin servidor publico implicito; solo con side effects SANDBOX/PRODUCTION efectivo | NO           | API authenticated ICE endpoint |
| `TURN_URLS`                        | vacio                                                                                    | NO           | API authenticated ICE endpoint |
| `TURN_USERNAME`, `TURN_CREDENTIAL` | credencial estatica permitida solo para SANDBOX aprobado                                 | YES          | API authenticated ICE endpoint |
| `TURN_SHARED_SECRET`               | obligatorio para TURN PRODUCTION; genera credenciales coturn REST efimeras               | YES          | API                            |
| `TURN_CREDENTIAL_TTL_SECONDS`      | `3600`; entero 60-86400, inválido bloquea startup                                        | NO           | API/JOBS validation            |

Email `SANDBOX` es simulacion sin entrega; envio real exige modo y entorno
`PRODUCTION`, STARTTLS/TLS y configuracion SMTP completa. ICE `SANDBOX` permite
solo endpoints explicitamente configurados; `DISABLED` devuelve lista vacia.
La respuesta autenticada siempre declara la politica server-controlled
`OPTIONAL_DIRECT_ALLOWED`. Un fallo o respuesta invalida bloquea signaling;
`configured=false` permite ICE directo y `configured=true` exige un TURN con
credenciales y scheme `turn:`/`turns:` valido.

## 9. Release manifest and artifact paths

| Variable                                                                                                                             | Default/requirement                                                                 | Secret            | Scope                |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ----------------- | -------------------- |
| `API_ARTIFACT`, `API_ARTIFACT_DIGEST`                                                                                                | referencia OCI `repo@sha256:...` ligada al mismo digest                             | NO                | REL/API/JOBS/MIG/DWH |
| `WEB_ARTIFACT`, `WEB_ARTIFACT_DIGEST`                                                                                                | referencia OCI `repo@sha256:...` ligada al mismo digest                             | NO                | REL/API/JOBS/MIG/DWH |
| `SECRET_SCAN_STATUS`, `SECRET_SCAN_COMMIT`, `SECRET_SCAN_EVIDENCE_ID`                                                                | `PASS` solo con atestacion CI ligada a `GIT_COMMIT`; ausencia bloquea target remoto | NO                | REL/API/JOBS/MIG/DWH |
| `DESKTOP_ARTIFACT`, `DESKTOP_ARTIFACT_DIGEST`                                                                                        | igual                                                                               | NO                | REL/API              |
| `DESKTOP_RELEASE_AUTHORIZED`, `DESKTOP_SIGNING_STATUS`, `DESKTOP_UPDATER_STATUS`, `DESKTOP_PUBLIC_API_URL`, `DESKTOP_PUBLIC_WEB_URL` | release bloqueado hasta autorizacion, firma, updater, API/CSP y Web exactos         | HIGH-RISK CONTROL | release CI           |
| `NUTRICLINICA_REPO_ROOT`                                                                                                             | derivado en source; imagen lo fija en `/app`                                        | NO                | REL/API              |
| `NUTRICLINICA_MIGRATIONS_DIR`                                                                                                        | derivado; imagen `/app/apps/api/migrations`                                         | NO                | MIG                  |
| `NUTRICLINICA_DWH_SCHEMA_FILE`                                                                                                       | colocated; imagen `dist-deploy/dwh-schema.sql`                                      | NO                | DWH                  |
| `NUTRICLINICA_DWH_UPGRADE_FILE`                                                                                                      | colocated; imagen `dist-deploy/dwh-upgrade-08-003.sql`                              | NO                | DWH                  |

## 10. Destructive-action guards and seed

| Variable                       | Default/requirement                                    | Secret            | Scope    |
| ------------------------------ | ------------------------------------------------------ | ----------------- | -------- |
| `ALLOW_PRODUCTION_MIGRATE`     | false; exact `true` bajo change control                | HIGH-RISK CONTROL | MIG/DWH  |
| `ALLOW_PRODUCTION_DWH_SCHEMA`  | false; exact `true` bajo change control                | HIGH-RISK CONTROL | DWH      |
| `ALLOW_PRODUCTION_SEED`        | false; seed production no es procedimiento normal      | HIGH-RISK CONTROL | MIG      |
| `ALLOW_PRODUCTION_RESET`       | false                                                  | HIGH-RISK CONTROL | MIG      |
| `ALLOW_PRODUCTION_REBUILD`     | false; guard generico/latente                          | HIGH-RISK CONTROL | MIG/DWH  |
| `ALLOW_PRODUCTION_DROP`        | false; guard generico/latente                          | HIGH-RISK CONTROL | MIG/DWH  |
| `ALLOW_PRODUCTION_MAINTENANCE` | false; requerido para retention backfill en production | HIGH-RISK CONTROL | MIG      |
| `CHANGE_REQUEST_ID`            | ID aprobado no-placeholder para one-shots SQL remotos  | HIGH-RISK CONTROL | MIG/DWH  |
| `BACKUP_RESTORE_ATTESTED`      | exact `true` antes de one-shots SQL remotos            | HIGH-RISK CONTROL | MIG/DWH  |
| `ROLLBACK_ARTIFACT_DIGEST`     | digest `sha256:` del artefacto de rollback             | HIGH-RISK CONTROL | MIG/DWH  |
| `SEED_ADMIN_EMAIL`             | `admin@nutriclinica.local`                             | NO                | MIG seed |
| `SEED_ADMIN_PASSWORD`          | obligatorio, minimo 12                                 | YES               | MIG seed |
| `SEED_ADMIN_NOMBRE`            | `Administrador`                                        | NO                | MIG seed |
| `SEED_SUCURSAL_NOMBRE`         | `Sucursal Centro`                                      | NO                | MIG seed |

## 11. AI provider and routing

| Variable/group                            | Default/requirement                                    | Secret | Scope                        |
| ----------------------------------------- | ------------------------------------------------------ | ------ | ---------------------------- |
| `AI_EGRESS_ENABLED`                       | `false`; permanece false en STAGING/PRODUCTION Step 02 | NO     | API/JOBS validation/EVAL/REL |
| `AI_PROVIDER`                             | `openai`; `ollama` alternativo                         | NO     | API                          |
| `OPENAI_API_KEY`, `AI_API_KEY`            | vacio; segundo es fallback generico                    | YES    | API/EVAL                     |
| `OPENAI_BASE_URL`                         | `https://api.openai.com/v1`                            | NO     | API                          |
| `OLLAMA_BASE_URL`                         | `http://localhost:11434`; API compatible agrega `/v1`  | NO     | API/EVAL                     |
| `OPENAI_MODEL`                            | `gpt-4o-mini` si no se especifica                      | NO     | API/EVAL                     |
| `AI_MODEL`                                | `llama3.2` si no se especifica                         | NO     | API/EVAL                     |
| `AI_MODEL_MODE`                           | local auto salvo modelo explicito                      | NO     | API                          |
| `AI_MODEL_FALLBACK_POLICY`                | `LOCAL_ONLY`; cloud solo explicito                     | NO     | API                          |
| `AI_ALLOWED_PROVIDERS`                    | `openai,ollama`                                        | NO     | API                          |
| `AI_ALLOWED_MODELS`                       | defaults + modelos explicitados                        | NO     | API                          |
| `AI_FALLBACK_PROVIDERS`                   | `openai,ollama`                                        | NO     | API                          |
| `AI_CIRCUIT_BREAKER_THRESHOLD`            | `5`, >=1                                               | NO     | API                          |
| `AI_CIRCUIT_BREAKER_COOLDOWN_MS`          | `30000`, >=0                                           | NO     | API                          |
| `AI_QUALIFICATION_ENFORCED`               | fail-closed, default true                              | NO     | API/EVAL                     |
| `AI_PINNED_MODEL_VERSIONS`                | JSON de versiones exactas                              | NO     | API/EVAL                     |
| `AI_TOOLS_ENABLED`                        | `false`                                                | NO     | API                          |
| `AI_TOOLS_ALLOWLIST`                      | vacio                                                  | NO     | API                          |
| `AI_CERTIFICATION_STORE`                  | `memory` local; STAGING/PRODUCTION requieren `sql`     | NO     | API/JOBS validation          |
| `AI_PROVIDER_PHI_ALLOWED_OPENAI`          | `false`                                                | NO     | API                          |
| `AI_PROVIDER_APPROVED_CLINICAL_OPENAI`    | `false`                                                | NO     | API                          |
| `AI_PROVIDER_RESIDENCY_OPENAI`            | `unknown`                                              | NO     | API                          |
| `AI_PROVIDER_RETENTION_KNOWN_OPENAI`      | `false`                                                | NO     | API                          |
| `AI_PROVIDER_TRAINING_USE_ALLOWED_OPENAI` | `false`                                                | NO     | API                          |
| `AI_PROVIDER_TRAINING_USE_ALLOWED_OLLAMA` | `false`                                                | NO     | API                          |

## 12. AI capability, RAG, memory, actions, and agents

| Variable/group                                                | Default/requirement                                | Secret | Scope                   |
| ------------------------------------------------------------- | -------------------------------------------------- | ------ | ----------------------- |
| `AI_EXPERT_ENABLED`                                           | `false`                                            | NO     | API/REL                 |
| `AI_SHADOW_MODE_ENABLED`                                      | `false`                                            | NO     | API                     |
| `AI_SHADOW_SAMPLE_RATE`                                       | `0`, rango 0-1                                     | NO     | API/JOBS validation     |
| `AI_CLINICAL_DISAGREEMENT_THRESHOLD`                          | `3`, >=1                                           | NO     | API                     |
| `AI_CLINICAL_WINDOW_DAYS`                                     | `7`, >=1                                           | NO     | API                     |
| `AI_CLINICAL_REVIEW_STORE`                                    | `memory` local; STAGING/PRODUCTION requieren `sql` | NO     | API/JOBS validation     |
| `AI_RAG_DOC_STORE`                                            | `memory / sql`, default memory                     | NO     | API                     |
| `AI_RAG_VERSIONED`                                            | `false`                                            | NO     | API                     |
| `AI_MEMORY_ENABLED`                                           | `false`                                            | NO     | API                     |
| `AI_MEMORY_STORE`                                             | `memory / sql`, default memory                     | NO     | API                     |
| `AI_MEMORY_RETENTION_DAYS`                                    | `90`, >=1                                          | NO     | API                     |
| `AI_MEMORY_MAX_ENTRIES`                                       | `50`, >=1                                          | NO     | API                     |
| `AI_PATIENT_ENABLED`                                          | `false`; true rechazado STAGING/PRODUCTION         | NO     | API/JOBS validation/REL |
| `AI_PATIENT_MAX_QUERY_CHARS`                                  | `500`, >0                                          | NO     | API                     |
| `AI_ACTIONS_ENABLED`                                          | `false`                                            | NO     | API/REL                 |
| `AI_ACTIONS_LEDGER_STORE`                                     | `memory / sql`, default memory                     | NO     | API                     |
| `AI_ACTIONS_CONFIRMATION_TTL_MIN`                             | `10`, >0                                           | NO     | API                     |
| `AI_ACTIONS_MAX_PENDING_CONFIRMATIONS`                        | `10`, >0                                           | NO     | API                     |
| `AI_AGENTS_ENABLED`                                           | `false`                                            | NO     | API/REL                 |
| `AI_AGENTS_LEDGER_STORE`                                      | `memory / sql`, default memory                     | NO     | API                     |
| `AI_AGENTS_MAX_STEPS`, `AI_AGENTS_MAX_TOOL_CALLS`             | `8`, `8`                                           | NO     | API                     |
| `AI_AGENTS_MAX_TOKENS`, `AI_AGENTS_MAX_COST`                  | `4096`, `1`                                        | NO     | API                     |
| `AI_AGENTS_TIMEOUT_MS`, `AI_AGENTS_MAX_ACTIVE_RUNS_PER_ACTOR` | `60000`, `2`                                       | NO     | API                     |
| `AI_SPECIALIZATION_ENABLED`                                   | `false`                                            | NO     | API                     |
| `AI_SPECIALIZATION_STORE`                                     | `memory / sql`, default memory                     | NO     | API                     |
| `AI_SPECIALIZATION_PASS_RATES`                                | JSON vacio                                         | NO     | API                     |
| `AI_DWH_NARRATIVE_ENABLED`                                    | `false`; inventory flag                            | NO     | API/REL                 |

## 13. Telemetry and alerts

| Variable/group                              | Default/requirement                                | Secret | Scope               |
| ------------------------------------------- | -------------------------------------------------- | ------ | ------------------- |
| `AI_TELEMETRY_STORE`                        | `memory` local; STAGING/PRODUCTION requieren `sql` | NO     | API/JOBS validation |
| `AI_TELEMETRY_MAX_EVENT_BYTES`              | `2048`, range 256-65536                            | NO     | API                 |
| `AI_TELEMETRY_PERCENTILE_MIN_SAMPLES`       | `5`, range 1-100000                                | NO     | API/JOBS validation |
| `AI_TELEMETRY_RETENTION_RAW_DAYS`           | `7`, range 1-36500                                 | NO     | API                 |
| `AI_TELEMETRY_RETENTION_AGG_DAYS`           | `90`, range 1-36500                                | NO     | API                 |
| `AI_TELEMETRY_RETENTION_ALERT_DAYS`         | `30`, range 1-36500                                | NO     | API                 |
| `AI_TELEMETRY_ALERT_BREAKER_OPENED`         | `true`; booleano estricto                          | NO     | API/JOBS validation |
| `AI_TELEMETRY_ALERT_SCHEMA_FAILURE_SPIKE`   | `5`, entero >=1                                    | NO     | API/JOBS validation |
| `AI_TELEMETRY_ALERT_CITATION_VALIDITY_MIN`  | `0.5`, rango 0-1                                   | NO     | API/JOBS validation |
| `AI_TELEMETRY_ALERT_DWH_RECONCILIATION`     | `true`; booleano estricto                          | NO     | API/JOBS validation |
| `AI_TELEMETRY_ALERT_UNSAFE_EVENT`           | `true`; booleano estricto                          | NO     | API/JOBS validation |
| `AI_TELEMETRY_ALERT_UNAUTHORIZED_RETRIEVAL` | `true`; booleano estricto                          | NO     | API/JOBS validation |
| `AI_TELEMETRY_ALERT_CRITICAL_DISAGREEMENT`  | `1`, entero >=1                                    | NO     | API/JOBS validation |

Retention telemetry tiene generadores SQL pero no un job programado de purge
hallado. El target no debe asumir que se ejecuta automaticamente.

Telemetria y persistencia del egress manifest son `FAIL_SOFT`: se intenta
persistir antes del adapter, pero un intento no afirma escritura exitosa. La
autorizacion de egreso permanece `FAIL_CLOSED`, y `requiredAuditLog(...)` es un
control separado `FAIL_CLOSED` para mutaciones que lo declaran.

El startup gate valida los valores `memory / sql`, pero no fuerza todos los
stores AI a SQL. La topologia permanece en una replica; cualquier requisito de
durabilidad tras restart exige seleccionar/probar el store SQL correspondiente.

## 14. Shadow pilot and governance

| Variable/group                                                                         | Default/requirement                                     | Secret             | Scope                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------ | ----------------------- |
| `AI_SHADOW_STATE`                                                                      | `DISABLED`; state machine exacta                        | NO                 | API/JOBS validation/REL |
| `AI_STAGING_BASE_URL`                                                                  | sin default; requerido para readiness                   | NO                 | API                     |
| `SHADOW_TEST_QUALIFIED_PROVIDER`, `SHADOW_TEST_QUALIFIED_MODEL`                        | ambos requeridos para technical test                    | NO                 | API                     |
| `SHADOW_CONSENT_POLICY`                                                                | vacio; professional requiere `declared_ready`           | NO                 | API                     |
| `SHADOW_REVIEWER_KEYS`                                                                 | lista no vacia para readiness                           | SENSITIVE ID       | API                     |
| `SHADOW_REVIEWER_SCOPES`                                                               | JSON con `reviewerKey`, role, capabilities, sucursalIds | SENSITIVE METADATA | API                     |
| `SHADOW_ROLLBACK_VERIFIED`, `SHADOW_BACKUP_VERIFIED`                                   | `false`; ambos true para readiness                      | NO                 | API                     |
| `SHADOW_PILOT_CAPABILITIES`, `SHADOW_PILOT_RISK_LEVELS`, `SHADOW_PILOT_REVIEWER_ROLES` | listas requeridas en pilot professional                 | NO                 | API                     |
| `SHADOW_PILOT_SAMPLING_PERCENT`                                                        | requerido professional, 0-100                           | NO                 | API                     |
| `SHADOW_PILOT_MIN_SAMPLE`                                                              | opcional/null                                           | NO                 | API                     |
| `SHADOW_PILOT_START_AT`, `SHADOW_PILOT_END_AT`                                         | opcional ISO timestamps                                 | NO                 | API                     |
| `SHADOW_PILOT_ZERO_TOLERANCE_UNSAFE`                                                   | `true`                                                  | NO                 | API                     |
| `SHADOW_PILOT_ZERO_TOLERANCE_CRITICAL_DISAGREEMENT`                                    | `true`                                                  | NO                 | API                     |
| `SHADOW_PILOT_ZERO_TOLERANCE_SHOULD_HAVE_ABSTAINED`                                    | `true`                                                  | NO                 | API                     |
| `AI_SHADOW_AUTODISABLE_UNSAFE_MAX`                                                     | `0`                                                     | NO                 | API                     |
| `AI_SHADOW_AUTODISABLE_CRITICAL_DISAGREEMENT_MAX`                                      | `0`                                                     | NO                 | API                     |
| `AI_SHADOW_AUTODISABLE_SHOULD_HAVE_ABSTAINED_MAX`                                      | `0`                                                     | NO                 | API                     |
| `AI_SHADOW_AUTODISABLE_CITATION_INVALID_MAX`                                           | `1`                                                     | NO                 | API                     |
| `AI_SHADOW_AUTODISABLE_AGREEMENT_MIN`                                                  | `0.6`                                                   | NO                 | API                     |
| `AI_SHADOW_AUTODISABLE_MIN_SAMPLES`                                                    | `5`                                                     | NO                 | API                     |
| `SHADOW_GOVERNANCE_PILOT_OWNER`                                                        | sin default                                             | SENSITIVE ID       | API dormant reader      |
| `SHADOW_GOVERNANCE_CLINICAL_OWNER`                                                     | sin default                                             | SENSITIVE ID       | API dormant reader      |
| `SHADOW_GOVERNANCE_TECHNICAL_OWNER`                                                    | sin default                                             | SENSITIVE ID       | API dormant reader      |
| `SHADOW_GOVERNANCE_APPROVED_CAPABILITIES`                                              | lista vacia                                             | NO                 | API dormant reader      |
| `SHADOW_GOVERNANCE_APPROVED_REVIEWERS`                                                 | lista vacia                                             | SENSITIVE ID       | API dormant reader      |
| `SHADOW_GOVERNANCE_APPROVAL_DATE`                                                      | null                                                    | NO                 | API dormant reader      |

Los readers de governance no tienen caller runtime no-test observado; su
presencia no equivale a shadow readiness. Estado actual permanece DISABLED /
BLOCKED_BY_MODEL.

## 15. Evaluation-only CLI variables

| Variable                   | Default/requirement  | Secret | Scope |
| -------------------------- | -------------------- | ------ | ----- |
| `RAG_RETRIEVAL_MIN_RECALL` | `0.6`                | NO     | EVAL  |
| `RAG_EVAL_TOP_K`           | `4`                  | NO     | EVAL  |
| `RAG_BASELINE_MODE`        | `v2`                 | NO     | EVAL  |
| `AI_BENCHMARK_ONLY`        | todos los candidatos | NO     | EVAL  |
| `AI_BENCHMARK_REPETITIONS` | `2`                  | NO     | EVAL  |

`AI_REAL_SQL_TEST` se excluye: es exclusivamente test-only. Ninguna variable
de evaluacion habilita o certifica un modelo por si sola.

## 16. Deployment driver and Compose

| Variable                                                                     | Requirement                                          | Secret | Scope                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------------- | ------ | ----------------------------------------------- |
| `DEPLOYMENT_ENVIRONMENT`                                                     | `TEST`, `STAGING` o `PRODUCTION`                     | NO     | DRV                                             |
| `RELEASE_VERSION`, `RELEASE_COMMIT`                                          | semver + SHA completo                                | NO     | DRV/build; se mapean a app release/Git identity |
| `API_ARTIFACT`, `WEB_ARTIFACT`, `API_ARTIFACT_DIGEST`, `WEB_ARTIFACT_DIGEST` | IDs y digests `sha256:` inmutables, no `latest`      | NO     | DRV                                             |
| `API_HOST`, `WEB_HOST`                                                       | HTTPS remoto para STAGING/PRODUCTION                 | NO     | DRV                                             |
| `API_REPLICAS`, `JOBS_REPLICAS`                                             | default `1`; enteros positivos; `>1` bloqueado fuera de TEST | NO | DRV/runtime                                     |
| `OLTP_TARGET`, `DWH_TARGET`                                                  | identidades distintas                                | NO     | DRV                                             |
| `SECRET_PROVIDER`                                                            | ID de contrato aprobado, nunca secret value          | NO     | DRV                                             |
| `STORAGE_TARGET`, `BACKUP_TARGET`                                            | identidades aprobadas                                | NO     | DRV                                             |
| `SECRET_SCAN_STATUS`, `SECRET_SCAN_COMMIT`, `SECRET_SCAN_EVIDENCE_ID`        | `PASS`, SHA coincidente y atestacion CI explicita    | NO     | DRV                                             |
| `API_UPSTREAM`                                                               | default compose `http://api:3000`                    | NO     | Web Nginx runtime                               |
| `API_PORT`, `WEB_PORT`                                                       | host ports local simulation, defaults `3000`, `8080` | NO     | DRV local only                                  |

El driver es no-secreto y no se pasa completo al proceso. `pnpm
deployment:validate -- --env-file <ruta> --print-runtime-map` valida el archivo
explicito y emite el mapeo no-secreto comun; el operador completa por workload
roles, red y secret injection despues de autorizacion.
