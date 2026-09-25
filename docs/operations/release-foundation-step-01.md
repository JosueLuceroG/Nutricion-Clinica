# NUTRICLÍNICA — RELEASE FOUNDATION STEP 01 REPORT

Fecha: 2026-08-26. Modo: BUILD / RELEASE ENGINEERING. No deployment.

## Git / Branch Topology

Estado inicial probado antes de modificar:

- branch `hardening/remediation-09-5a`;
- HEAD `aaced2f`;
- worktree CLEAN;
- `git log --oneline --decorate --graph --all -100` inspeccionado;
- `main` es ancestro del head de hardening;
- Builds 01-09.5A-S1 forman una secuencia lineal, sin merges duplicados.

Se creo `release/v0.1.0-rc1` directamente desde `aaced2f`. No se hizo
history rewrite, force push, push ni merge ciego.

## Build Inclusion Matrix

Prueba: `git merge-base --is-ancestor <key-commit> aaced2f` devolvio exit 0
para todos los heads listados.

| BUILD | BRANCH | KEY COMMIT(S) | IN CANONICAL HEAD | STATUS |
|---|---|---|---|---|
| 01 | `hardening/remediation-01` | `c3c557c`, `e34ffd2`, `4d66fe3`, `a69dc1a` | YES | INCLUDED |
| 02 | `hardening/remediation-02` | `75217e0`, `8163aca`, `e5a22d2` | YES | INCLUDED |
| 03 | `hardening/remediation-03` | `b5721f1`, `79ba535`, `bd9bc19` | YES | INCLUDED |
| 04 | `hardening/remediation-04` | `d0fcc81`, `ef0a3d6`, `4962bb6`, `4a8204b` | YES | INCLUDED |
| 05 | `hardening/remediation-05` | `8e00b6e`..`b4a36f5` | YES | INCLUDED |
| 06 | `hardening/remediation-06` | `3d3ebc0`..`45e8f7d` | YES | INCLUDED |
| 06.1 | `hardening/remediation-06-1` | `c588994`..`48cec66` | YES | INCLUDED |
| 07 | `hardening/remediation-07` | `50fcc00`..`f51af83` | YES | INCLUDED |
| 07.5 | `hardening/remediation-07-5` | `75dabab`, `3ae7b3e`, `381bd9c`, `2650848` | YES | INCLUDED |
| 07.5A | `hardening/remediation-07-5a` | `c3ca123`, `3927a1a` | YES | INCLUDED |
| 08 | `hardening/remediation-08` | `94a0101` | YES | INCLUDED |
| 09 | `hardening/remediation-09` | `ce570ed` | YES | INCLUDED |
| 09.5A | `hardening/remediation-09-5a` | `56bbe4e` | YES | INCLUDED |
| 09.5A-S1 | `hardening/remediation-09-5a` | `aaced2f` | YES | INCLUDED |

No hay Build MISSING. Los anteriores no se marcan SUPERSEDED porque sus
contratos/migraciones siguen presentes y evolucionados en el mismo ancestry.

## Canonical Commit

`d0565e8dee075bb9fd64ae266f329f60e5d2d078` es el commit canonico
desplegable. Contiene codigo, locks y contratos. El tag local
`v0.1.0-rc.1` apunta exactamente a ese commit.

Este reporte se commitea despues para poder registrar el hash sin crear una
referencia Git autorreferencial; su commit no cambia el artefacto canonico.

## Canonical Release Branch

`release/v0.1.0-rc1`. Rama local; no push.

## Version Sources

| COMPONENTE | FUENTE | VERSION | AUTORITATIVA | STATUS |
|---|---|---|---|---|
| Release | tag `v0.1.0-rc.1` + `RELEASE_VERSION` | `0.1.0-rc.1` | YES | DEFINED |
| Desktop | `src-tauri/tauri.conf.json` | `0.1.0` | YES | DEFINED |
| Rust crate | `src-tauri/Cargo.toml` | `0.1.0` | consistency source | ALIGNED |
| Web | root `package.json` | `0.1.0` | YES | DEFINED |
| API | `apps/api/package.json` | `0.1.0` | YES | DEFINED |
| Shared | `packages/shared/package.json` | `0.1.0` | YES | DEFINED |
| API contract | shared `API_VERSION` | `v1` | YES | ENFORCED_ON_SYNC |
| Sync | shared `SYNC_SCHEMA_VERSION` | `2` | YES | ENFORCED |
| Dexie | shared `DEXIE_SCHEMA_VERSION` | `33` | YES | ENFORCED |
| Docker label | `Dockerfile` | `0.1.0` | NO | ALIGNED |

