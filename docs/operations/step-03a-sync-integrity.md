# NUTRICLINICA - STEP 03A SYNC DATA INTEGRITY REPORT

Fecha de cierre local: 2026-09-17. Modo: BUILD / DATA INTEGRITY. Rama:
`infra/release-foundation-step-03`. Baseline recibido:
`6d387ae123f52964242464d030d34e54de1560dd`.

## Executive Result

La integridad local de sync para las seis entidades queda en PASS. La auditoria
no encontro una brecha de implementacion que requiriera cambiar el runtime; se
agrego una regresion explicita para demostrar persistencia del outbox durante
ocho dias offline, cierre/reapertura de Dexie y convergencia posterior.

```text
STEP 03A LOCAL SYNC DATA INTEGRITY: PASS
FIELD MAPPINGS: 3/3
REAL SQL SYNC: PASS_LOCAL_DISPOSABLE
REAL STAGING: BLOCKED_BY_INFRASTRUCTURE
PRODUCTION TOUCHED: NO
```

Este PASS es local y acotado a Step 03A. No cambia el resultado `CONDITIONAL`
de Step 03, no constituye una attestation de CI remoto y no autoriza Step 04,
staging, release ni produccion.

## Scope And Baseline

- Worktree inicial: limpio.
- Entidades exactas: `pacientes`, `consultas`, `antropometrias`, `lab_panels`,
  `planes_alimenticios`, `adherence_records`.
- Cliente offline: Dexie con outbox durable en `sync_queue`.
- Servidor autoritativo: API compartida y SQL Server.
- Protocolo: `API_VERSION=v1`, `SYNC_SCHEMA_VERSION=2`, contrato
  `durable-outbox-v1`.
- OLTP local: migraciones `001` a `039` en una base desechable aleatoria.
- Datos usados: exclusivamente sinteticos.
- Fuera de alcance: staging real, CI remoto, OCI remoto, DNS/TLS/WSS,
  SecretProvider, tag, push, GitHub Release y produccion.

## Invariant Matrix

| ID  | INVARIANT                                                                                 | RESULT | EVIDENCE                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | El contrato contiene exactamente las seis entidades soportadas en cliente, manifest y API | PASS   | `SYNC_TABLES`, manifest tests y loop de seis entidades en `syncIntegrity.realSql.test.ts`                                                                 |
| 2   | Una mutacion local y su operacion de outbox hacen commit o rollback juntas                | PASS   | `installAtomicOutbox` amplia la misma transaccion DBCore; abortos y fallos de outbox cubiertos por `atomicOutbox.test.ts`                                 |
| 3   | Aplicar datos remotos no reencola cambios ni puede suprimir una edicion concurrente ajena | PASS   | Supresion ligada a la transaccion mediante `markRemoteTransaction`; pull tombstone sin reenqueue cubierto para las seis entidades                         |
| 4   | El outbox sobrevive cierre, reapertura y varios dias offline, y luego converge            | PASS   | Regresion nueva en `syncIntegrity.test.ts`: seis operaciones con timestamps de ocho dias, reopen, un push, cola vacia y `row_version` final               |
| 5   | Coalescing y lineage conservan payload actual, base `expectedRowVersion` y sucesores      | PASS   | `atomicOutbox.test.ts`, `syncQueueRepository.test.ts` y escenarios predecessor/successor de `syncIntegrity.test.ts`                                       |
| 6   | Un ACK de revision N no consume una edicion N+1 creada durante el push                    | PASS   | Caso in-flight por cada entidad en `syncIntegrity.test.ts`; N+1 permanece pendiente y usa la version ACK como nueva base                                  |
| 7   | Creates, restores y tombstones respetan dependencias padre-hijo                           | PASS   | Orden paciente-consulta-plan y delete inverso en cliente; padres activos, restores y FK ownership en SQL real                                             |
| 8   | Recuperacion y retries son acotados y observables                                         | PASS   | `syncing` stale vuelve a `pending`; red/5xx reintenta, 4xx no; `MAX_AUTO_RETRIES=8` deja error estable sin borrar evidencia                               |
| 9   | Cada UUID de operacion tiene semantica exactly-once y receipts bijectivos                 | PASS   | Replay devuelve el ACK original; payload distinto da `OPERATION_ID_REUSED`; replay concurrente produce un receipt; cardinalidad invalida no reconoce cola |
| 10  | Updates y deletes aplican concurrencia optimista con `ROWVERSION` canonico                | PASS   | Version ausente/invalida falla cerrada; base stale produce conflicto explicito; writers SQL concurrentes producen un apply y un conflict                  |
| 11  | Pull es atomico, paginado y no adelanta cursores sobre commits tardios                    | PASS   | Transaccion Dexie por lote, cursor por entidad, fence SQL de `ROWVERSION`, replay ante cursor fuera del horizonte                                         |
| 12  | Conflictos y tombstones conservan evidencia y no resucitan datos implicitamente           | PASS   | Payload/version/delete remoto persisten hasta resolucion; delete ACK exige version; pull de tombstone converge en las seis entidades                      |
| 13  | Dexie, wire y SQL preservan los campos canonicos y convergen create/update/delete         | PASS   | Mapping tests, column-map tests y roundtrip real Dexie representation -> push -> SQL -> pull -> representation para seis entidades                        |

