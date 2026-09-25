# NUTRICLÍNICA — RELEASE FOUNDATION STEP 02.1 REPORT

Fecha de cierre local: 2026-09-09. Modo: BUILD / CORRECTNESS HARDENING. No
staging, deployment, push, tag, GitHub Release ni acceso a producción.

El resultado de corrección de software de Step 02.1 es PASS. La publicación y
el despliegue siguen bloqueados de forma intencional por infraestructura y
evidencia externa no disponibles.

## Git State Before

- Rama inicial: `infra/deployment-foundation-step-02`.
- HEAD inicial: `0ba55833bddc9d80173ee0dc6a5201ffbee4cda9`.
- Implementación Step 02 heredada:
  `994f5ad40b0e7bb781fc4d89eb21ffac535637e4`.
- Baseline Step 01:
  `d0565e8dee075bb9fd64ae266f329f60e5d2d078`.
- Worktree inicial: CLEAN.
- `git status`, rama, log, diff y tags en HEAD fueron inspeccionados antes de
  modificar.
- Se creó `hardening/release-foundation-02-1` desde el HEAD documental Step 02.
- `d0565e8...`, `994f5ad...` y `0ba5583...` son ancestros del cierre Step 02.1.
- Ningún tag apuntaba al HEAD inicial. `v0.1.0-rc.1` permanece en el baseline
  Step 01.
- No existe ni se creó `v0.1.0-rc.2`.
- HEAD de implementación final antes de este reporte:
  `3e0e8ffece174832efcb3afdda8242417c2d2686`.
- Cambio Step 02.1 acumulado: 53 archivos, 2,401 inserciones y 390 eliminaciones.

## Scope

El alcance se limitó a los riesgos residuales definidos para Step 02.1:

- invalidación generacional y cancelación del chat realtime;
- SCD2 intradía con upgrade aditivo a `dwh-08-003`;
- pins inmutables para Actions externas y permisos mínimos;
- restricción operacional de una réplica API y una réplica jobs;
- semántica exacta de egress manifest fail-soft y audit requerido fail-closed;
- contrato TURN explícito `OPTIONAL_DIRECT_ALLOWED`;
- evidencia local de calidad, SQL real, artefactos nativos, E2E y Tauri.

Se preservaron Desktop-first, Web secundario, backend compartido, Dexie
offline-first, separación de workloads, manifest existentes, health, target
guards, RAG, Memory, Shadow, certificación AI y Patient AI. No se añadió Redis,
Kafka, microservicios, proveedor cloud, staging, DNS, TLS, registry ni
SecretProvider.

## Realtime Residual Before

`useRealtimeChat` no tenía una identidad generacional que cubriera paciente,
tenant/canal y credencial. Un fetch, resolución de `getWsConnection`, callback
de socket o polling iniciado para una identidad anterior podía terminar después
de un cambio de contexto y competir con el estado actual.

El problema era especialmente sensible porque una resolución tardía del
paciente A podía intentar escribir en el estado ya asociado al paciente B. Los
timers y callbacks tampoco tenían una prueba dedicada que demostrara su
aislamiento tras cambio de identidad o unmount.

## Realtime Generation Design

`useRealtimeChat` recibe ahora un `identityKey` estable que representa la
identidad realtime completa. Los consumidores profesionales incluyen canal,
sesión autenticada, sucursal y paciente; el portal incluye su sesión de portal.
El valor no se registra ni persiste.

Cada ejecución del efecto incrementa `generationRef` y captura su generación.
Toda mutación de estado, instalación de socket, callback, timer y polling exige
simultáneamente:

- efecto activo;
- generación capturada igual a la generación actual;
- snapshot perteneciente al mismo `identityKey`;
- recurso local todavía vigente cuando corresponde.

El cleanup invalida primero la generación y después aborta/cierra recursos. El
resultado público devuelve mensajes vacíos, loading seguro y sin error cuando
el snapshot aún pertenece a la identidad anterior.

## Fetch Cancellation

Cada carga crea un `AbortController`. Una carga nueva aborta la anterior y el
cleanup aborta cualquier petición pendiente. La respuesta solo se aplica si el
controller no fue abortado, sigue siendo el controller actual y la generación
continúa vigente.

`AbortError` se trata como cancelación normal de ciclo de vida: no se muestra al
usuario, no cambia el error y no permite que una respuesta de paciente/token
anterior altere el snapshot actual.

## Pending WebSocket Cancellation/Invalidation

`getWsConnection()` devuelve datos de conexión, no un socket cancelable. Por
ello una promesa pendiente se invalida por generación. Si resuelve tarde, no se
invoca el constructor `WebSocket` y no queda recurso que instalar.

Si el socket ya fue creado cuando cambia la identidad, cleanup elimina
`onopen`, `onmessage`, `onerror` y `onclose`, lo cierra y borra la referencia.
Una carrera entre constructor e invalidación también cierra inmediatamente el
nuevo socket antes de instalarlo.

## Polling Cancellation

Existe como máximo un `setInterval` por generación. Cada tick comprueba la
generación antes de cargar. Cleanup limpia el interval y aborta el fetch
asociado. Una respuesta de polling anterior también debe coincidir con la
generación y controller actuales antes de modificar mensajes, loading o error.

El fallback solo arranca ante fallo/cierre WebSocket de la generación vigente;
un socket antiguo no puede reiniciarlo. La reconexión usa un único timer con
backoff acotado y el mismo guard generacional.

## Cross-Patient Regression

La regresión usa exclusivamente `PATIENT_A_MESSAGE` y `PATIENT_B_MESSAGE`
sintéticos. Después de cambiar de A a B, resuelve el fetch de A y ejecuta un
handler de socket A que ya estaba encolado. En ambos casos el estado B conserva
solo su contenido.

Resultado: 0 mensajes del paciente A observados en el estado realtime del
paciente B.

### Realtime race matrix