Se corrigio el manifest: frontend desde package raiz real (no
`web/package.json` inexistente) y API desde su package real (no literal).

## Desktop-First Architecture

PRIMARY = `DESKTOP_TAURI`. SECONDARY = `WEB`. Ambos consumen el mismo API.
Dexie/offline-first no se altero. SQL Server sigue siendo fuente autoritativa
para las seis entidades syncables; Dexie es cache transaccional + stores
local-first para modulos fuera del contrato de sync.

## Desktop Build

PASS en host Windows x64:

- `cargo check --locked` PASS;
- `pnpm build:tauri` PASS;
- Rust release optimized PASS;
- `nutriclinica.exe` PASS;
- `NutriClinica_0.1.0_x64_en-US.msi` PASS;
- `NutriClinica_0.1.0_x64-setup.exe` PASS.

Warning conocido: funcion Rust `ping` no usada. No afecta build. Tauri
advierte que identifier termina en `.app`; riesgo macOS documentado.

## Desktop Target Platforms

El workflow declara Windows, macOS y Linux. Esta maquina solo probo Windows
x64. macOS/Linux = BLOCKED_BY_HOST_OS para esta ejecucion. No se finge PASS.

## Tauri Configuration

- Tauri exacto `2.11.2`; JS API `2.11.0`; CLI `2.11.2`.
- Product `NutriClinica`; identifier `com.nutriclinica.app`.
- Bundle targets `all`; icons Win/macOS + assets mobile presentes.
- Plugins: log, fs, notification.
- Capabilities: core/window/webview/event/app/resources/menu/tray, log,
  notification.
- Commands Rust: health, app version, CSV a Downloads.
- API config: `VITE_API_URL` publico de build; production fail-closed.
- Storage: Dexie DB `nutriclinica`; ruta fisica administrada por WebView;
  Rust DbState es placeholder.

## Desktop Signing Status

WINDOWS_SIGNING = NOT_CONFIGURED. MACOS_SIGNING = NOT_CONFIGURED. No se
generaron certificados falsos ni secretos de signing.

## Desktop Update Status

NOT_IMPLEMENTED: sin updater plugin, update manifest o firma. Requisitos
futuros (firma, manifest HTTPS, staged rollout, mandatory upgrade,
compatibilidad Dexie/sync/API y rollback) estan documentados.

## Web Build

PASS con `CI=true` y `VITE_API_URL=https://api.release.invalid`. `.invalid`
no resuelve y solo demuestra configuracion. Source maps = 0. URL API
localhost embebida = 0. Existe una literal `127.0.0.1` solo para permitir
service worker en safe-context local; no es endpoint API.

## Web Deployment Status

WEB_HOSTING = NOT_CONFIGURED. Build capability no equivale a deployment.

## API Build

PASS: `pnpm --filter @nutriclinica/api build`; entrypoint
`apps/api/dist/server.js`; config server-side por entorno; sin supuesto de
frontend.

## API Contract

`API_VERSION = v1`. `/sync/manifest` publica `apiContractVersion: v1`.
El cliente valida antes de pull/push. Mismatch lanza
`ApiContractMismatchError`; no toca Dexie ni envia cambios.

## Sync Protocol

`SYNC_SCHEMA_VERSION = 2`. Pull por cursores `ISO@id`, transaccion Dexie por
lote, server row version, push con concurrencia optimista/transaccion SQL por
operacion, conflictos explicitos y backoff. Mismatch lanza
`SyncSchemaMismatchError` antes de mutar datos.

## Dexie Schema

Version exacta 33. La constante shared se usa en la migracion final para
evitar drift. DB name `nutriclinica`. Compatible con sync 2/API v1 en este RC.

## Desktop/API Compatibility