Resultado: `13/13 PASS_LOCAL`.

## Field Mappings

Se verificaron las tres transformaciones de frontera que cambian representacion:

| MAPPING             | DEXIE                                    | WIRE / API             | SQL / PULL                               | RESULT |
| ------------------- | ---------------------------------------- | ---------------------- | ---------------------------------------- | ------ |
| Consulta vitals     | `vitals_json` string                     | `vitals` object        | JSON SQL y retorno canonico              | PASS   |
| Plan identity/meals | `consultation_id`, `meals_json`          | `consulta_id`, `meals` | FK + JSON y retorno sin alias competidor | PASS   |
| Adherence dates     | fecha `YYYY-MM-DD`, timestamps numericos | fechas ISO             | tipos SQL y normalizacion local          | PASS   |

JSON clinico corrupto y aliases competidores fallan cerrados; antropometrias y
laboratorios conservan payloads estructurados. Los tests SQL reales usan los
mismos `toApiPayload` y `toLocalPayload` exportados por `@nutriclinica/shared`,
sin un mapper alternativo para pruebas.

`FIELD MAPPINGS: 3/3`.

## Real SQL Gate

Se ejecuto `scripts/verify-sync-integrity.ps1`. El script:

- exige `localhost\SQLEXPRESS` y tooling SQL local;
- crea una base `nc_step03a_sync_<random>` y un login aleatorio;
- fija `ENVIRONMENT_CLASS=TEST` y `SYNC_REAL_SQL_TEST=1`;
- aplica las 39 migraciones sobre una base fresca;
- repite las 39 migraciones para probar idempotencia;
- ejecuta los 15 tests de `syncIntegrity.realSql.test.ts`;
- elimina base y login en `finally` y restaura el entorno anterior.

Resultado observado:

| SQL GATE                      | RESULT     |
| ----------------------------- | ---------- |
| Fresh migrations              | 39/39 PASS |
| Idempotent second run         | 39/39 PASS |
| Six-entity real SQL integrity | 15/15 PASS |
| Disposable cleanup            | PASS       |

No se cargo configuracion de produccion, no se toco la base local de desarrollo
y no hubo conexion a SQL de staging.

## Verification Evidence