| SCENARIO                                | OLD BEHAVIOR                                   | NEW BEHAVIOR                                  | TEST | PASS |
| --------------------------------------- | ---------------------------------------------- | --------------------------------------------- | ---- | ---- |
| Fetch A resuelve tras cambiar a B       | Podía competir con estado B                    | Controller abortado y generación A descartada | A    | YES  |
| Conexión A resuelve tras cambiar a B    | Podía crear/instalar socket obsoleto           | No se construye socket para generación A      | B    | YES  |
| Token cambia con fetch pendiente        | Respuesta anterior no tenía identidad completa | Abort + identity generation                   | C    | YES  |
| Token cambia con socket conectando      | Socket anterior podía sobrevivir               | Handlers anulados y socket cerrado            | D    | YES  |
| Unmount con fetch pendiente             | No existía prueba de cancelación               | Fetch abortado; resultado ignorado            | E    | YES  |
| Unmount con socket pendiente/creado     | No existía prueba de cierre tardío             | Generación inválida; socket cerrado           | F    | YES  |
| Evento de socket A encolado tras switch | Podía anexar mensaje A                         | Callback de A queda invalidado                | G    | YES  |
| Poll A resuelve tras switch             | Podía reemplazar mensajes B                    | Controller y generación impiden update        | H    | YES  |
| Nueva generación conecta                | Sin garantía dedicada                          | Solo B crea socket y procesa eventos          | I    | YES  |
| WebSocket vigente falla                 | Riesgo de loops polling duplicados             | Un fallback polling funcional                 | J    | YES  |

## useRealtimeChat Tests

`src/hooks/useRealtimeChat.test.ts` contiene los diez escenarios obligatorios
A-J sin sleeps temporales frágiles. Usa promesas controladas y fake timers solo
para polling. Ejecución focal final: 10/10 PASS.

Los tests adicionales de `useWebRTC` ejecutados junto al dominio realtime
pasaron 13/13. Total frontend focal realtime/TURN: 23/23.

## DWH SCD2 Problem

`dwh-08-002` definía `valid_from` y `valid_to` con granularidad `DATE` y una
clave única por entidad + fecha. Una segunda versión de profesional o sucursal
en el mismo día podía colisionar o perder precisión histórica.

No se modificó el DDL histórico. La solución se implementó como un nuevo head
de cadena DWH con temporalidad autoritativa del OLTP.

## Previous DWH Version Immutability

- Versión previa: `dwh-08-002`.
- Archivo congelado:
  `apps/api/src/modules/dwh/schema/dwh-schema.sql`.
- Git blob observado antes y después:
  `00b0638f16d518b6ed39044fad5027f2ba440eb1`.
- SHA-256 normalizado CRLF/LF:
  `9fd179f5a9821930d99c5b87a2e17043eab94f5aa54726d620513fd096dcab40`.
- `git diff --exit-code 0ba5583..3e0e8ff -- apps/api/migrations
apps/api/src/modules/dwh/schema/dwh-schema.sql`: PASS.
- Migraciones OLTP `001`-`039`: sin cambios.

El test de versión también verifica que el DDL previo no contiene las nuevas
columnas `source_version` y que un checksum histórico distinto falla cerrado.

## New DWH Version

El nuevo head exacto es `dwh-08-003`. La cadena se representa como:

`dwh-08-002:<checksum-base> + dwh-08-003:<checksum-upgrade>`.

El deployment/release manifest, el ETL y el estado DWH reportan
`dwh-08-003`. La versión de código ETL es `dwh-etl-08-003` y la transformación
es `dwh-transform-v2`.

`assertDwhSchemaCompatible` exige que base y head estén registrados con sus
checksums exactos antes de ejecutar ETL. Ausencia o drift del head falla
cerrado y requiere el workload one-shot de schema.

## SCD2 Validity Semantics

- Intervalos UTC semiabiertos `[valid_from, valid_to)`.
- `valid_from` y `valid_to`: SQL Server `DATETIME2(3)`.
- Fila actual: `valid_to IS NULL` e `is_current = 1`.
- Orden primario: `updated_at` autoritativo del OLTP.
- Desempate estable para el mismo timestamp: `ROWVERSION` de ocho bytes.
- Identidad histórica única: natural id + `valid_from` + `source_version`.
- Índice filtrado garantiza como máximo una fila actual por natural id.
- Checks impiden fila cerrada sin `valid_to` y exigen `valid_to >= valid_from`.

Dos cambios capturados con el mismo `updated_at` conservan ambos source
versions. El anterior queda como intervalo válido de duración cero
`[t, t)` y el último queda vigente desde `t`; no se inventan milisegundos. Una
revisión indistinguible o entrada fuera de orden no soportada falla con código
explícito, en lugar de sobrescribir historia.

No se declara event sourcing arbitrario: solo se conservan estados que el ETL
alcanza a capturar del OLTP. Estados sobrescritos entre dos capturas no pueden
reconstruirse sin una fuente de eventos que está fuera de este Step.

## Professional Same-Day Versions

SQL real y unit tests capturaron Professional A a las 09:00, B a las 13:00, C
a las 17:00 y D también a las 17:00 con un `ROWVERSION` posterior. Se
preservaron cuatro surrogate rows, ordenadas por timestamp + source version,
sin colisión y con D como única fila actual.

## Sucursal Same-Day Versions

El mismo flujo A/B/C/D se ejecutó sobre `dim_sucursal`. Se preservaron cuatro
filas, incluida la doble revisión de las 17:00, sin colisión y con una sola fila
actual.

### DWH SCD2 matrix