PARTIAL. Gate tecnico definido: desktop N/N-1 puede hablar con API actual
solo si API contract v1 y sync 2 permanecen compatibles. Cambio breaking
exige bump y falla cerrado. Falta definir duracion N-1, UX mandatory upgrade,
updater firmado y probar CSP contra origen remoto.

Gap CSP: el config Tauri actual solo permite self/IPC y no el futuro API
remoto. Step 02 debe configurar el origen exacto/wss o bridge IPC; no wildcard.

## Web/API Compatibility

PARTIAL. Politica: assets hasheados, compatibilidad backward dentro de v1
para skew temporal de cache; breaking change exige bump y despliegue
coordinado. Falta hosting/CDN y E2E real.

## OLTP Schema

`039` (migraciones 001-039). No se modifico ninguna migracion.

## DWH Schema

`dwh-08-002`, separado de OLTP.

## AI/RAG/Memory Version Bundle

- semantic catalog `smae-catalog-de212940`;
- knowledge `knowledge-policy.v2`;
- retrieval `retrieval-policy.v2`;
- memory/AI `policy-bundle.v1`;
- evaluation `nutrition-golden-v1`;
- toolset `toolset.45419c48`;
- prompts `prompt-bundle.a2e0df87`;
- output schemas `output-schema-bundle.294a0b60`.

CURRENT ELIGIBLE MODEL = NONE. LOCAL_AUTO = ABSTAIN. No se cambio
certificacion, thresholds, candidatos, egress, shadow o Patient AI.

## Release Compatibility Manifest

PASS. Se extendio `DeploymentManifest` del Build 09.5A; no sistema paralelo.
`pnpm --filter @nutriclinica/api release:manifest` genero
`release-manifest.json` para el commit canonico con todos los campos y sin
secretos/PHI. El JSON es build output ignorado (hash/timestamp); builder,
types, tests y comando estan en Git.

## Dependency Locks

PASS. `pnpm-lock.yaml` trackeado; install frozen PASS. `src-tauri/Cargo.lock`
ahora trackeado (antes ignorado) y `cargo check --locked` PASS.

## Toolchain Versions

- Node `v24.13.0` (CI major 24; engine >=20);
- pnpm `11.5.0` (CI/Docker 11.5.0);
- TypeScript `5.9.3`;
- Vite `6.4.2`;
- React `19.2.6`;
- Dexie `4.4.3`;
- Rust/Cargo `1.96.0`; Cargo MSRV `1.77`;
- target probado `x86_64-pc-windows-msvc`.

Gap documentado: CI usa Rust stable del runner y no `rust-toolchain.toml`
exacto. No se hizo upgrade masivo.

## Reproducible Build

PASS en Windows desde locks:

1. `pnpm install --frozen-lockfile`;
2. lint/typecheck/tests;
3. web/API build;
4. `cargo check --locked`;
5. Tauri release + MSI/NSIS.

No se exige byte-identical por timestamps/metadata de bundles.

## Secret Safety

- Hardened tracked scanner: 0.
- Web artifact: secret markers 0; localhost API 0; source maps 0.
- Desktop EXE/MSI/NSIS raw string scan: secret markers 0; localhost API 0.
- Client/Tauri source: server secret values 0.
- `VITE_API_URL` es publico. No SQL/DWH/JWT/encryption/provider secret en
  cliente.
- `.env` locales permanecen ignorados y no se leyeron/commitearon.

## Full Regression

- API: 1130 passed / 54 skipped / 0 failed (141 files passed + 5 skipped).
- Frontend: 1996 passed / 1 skipped / 0 failed (149 files). Baseline +2 por
  API contract mismatch + error domain test.
- Lint: 0 errors / 9 pre-existing warnings.
- Frontend typecheck: PASS.
- API typecheck: PASS.
- Web build: PASS.
- API build: PASS.
- Tauri check/build: PASS Windows.
- Tracked/artifact secret scans: 0.

Se corrigio un test temporal existente: review del 2026-08-14 con ventana de
7 dias dependia del reloj real. Se fijo clock de test; produccion sin cambio.

## Release Candidate Tag

Local annotated tag `v0.1.0-rc.1`; target:
`d0565e8dee075bb9fd64ae266f329f60e5d2d078`. No push.

## Known Blockers