| GATE                             | RESULT     | EVIDENCE                                                                |
| -------------------------------- | ---------- | ----------------------------------------------------------------------- |
| Added offline/restart regression | PASS       | `syncIntegrity.test.ts`: 26/26                                          |
| Focused client sync suites       | PASS       | 9 archivos; 162 tests                                                   |
| Focused API sync suites          | PASS       | 114/114                                                                 |
| Frontend full tests              | PASS       | 2137 passed, 1 skipped                                                  |
| API full tests                   | PASS       | 158 archivos passed, 6 skipped; 1313 passed, 70 conditional SQL skipped |
| Frontend typecheck               | PASS       | `pnpm typecheck`                                                        |
| API typecheck                    | PASS       | `pnpm --filter @nutriclinica/api typecheck`                             |
| Lint                             | PASS       | 0 errores; 6 warnings conocidos no relacionados con sync                |
| Frontend build                   | PASS       | `CI=true`, `VITE_API_URL=/api`, `pnpm build`                            |
| API build                        | PASS       | `pnpm --filter @nutriclinica/api build`                                 |
| Deployment contracts             | PASS       | `pnpm deployment:test`: 40/40                                           |
| API deployment artifact          | PASS       | build deploy + verifier local                                           |
| Web deployment artifact          | PASS       | 156 archivos; endpoint embebido `/api`                                  |
| Portable UI E2E                  | PASS       | repeticion completa: 60/60                                              |
| Tracked secret scan              | PASS_LOCAL | patron del workflow CI: 0 hallazgos                                     |
| Real local SQL                   | PASS       | 39/39 + 39/39 idempotente + 15/15                                       |
| Patch whitespace                 | PASS       | `git diff --check` exit 0                                               |

La primera corrida final de E2E quedo `59/60` porque el primer caso permanecio
en el fallback `Cargando...`; el caso aislado paso `1/1` y una repeticion
completa limpia paso `60/60` sin modificar producto ni test. Una ejecucion API
concurrente anterior tuvo dos timeouts de `releaseGate`; la ejecucion API
aislada final paso completa en 50.71 s.

El primer verificador web detecto correctamente `http://localhost:3000` tomado
del `.env` local. Se reconstruyo con el contrato de release
`VITE_API_URL=/api`; el verificador final paso. El `.env` local no se usa como
evidencia de deployment.

## Changes

- `src/services/sync/syncIntegrity.test.ts`: una prueba de persistencia
  multi-dia, restart y convergencia para las seis entidades.
- `docs/operations/step-03a-sync-integrity.md`: este reporte.
- Runtime de sync, API, migraciones y schema SQL: sin cambios.

## Limitations

- El secret scan local reproduce el patron de archivos trackeados del workflow,
  pero no sustituye gitleaks remoto ni una attestation ligada al commit.
- Los 70 skips de la suite API son suites SQL condicionales; la suite especifica
  de integridad se ejecuto separadamente contra SQL Server local real.
- Portable E2E usa login/fixtures offline y no demuestra Desktop/Web contra
  HTTPS API, WSS o SQL de staging.
- Local SQL Express no es staging y no se presenta como tal.
- No existen target autorizado, endpoints remotos, OCI digests, SecretProvider
  ni evidencia operativa para levantar el bloqueo de Step 03.

## Stop Conditions Preserved

- No push, tag, GitHub Release ni workflow remoto.
- No provisionamiento, compra, DNS, TLS, firewall o registry.
- No acceso o mutacion de staging/produccion.
- No credenciales ni datos clinicos reales en codigo, reporte o output.
- `REAL STAGING = BLOCKED_BY_INFRASTRUCTURE` permanece vigente.

## Final Gate

```text
STEP 03A SYNC DATA INTEGRITY:
PASS_LOCAL

INVARIANTS:
13/13

FIELD MAPPINGS:
3/3

SIX-ENTITY REAL SQL:
15/15 LOCAL_DISPOSABLE

REAL STAGING:
BLOCKED_BY_INFRASTRUCTURE

PRODUCTION TOUCHED:
NO

PUBLIC RELEASE:
NOT_CREATED
```