| CASE                               |             VERSIONS | EXPECTED INTERVALS                                                | CURRENT FLAG | IDEMPOTENT | PASS |
| ---------------------------------- | -------------------: | ----------------------------------------------------------------- | ------------ | ---------- | ---- |
| Professional A/B/C/D intradía      |                    4 | `[09:00,13:00)`, `[13:00,17:00)`, `[17:00,17:00)`, `[17:00,open)` | D only       | YES        | YES  |
| Sucursal A/B/C/D intradía          |                    4 | `[09:00,13:00)`, `[13:00,17:00)`, `[17:00,17:00)`, `[17:00,open)` | D only       | YES        | YES  |
| Misma marca temporal               | 2 captured revisions | Orden por `source_version`                                        | Latest only  | YES        | YES  |
| Atributos iguales con fuente nueva |                    1 | Intervalo sin reabrir                                             | Preserved    | YES        | YES  |
| Replay de última versión           |             4 remain | No cambia intervalos                                              | One current  | YES        | YES  |
| Legacy `dwh-08-002`                |    History preserved | Intervalos previos conservados                                    | Preserved    | YES        | YES  |
| Entrada anterior al current        |                  N/A | Rechazo explícito                                                 | Unchanged    | YES        | YES  |

## DWH Upgrade

`dwh-upgrade-08-003.sql` se ejecuta en una transacción con `XACT_ABORT`. Exige
las dimensiones previas, añade metadata nullable, valida que no haya múltiples
current rows, reemplaza los índices de identidad, cambia precisión y añade
índices/constraints de unicidad e intervalo.

El upgrade no contiene `DELETE`, `TRUNCATE` ni `DROP TABLE`. Los rows legacy se
conservan y dejan `source_updated_at/source_version` en NULL porque esa metadata
no puede reconstruirse honestamente. La primera observación igual adopta la
metadata mediante `REFRESH_SOURCE`; una observación diferente solo se anexa si
es temporalmente posterior al `valid_from` legacy.

La prueba SQL real sembró rows representativos `dwh-08-002`, aplicó el upgrade,
confirmó ambos registros de versión/checksum, mantuvo nombres e intervalos
legacy y volvió a ejecutar `applyDwhSchema` sin cambios.

## DWH Idempotency

- Segunda aplicación de la cadena schema: no ejecuta batches ni inserta versión.
- Replay de dimensiones: no duplica A/B/C/D ni muta intervalos.
- Replay de carga completa: hechos y watermarks permanecen coherentes.
- Igual timestamp + igual rowversion + iguales atributos: `NOOP`.
- Atributos iguales con orden de fuente posterior: `REFRESH_SOURCE`, no nueva
  dimensión.

Resultado: PASS en tests unitarios y SQL Server real.

## DWH Real SQL Verification

Se usó SQL Server Express controlado en `localhost\SQLEXPRESS`, exclusivamente
con bases, logins y datos sintéticos locales.

`scripts/verify-dwh-b08.ps1` sobre el head final:

- OLTP fresh: 39 archivos aplicados, 0 errores;
- cadena DWH `dwh-08-002 -> dwh-08-003`: PASS;
- upgrade legacy: PASS;
- SCD2 intradía profesional/sucursal: PASS;
- replay/idempotencia: PASS;
- DWH real: 18/18 tests;
- cleanup de `nc_b08_oltp`, `nc_b08_dw` y login temporal: PASS.

`scripts/verify-deployment-b09-5a.ps1`:

- fresh OLTP `001`-`039`: PASS;
- segunda migración: 0 reaplicadas;
- backup con compresión: no soportado por Express, fallback portable esperado;
- backup sin compresión + restore: PASS;
- restore: cinco flags y dos tablas de schema verificadas;
- DWH real: 18/18;
- certificación SQL real: 5/5;
- bases, login, backup y ruta temporal eliminados al finalizar.

Esto es verificación SQL local real, no staging.

## GitHub Action Pin Audit

Se inspeccionaron todos los `uses:` externos de `.github/workflows/*.yml`. Cada
referencia mutable fue reemplazada por un SHA completo de 40 caracteres con el
tag verificado como comentario. Las acciones locales `./...` siguen permitidas.

### Action pin matrix

| ACTION                        | OLD REF | PINNED SHA                                 | VERSION COMMENT | VERIFIED SOURCE             | PASS |
| ----------------------------- | ------- | ------------------------------------------ | --------------- | --------------------------- | ---- |
| `actions/checkout`            | `@v4`   | `11d5960a326750d5838078e36cf38b85af677262` | `v4.4.0`        | Official repository tag/API | YES  |
| `gitleaks/gitleaks-action`    | `@v2`   | `e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e` | `v3.0.0`        | Official repository tag/API | YES  |
| `actions/setup-node`          | `@v4`   | `49933ea5288caeca8642d1e84afbd3f7d6820020` | `v4.4.0`        | Official repository tag/API | YES  |
| `pnpm/action-setup`           | `@v4`   | `b906affcce14559ad1aafd4ab0e942779e9f58b1` | `v4.3.0`        | Official repository tag/API | YES  |
| `actions/cache`               | `@v4`   | `0057852bfaa89a56745cba8c7296529d2fc39830` | `v4.3.0`        | Official repository tag/API | YES  |
| `actions/upload-artifact`     | `@v4`   | `ea165f8d65b6e75b540449e92b4886f43607fa02` | `v4.6.2`        | Official repository tag/API | YES  |
| `docker/setup-buildx-action`  | `@v3`   | `8d2750c68a42422c14e847fe6c8ac0403b4cbd6f` | `v3.12.0`       | Official repository tag/API | YES  |
| `actions/download-artifact`   | `@v4`   | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | `v4.3.0`        | Official repository tag/API | YES  |
| `Swatinem/rust-cache`         | `@v2`   | `6323deb102c322ba6fcbdcafc7e3dddab59af2b6` | `v2.9.2`        | Official repository tag/API | YES  |
| `softprops/action-gh-release` | `@v2`   | `efb35369e0ad2afab669f228072c1b0d510eae64` | `v3.0.3`        | Official repository tag/API | YES  |

## Action SHA Verification

Los SHAs se resolvieron contra tags/releases de los repositorios oficiales; no
se adivinó ningún valor. `action-pin-policy.test.mjs` recorre todos los
workflows y falla si una acción externa no tiene SHA hexadecimal completo o si
falta el comentario de versión.