- Tauri remote API CSP origin pendiente del dominio que defina Step 02.
- Windows/macOS signing NOT_CONFIGURED.
- Updater NOT_IMPLEMENTED.
- macOS/Linux build no probado en este Windows host.
- Identifier `.app` requiere decision antes del bundle macOS.
- Version support window N-1 y mandatory-upgrade UX no definidos.
- Web hosting no configurado.
- Rust exacto no pinneado en repo (runner stable).

## External Blockers

- REAL STAGING = BLOCKED / NO_REAL_STAGING_INFRASTRUCTURE.
- HISTORICAL SQL CREDENTIAL ROTATION = STILL_REQUIRED.
- CURRENT ELIGIBLE CLINICAL MODEL = NONE.
- PROFESSIONAL CLINICAL VALIDATION = NOT_DONE.
- PRODUCTION CLINICAL CERTIFICATION = NOT_GRANTED.
- CLINICAL PRODUCTION RELEASE = NOT_READY.

## Files Changed

Commit canonico: 24 archivos, 6182 inserciones, 58 eliminaciones (incluye
Cargo.lock de 5576 lineas). Cierre: este reporte solamente. No migraciones
001-039 modificadas.

## Commits

- `d0565e8`: canonical desktop-first release baseline (tagged RC).
- cierre documental: este reporte, fuera del tag/despliegue.

## Next Step

No ejecutar automaticamente. Al pasar Step 01, recomendar solo:

**RELEASE FOUNDATION STEP 02 — PRODUCTION-GRADE INFRASTRUCTURE ARCHITECTURE
+ IaC FOUNDATION FOR DESKTOP-FIRST + WEB-SECONDARY NUTRICLINICA.**

Step 02 define infraestructura compartida para desktop primario y web
secundario; no crea backend separado para desktop.

## Gate Status

Baseline canonico, reproducible y trazable: PASS. External readiness sigue
bloqueada y no se confunde con esta gate de release engineering.

RELEASE FOUNDATION STEP 01:
PASS

CANONICAL RELEASE COMMIT:
d0565e8dee075bb9fd64ae266f329f60e5d2d078

ALL REMEDIATION BUILDS INCLUDED:
YES

CANONICAL RELEASE BRANCH:
release/v0.1.0-rc1

DESKTOP IS PRIMARY CHANNEL:
YES

WEB IS SECONDARY CHANNEL:
YES

DESKTOP BUILD:
PASS

DESKTOP TARGETS:
Windows x64 PASS (EXE/MSI/NSIS); macOS/Linux BLOCKED_BY_HOST_OS

TAURI VERSION:
2.11.2

DEXIE SCHEMA VERSION:
33

SYNC PROTOCOL VERSION:
2

DESKTOP SIGNING:
NOT_CONFIGURED

DESKTOP UPDATER:
NOT_IMPLEMENTED

WEB BUILD:
PASS

WEB HOSTING:
NOT_CONFIGURED

API BUILD:
PASS

API CONTRACT VERSION:
v1

OLTP SCHEMA:
039

DWH SCHEMA:
dwh-08-002

RELEASE COMPATIBILITY MANIFEST:
PASS

DESKTOP/API VERSION COMPATIBILITY:
PARTIAL

WEB/API VERSION COMPATIBILITY:
PARTIAL

LOCKFILES:
PASS

REPRODUCIBLE BUILD:
PASS

API TESTS:
1130/1184 (54 skipped)

FRONTEND TESTS:
1996/1997 (1 skipped)

DESKTOP/TAURI CHECK:
PASS

LINT:
PASS

TYPECHECK:
PASS

BUILD:
PASS

TRACKED CONFIRMED SECRETS:
0

SECRETS EMBEDDED IN DESKTOP:
0

SECRETS EMBEDDED IN WEB:
0

CURRENT ELIGIBLE CLINICAL MODEL:
NONE

REAL STAGING:
BLOCKED

PRODUCTION TOUCHED:
NO

PROFESSIONAL CLINICAL VALIDATION:
NOT_DONE

CLINICAL PRODUCTION RELEASE:
NOT_READY

RELEASE CANDIDATE TAG:
v0.1.0-rc.1 (local, target d0565e8dee075bb9fd64ae266f329f60e5d2d078)

WORKTREE CLEAN:
YES