`pnpm deployment:test`: 40/40 PASS, incluido el check de pins mutables. El
formato del test de pinning quedó verificado con Prettier. `actionlint` no está
instalado, por lo que no se declara ejecución de esa herramienta.

Dependabot quedó configurado para abrir PRs semanales de `github-actions`, con
labels de dependencias/supply-chain y sin auto-merge.

## Workflow Permissions

`ci.yml` y `release.yml` declaran `permissions: contents: read` a nivel de
workflow. CI no tiene permisos write. Solo el job final que publica una release
declara `contents: write`; depende de foundation, contrato Desktop y builds
previos. El test determinista exige exactamente una concesión write en release.

Resultado: PASS. Ningún workflow fue ejecutado en GitHub durante este Step.

## Single-Replica Enforcement

`API_REPLICAS` y `JOBS_REPLICAS` forman parte del contrato provider-neutral,
runtime config, Compose, CI y release manifest. El default seguro es `1`; cero,
fracciones, negativos o texto producen `INVALID_REPLICA_CONFIGURATION`.

STAGING/PRODUCTION rechazan cualquier valor mayor que uno con
`MULTI_REPLICA_NOT_CERTIFIED`. LOCAL/TEST puede simular procesos múltiples para
pruebas sin convertir esa simulación en certificación operacional.

### Single-replica matrix

| WORKLOAD          | CURRENT SAFE REPLICAS | WHY                                                                      | GATE                          | FUTURE BLOCKER                                  |
| ----------------- | --------------------: | ------------------------------------------------------------------------ | ----------------------------- | ----------------------------------------------- |
| API               |                     1 | Broadcast WebSocket, rate/state y stores seleccionados son process-local | Runtime + startup + predeploy | Coordinación/broadcast distribuido certificado  |
| Jobs runner       |                     1 | Coordina ETL y retención sin seguridad distribuida completa              | Runtime + startup + predeploy | Locks/leases renovables certificados            |
| ETL               |              1 runner | Lease atómico expira sin heartbeat                                       | Jobs replica gate             | Ownership token + renewal + abort on lease loss |
| Retention         |              1 runner | Scheduler sin distributed lock                                           | Jobs replica gate             | Lock SQL distribuido y probado                  |
| OLTP/DWH one-shot |         1 por rollout | Operaciones de schema deben ser exclusivas                               | Workload role/target guards   | Orquestación real de rollout                    |

## API Replica Gate

- Máximo certificado: 1.
- Configuración STAGING/PRODUCTION con `API_REPLICAS > 1`: rechazada.
- Startup issue estructurado: `MULTI_REPLICA_NOT_CERTIFIED`.
- Predeploy config provider-neutral: mismo código y máximo.
- Manifest: requested, certifiedMaximum y status visibles.

Resultado del gate: PASS. Multi-replica API readiness permanece BLOCKED.

## Jobs Replica Gate

- Máximo certificado: 1.
- Configuración STAGING/PRODUCTION con `JOBS_REPLICAS > 1`: rechazada.
- Compose local y workflows fijan `JOBS_REPLICAS=1`.
- El mismo gate cubre la falta de lease renewal ETL y distributed lock de
  retención.

Resultado del gate: PASS. Multi-runner jobs no está certificado.

## ETL Lease Decision

Se eligió la opción B permitida: no introducir en este Step un heartbeat o
sistema distribuido incompleto. El lease existente sigue siendo atómico y
recuperable por expiración, pero no se renueva durante trabajos largos.

La restricción operacional queda machine-checkable mediante un único jobs
runner y visible en manifest como
`BLOCKED_NO_LEASE_RENEWAL`. No se afirma distributed readiness.

## Retention Lock Decision

No se añadió un framework distribuido solo para retención. El scheduler sigue
sin distributed lock; por ello comparte el gate estricto `JOBS_REPLICAS=1` y el
manifest reporta `BLOCKED_NO_DISTRIBUTED_LOCK`.

La ejecución paralela de retención permanece prohibida hasta implementar y
probar un lock SQL ownership-safe en un Step futuro.

## AI Egress Manifest Semantics

`persistManifest()` continúa awaited antes de invocar el adapter, pero el store
absorbe fallos y registra warning saneado. Un fallo de persistencia no convierte
por sí solo una operación permitida en denegada. Se conservó exactamente la
política `FAIL_SOFT`; no se hizo un cambio de gobernanza silencioso.

La terminología de telemetría fue aclarada: una persistencia opcional es un
intento y no evidencia garantizada de escritura. Consentimiento, capability,
certificación y demás gates de egress siguen fail-closed por separado.

### AI audit semantics matrix

| EVENT/STORE                             | FAIL-SOFT/FAIL-CLOSED   | WHEN CALLED                            | ADAPTER BLOCKED?      | TEST |
| --------------------------------------- | ----------------------- | -------------------------------------- | --------------------- | ---- |
| Egress manifest save success            | FAIL_SOFT store policy  | Awaited before allowed provider        | NO                    | PASS |
| Egress manifest save failure            | FAIL_SOFT               | Awaited/caught before allowed provider | NO                    | PASS |
| Egress policy denial                    | FAIL_CLOSED policy gate | Before provider                        | YES                   | PASS |
| Ordinary `auditLog` persistence failure | FAIL_SOFT               | Request middleware                     | NO                    | PASS |
| `requiredAuditLog` persistence failure  | FAIL_CLOSED             | Sensitive request middleware           | YES, operation denied | PASS |
| Observability telemetry exporter        | FAIL_SOFT               | Business instrumentation               | NO                    | PASS |

## Required Audit Semantics

`requiredAuditLog` permanece separado de telemetría y del egress manifest. Si
no puede persistir una operación que exige auditoría, llama a `next` con 503
`Audit log unavailable` y nunca continúa al handler sin error.

La regresión también demuestra que se persisten templates de ruta, nombres de
parámetros y referencias seguras, no valores de token/query. Suite focal:
3/3 PASS.

## TURN / ICE Contract

El contrato compartido explícito es `OPTIONAL_DIRECT_ALLOWED`. No existía un
requisito relay-only, por lo que no se inventó `iceTransportPolicy: relay`.
Frontend y API exigen exactamente el enum server-controlled.

Un response válido `configured=false` puede contener STUN o una lista vacía y
usa `iceTransportPolicy: all`, permitiendo conectividad directa. Un response
`configured=true` exige al menos un TURN con username y credential válidos. El
frontend no acepta TURN presente cuando `configured=false`.

La falla HTTP, auth ausente, payload inválido o scheme no ICE bloquean la
preparación de la llamada antes de pedir ticket/crear WebSocket. Producción solo
emite credenciales TURN efímeras derivadas del shared secret server-side;
credenciales estáticas se limitan a SANDBOX.

### TURN matrix

| MODE                    | CONFIGURED            | ICE SERVERS                                     | DIRECT ICE    | EXPECTED                                         | TEST |
| ----------------------- | --------------------- | ----------------------------------------------- | ------------- | ------------------------------------------------ | ---- |
| OPTIONAL_DIRECT_ALLOWED | false                 | Empty                                           | YES           | Config `all`; llamada puede intentar directo     | PASS |
| OPTIONAL_DIRECT_ALLOWED | false                 | Valid STUN only                                 | YES           | Usa STUN, sin fingir TURN                        | PASS |
| OPTIONAL_DIRECT_ALLOWED | true                  | Credentialed TURN, optional STUN                | YES           | Usa lista server-approved con fallback permitido | PASS |
| OPTIONAL_DIRECT_ALLOWED | inconsistent          | TURN sin credenciales o configured false + TURN | N/A           | Payload rejected                                 | PASS |
| OPTIONAL_DIRECT_ALLOWED | endpoint failure      | N/A                                             | NO CALL START | Ticket y signaling bloqueados                    | PASS |
| OPTIONAL_DIRECT_ALLOWED | invalid scheme/policy | Unsafe/unknown                                  | NO CALL START | Response rejected                                | PASS |

Backend TURN: 12/12 PASS. Frontend WebRTC/TURN: 13/13 PASS.

## OCI Verification

Docker y Podman no están disponibles en este host. No se instaló un daemon ni
se afirmó un build OCI real. Por tanto:

- API OCI build: `BLOCKED_BY_ENVIRONMENT`;
- Web OCI build: `BLOCKED_BY_ENVIRONMENT`;
- Compose config/smoke real: `BLOCKED_BY_ENVIRONMENT`.

La cobertura local disponible sí pasó:

- `build:deploy`: PASS;
- API deployment artifact nativo: PASS con shutdown SIGTERM esperado;
- Web release build con `VITE_API_URL=/api`: PASS;
- Web artifact verifier: PASS, 156 archivos;
- Dockerfile/Compose/Nginx/release contract tests: PASS dentro de 40/40.

No existen digests OCI porque no se construyeron imágenes. Ninguno fue
fabricado para el manifest.

## SQL Verification

Además de las verificaciones DWH descritas arriba, se ejecutó telemedicina E2E
contra API y SQL Server reales:

- `e2e/telemedicina.spec.ts`: 3/3 PASS;
- login real, listado/creación de sala y transición de estado: PASS;
- base local persistente `nc_step021_e2e`: ONLINE;
- migraciones registradas: 39;
- administrador sintético: rol admin, activo, email verificado, hash Argon2id y
  una membresía de sucursal;
- login de aplicación validado por E2E.

La credencial del administrador fue entregada directamente al operador y no se
escribe en el repositorio ni en este reporte. La base se conserva por solicitud
del operador. El login SQL temporal usado para el runner fue eliminado y el API
local fue detenido después de la prueba.

Todas las operaciones destructivas se limitaron a bases/logins sintéticos y
desechables de los scripts. No se accedió a staging ni producción.

## Release Gate Regression

El manifest local ignorado fue regenerado después del último commit técnico:

- identidad provisional: `0.1.0-rc.2` solo para evidencia Step 02.1;
- commit: `3e0e8ffece174832efcb3afdda8242417c2d2686`;
- environment: `TEST / release-foundation-step-02-1`;
- Desktop primary / Web secondary;
- Tauri `2.11.2`, Dexie `33`, sync `2`, API `v1`, OLTP `039`, DWH
  `dwh-08-003`;
- API/jobs requested: `1/1`, ambos `CERTIFIED_SINGLE_REPLICA`;
- AI, Shadow y Patient AI: false;
- SHA-256 del JSON generado:
  `ddd265319b864e357b85fbd0b5950be7a097efd35f7a0c323cdb5a78d0301f01`.

Los campos externos permanecen honestamente:

- public API/Web: `UNCONFIGURED`;
- API/Web/Desktop artifact y digest: `UNSET`;
- commit-bound secret scan attestation: `UNVERIFIED`.

La verificación foundation recibió commit y versión esperados. Falló cerrado
únicamente por seis requisitos ausentes: API HTTPS, Web HTTPS, Desktop digest,
CI secret-scan evidence, API digest y Web digest. Esto prueba el gate; no es una
autorización de release.

`release-manifest.json` sigue ignorado. No se creó tag y un futuro RC deberá
regenerarlo para el SHA exacto del tag, con evidencia externa real.

## Desktop Status

`pnpm build:tauri` pasó en Windows x64 sobre el árbol de implementación Step
02.1. El commit posterior `3e0e8ff` solo normalizó whitespace de un test Node y
no cambia el runtime o bundle.

Artefactos locales generados:

- `nutriclinica.exe`;
- `NutriClinica_0.1.0_x64_en-US.msi`;
- `NutriClinica_0.1.0_x64-setup.exe`.

Los tres reportan Authenticode `NotSigned`, como se esperaba. El escaneo binario
focal ASCII/UTF-16 encontró 0 marcadores de secreto conocido, private key, PHI
sintético o API localhost.

El build utilizó un origen `.invalid` no resoluble solo como input de
compilación local; no está en el release manifest ni representa endpoint real.
Los instaladores no son publicables. Signing, updater, target CSP remoto y
publicación permanecen bloqueados. macOS/Linux no fueron compilados en este
host Windows.

`cargo check --locked` y `cargo test --locked` pasaron con Rust/Cargo 1.96.0.
Permanece el warning histórico de la función `ping` no usada y 0 tests Rust.

## Patient AI Status

Patient AI permanece `DISABLED`. El manifest reporta `patientAiAllowed=false`.
No se cambió consentimiento, egress, routes, feature flags ni thresholds para
habilitarlo. Ningún test realizó una llamada clínica externa real.

## Clinical AI Status

- Current eligible clinical model: `NONE`.
- Professional clinical sample: 0.
- Professional clinical validation: `NOT_DONE`.
- Professional Shadow: BLOCKED.
- Clinical production: `NOT_READY`.
- `LOCAL_AUTO`: continúa absteniendo cuando no existe modelo elegible.

Las pruebas de semántica de egress/audit no aprobaron modelos ni redujeron
gates clínicos.

## Focused Tests

| FOCUSED AREA                              |  RESULT | EVIDENCE                                               |
| ----------------------------------------- | ------: | ------------------------------------------------------ |
| `useRealtimeChat` generation/cancellation |   10/10 | A-J, cross-patient marker 0                            |
| Frontend WebRTC/TURN                      |   13/13 | Optional direct, failure, validation, negotiation      |
| API Step 02.1 changed suites              | 131/131 | 12 files: deployment, DWH, AI/audit, TURN              |
| DWH SCD2 helper                           |     6/6 | Professional/branch, tie-break, replay, legacy, reject |
| DWH schema chain                          |     8/8 | Immutable base, additive/idempotent upgrade, drift     |
| TURN backend                              |   12/12 | Side-effect modes, schemes, ephemeral credentials      |
| Egress boundary                           |     7/7 | Includes manifest fail-soft ordering                   |
| Required/ordinary audit                   |     3/3 | Required fail-closed, ordinary fail-soft               |
| Deployment contracts                      |   40/40 | Pins, permissions, replicas, release fail-closed       |
| DWH SQL real                              |   18/18 | Upgrade, intraday SCD2, replay/reconciliation          |
| Certification SQL real                    |     5/5 | Persistence on restored OLTP target                    |
| Telemedicine API + SQL E2E                |     3/3 | Authenticated real API/SQL flow                        |

La salida stderr del test de sanitizer es una inyección deliberada de error y
el suite terminó PASS.

## Full Regression

| GATE                             | RESULT                 | DETAIL                                                                        |
| -------------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | PASS                   | Lockfile sin cambio                                                           |
| `pnpm lint`                      | PASS                   | 0 errores, 6 warnings históricos                                              |
| Frontend typecheck               | PASS                   | `pnpm typecheck`                                                              |
| API typecheck                    | PASS                   | `pnpm --filter @nutriclinica/api typecheck`                                   |
| Frontend tests                   | PASS                   | 2,019 passed, 1 skipped; 151 files passed + 1 skipped                         |
| API tests                        | PASS                   | 1,281 passed, 55 skipped; 157 files passed + 5 skipped                        |
| Root/Web build                   | PASS                   | 4,147 modules                                                                 |
| API build                        | PASS                   | TypeScript output                                                             |
| API deploy build                 | PASS                   | Six workload entrypoints + SQL assets                                         |
| API artifact test                | PASS                   | Startup/workloads/shutdown fail-closed                                        |
| Web artifact                     | PASS                   | 156 files, no source maps/local API/secrets                                   |
| Portable E2E                     | PASS                   | 60/60                                                                         |
| Telemedicine real E2E            | PASS                   | 3/3                                                                           |
| Deployment contracts             | PASS                   | 40/40                                                                         |
| DWH real SQL                     | PASS                   | 18/18 after fresh 39/39                                                       |
| Deployment SQL rehearsal         | PASS                   | Idempotency + backup/restore + DWH + 5/5 certification                        |
| `cargo check --locked`           | PASS                   | Rust 1.96.0                                                                   |
| `cargo test --locked`            | PASS                   | 0 Rust tests; one historical warning                                          |
| Windows Tauri build              | PASS                   | EXE + MSI + NSIS, unsigned                                                    |
| `git diff --check`               | PASS                   | No whitespace errors                                                          |
| Frozen OLTP/DWH diff             | PASS                   | Migrations 001-039 + `dwh-schema.sql` intact                                  |
| Tracked focused secret scan      | PASS                   | 0 confirmed findings                                                          |
| Global `format:check`            | BASELINE BLOCKED       | About 1,004 repository files                                                  |
| Changed-file Prettier check      | PARTIAL                | 19 touched legacy files retain full-file style debt; new supported files PASS |
| `cargo fmt --check`              | BLOCKED_BY_ENVIRONMENT | rustfmt component unavailable                                                 |
| `actionlint`                     | BLOCKED_BY_ENVIRONMENT | executable unavailable; deterministic parser test PASS                        |

Los 55 skips del API en modo default no se convirtieron en mocks. Las suites
DWH y certificación requeridas por este Step se ejecutaron además contra SQL
Server real mediante los scripts controlados.

## Secret Scan

- Tracked confirmed secret/private-key pattern scan: 0.
- Nuevos pins/comentarios Actions: sin tokens.
- Web artifact verifier: sin marcadores de secretos, PHI sintético, source maps
  ni API localhost.
- EXE/MSI/NSIS raw ASCII/UTF-16 focal scan: 0 marcadores.
- Fixtures realtime: solo marcadores sintéticos A/B.
- Administrador E2E: la contraseña no está en archivos trackeados ni en este
  reporte.
- `.env` locales no se leyeron ni se stagearon.
- `gitleaks` no está instalado; no se fabrica la attestation CI equivalente.
- Release manifest conserva `securityEvidence=UNVERIFIED`.

## Files Created

Archivos nuevos en los commits técnicos Step 02.1:

```text
.github/dependabot.yml
apps/api/src/modules/deployment/replicaSafety.ts
apps/api/src/modules/dwh/etl/scd2.test.ts
apps/api/src/modules/dwh/etl/scd2.ts
apps/api/src/modules/dwh/schema/dwh-upgrade-08-003.sql
deployment/scripts/action-pin-policy.test.mjs
src/hooks/useRealtimeChat.test.ts
```

Archivo nuevo de cierre documental:

```text
docs/operations/release-foundation-step-02-1.md
```

`release-manifest.json` es output generado e ignorado, no un archivo fuente
creado para commit.

## Files Modified

```text
.github/workflows/ci.yml
.github/workflows/release.yml
apps/api/.env.example
apps/api/src/middleware/auditMiddleware.test.ts
apps/api/src/modules/ai/aiGateway.egress.test.ts
apps/api/src/modules/ai/aiOrchestrator.test.ts
apps/api/src/modules/deployment/deployment.test.ts
apps/api/src/modules/deployment/deploymentManifest.ts
apps/api/src/modules/deployment/deploymentRoutes.test.ts
apps/api/src/modules/deployment/runtimeConfig.test.ts
apps/api/src/modules/deployment/runtimeConfig.ts
apps/api/src/modules/deployment/startupValidation.test.ts
apps/api/src/modules/deployment/startupValidation.ts
apps/api/src/modules/dwh/etl.realSql.test.ts
apps/api/src/modules/dwh/etl/engine.test.ts
apps/api/src/modules/dwh/etl/engine.ts
apps/api/src/modules/dwh/etl/types.ts
apps/api/src/modules/dwh/schema/dwhSchema.test.ts
apps/api/src/modules/dwh/schema/dwhSchema.ts
apps/api/src/modules/observability/telemetryService.ts
apps/api/src/modules/telemedicina/telemedicinaRoutes.test.ts
apps/api/src/modules/telemedicina/turnConfig.test.ts
apps/api/src/modules/telemedicina/turnConfig.ts
apps/api/src/scripts/buildDeploymentArtifacts.ts
deployment/compose/compose.yaml
deployment/config/deployment-inputs.example
deployment/scripts/test-api-artifact.mjs
deployment/scripts/validate-config.mjs
deployment/scripts/validate-config.test.mjs
deployment/scripts/verify-release-manifest.mjs
deployment/scripts/verify-release-manifest.test.mjs
docs/decisions/0014-sql-lifecycle-and-jobs-runner.md
docs/operations/deployment-architecture.md
docs/operations/infrastructure-target-requirements.md
docs/operations/real-staging-requirements.md
docs/operations/runtime-configuration-matrix.md
e2e/telemedicina.spec.ts
packages/shared/src/index.ts
scripts/verify-deployment-b09-5a.ps1
scripts/verify-dwh-b08.ps1
src/app/pages/patient-portal/PatientPortalPage.tsx
src/app/pages/patients/PatientMessagingCard.tsx
src/hooks/useRealtimeChat.ts
src/modules/telemedicina/VideoCallRoom.tsx
src/modules/telemedicina/useWebRTC.test.ts
src/modules/telemedicina/useWebRTC.ts
```

No se modificaron migraciones OLTP `001`-`039` ni el DWH congelado
`dwh-schema.sql`.

## Commits Created

- `976c68a40a03c0aebf91aa7a1b873355c3f35991` - implementación funcional,
  hardening, pruebas y documentación de arquitectura Step 02.1.
- `3e0e8ffece174832efcb3afdda8242417c2d2686` - normalización Prettier mínima
  del test de pinning; head técnico usado por el manifest final.
- Cierre documental - este reporte, commiteado después del SHA técnico para
  evitar una referencia autorreferencial.

No se realizó push, merge, tag ni release.

## Known Issues

- Docker/Podman no disponibles: OCI y Compose real no ejecutados.
- `actionlint` y `gitleaks` no disponibles localmente.
- `rustfmt` no está instalado para `stable-x86_64-pc-windows-msvc`; no hubo
  cambios Rust y check/test/build sí pasaron.
- `pnpm format:check` global sigue bloqueado por deuda histórica de cerca de
  1,004 archivos. El check de los archivos Step 02.1 reporta 19 archivos
  legacy con estilo de archivo completo pendiente; no se aplicó un reformat
  masivo no relacionado.
- Tauri mantiene el warning histórico por identifier terminado en `.app` y la
  función Rust `ping` sin uso.
- Windows fue el único target Desktop ejecutado en este host.
- El Desktop local está unsigned, sin updater y sin CSP/origen remoto final.
- SCD2 no reconstruye revisiones OLTP que ocurran y sean sobrescritas entre
  cargas ETL; no se afirma soporte de event sourcing arbitrario.
- ETL sigue sin lease renewal y retención sin distributed lock.
- La base sintética `nc_step021_e2e` y su administrador permanecen localmente
  por solicitud del operador; el API y login SQL runner están detenidos/removidos.

## External Blockers

- Real staging: no provisionado y no tocado.
- Proveedor/target real: no seleccionado ni autorizado.
- DNS y HTTPS/WSS: no configurados.
- Registry y digests OCI: no disponibles.
- SecretProvider: no seleccionado.
- Commit-bound gitleaks/CI attestation: no disponible.
- Desktop signing y updater: no configurados.
- API/Web/Desktop publication artifacts: no ligados en un manifest desplegable.
- Multi-replica coordination: no implementada/certificada.
- Professional clinical model eligibility: NONE.
- Professional clinical validation: NOT_DONE.
- Clinical production: NOT_READY.

## Definition of Done

- [x] `useRealtimeChat` tiene invalidación generacional.
- [x] Fetches abortan al cambiar identidad o desmontar.
- [x] Resolución stale de `getWsConnection` no instala socket.
- [x] Eventos stale de socket no alteran el nuevo paciente.
- [x] Polling stale no altera el nuevo paciente.
- [x] Regresión cross-patient PASS con 0 fugas.
- [x] Diez pruebas dedicadas de `useRealtimeChat`.
- [x] `dwh-08-002` y migraciones `001`-`039` intactos.
- [x] Nuevo schema exacto `dwh-08-003`.
- [x] Cambios SCD2 intradía sin colisión.
- [x] Intervalos y source ordering determinísticos.
- [x] Profesional con múltiples versiones same-day PASS.
- [x] Sucursal con múltiples versiones same-day PASS.
- [x] DWH idempotency/replay PASS.
- [x] Upgrade conserva historia legacy.
- [x] DWH y OLTP SQL real PASS.
- [x] Todas las Actions externas pinneadas a SHA verificado.
- [x] Check de refs mutables PASS.
- [x] Workflow permissions PASS.
- [x] API replicas >1 rechazadas en entornos sensibles.
- [x] Jobs replicas >1 rechazadas en entornos sensibles.
- [x] Límite ETL reportado/enforced sin fingir lease renewal.
- [x] Límite retention reportado/enforced sin fingir distributed lock.
- [x] No se añadió Redis, Kafka ni arquitectura distribuida innecesaria.
- [x] Egress manifest `FAIL_SOFT` probado exactamente.
- [x] Required audit `FAIL_CLOSED` preservado y probado.
- [x] Sin cambio silencioso de política AI.
- [x] TURN `OPTIONAL_DIRECT_ALLOWED` explícito y probado.
- [x] Sin requisito relay-only inventado.
- [x] Release gate continúa fail-closed.
- [x] No existe tag `v0.1.0-rc.2`.
- [x] 0 digests OCI fabricados.
- [x] 0 endpoints fabricados en release evidence.
- [x] 0 attestations CI fabricadas.
- [x] Patient AI sigue disabled.
- [x] Model eligibility sigue NONE.
- [x] Professional sample sigue 0.
- [x] Regresiones completas disponibles PASS.
- [x] Tracked confirmed secrets: 0.
- [x] Production untouched.
- [x] Worktree limpio tras el commit documental.

## Gate Status

Step 02.1 cierra los riesgos residuales de corrección de software y supply
chain que podían resolverse antes de staging. Las verificaciones internas,
Windows Tauri y SQL real local pasaron. Los gates de publicación siguen
fallando cerrado por evidencia externa ausente, como exige el contrato.

Clasificación: PASS para RELEASE FOUNDATION STEP 02.1. Esto no equivale a
release readiness ni production readiness.

Siguiente paso recomendado, no ejecutado: RELEASE FOUNDATION STEP 03 -
INFRASTRUCTURE TARGET SELECTION + REAL STAGING PROVISIONING. No proceder todavía
a Professional Shadow.

RELEASE FOUNDATION STEP 02.1:
PASS

REALTIME GENERATION INVALIDATION:
PASS

FETCH ABORT:
PASS

STALE WS INSTALLATION:
BLOCKED

STALE WS EVENT STATE UPDATE:
BLOCKED

STALE POLLING STATE UPDATE:
BLOCKED

CROSS_PATIENT_REALTIME_LEAK TEST:
0

useRealtimeChat FOCUSED TESTS:
10/10

PREVIOUS DWH VERSION:
dwh-08-002

PREVIOUS DWH DDL MODIFIED:
NO

NEW DWH VERSION:
dwh-08-003

SCD2 SAME_DAY PROFESSIONAL:
PASS

SCD2 SAME_DAY SUCURSAL:
PASS

SCD2 IDEMPOTENCY:
PASS

DWH UPGRADE PRESERVES HISTORY:
PASS

DWH REAL SQL:
PASS

EXTERNAL GITHUB ACTIONS PINNED TO SHA:
YES

MUTABLE ACTION REF CHECK:
PASS

WORKFLOW PERMISSIONS:
PASS

API MAX SAFE REPLICAS:
1

JOBS MAX SAFE REPLICAS:
1

MULTI_REPLICA_API_READINESS:
BLOCKED

API REPLICA PREDEPLOY GATE:
PASS

JOBS REPLICA PREDEPLOY GATE:
PASS

ETL DISTRIBUTED READINESS:
BLOCKED_NO_LEASE_RENEWAL

RETENTION DISTRIBUTED READINESS:
BLOCKED_NO_DISTRIBUTED_LOCK

EGRESS MANIFEST:
FAIL_SOFT

EGRESS MANIFEST SEMANTICS TEST:
PASS

REQUIRED AUDIT LOG:
FAIL_CLOSED

REQUIRED AUDIT TEST:
PASS

TURN POLICY:
OPTIONAL_DIRECT_ALLOWED

TURN SEMANTICS:
PASS

REAL OCI BUILD:
BLOCKED_BY_ENVIRONMENT

COMPOSE REAL SMOKE:
BLOCKED_BY_ENVIRONMENT

REAL SQL OLTP:
PASS

REAL STAGING:
BLOCKED

v0.1.0-rc.2 TAG CREATED:
NO

FAKE OCI DIGEST:
0

FAKE ENDPOINT:
0

PATIENT AI:
DISABLED

CURRENT ELIGIBLE CLINICAL MODEL:
NONE

PROFESSIONAL CLINICAL SAMPLE:
0

PROFESSIONAL CLINICAL VALIDATION:
NOT_DONE

CLINICAL PRODUCTION:
NOT_READY

FRONTEND TESTS:
2019/2020 (1 skipped)

API TESTS:
1281/1336 (55 skipped)

PORTABLE E2E:
60/60

DEPLOYMENT CONTRACTS:
40/40

LINT:
PASS

TYPECHECK:
PASS

BUILD:
PASS

TAURI CHECK:
PASS

TRACKED CONFIRMED SECRETS:
0

PRODUCTION TOUCHED:
NO

WORKTREE CLEAN:
YES
