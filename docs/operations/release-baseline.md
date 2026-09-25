# NutriClinica Canonical Release Baseline

Fecha: 2026-08-26. Release candidate: `v0.1.0-rc.1`. Rama canonica:
`release/v0.1.0-rc1`. Este documento define una linea base reproducible; no
autoriza ni ejecuta staging, produccion, infraestructura o validacion clinica.

## 1. Identidad de release

| Campo | Valor | Fuente |
|---|---|---|
| Release candidate | `0.1.0-rc.1` | tag Git local `v0.1.0-rc.1` + `RELEASE_VERSION` |
| Version objetivo de componentes | `0.1.0` | package/Tauri/Cargo manifests |
| Canal primario | `DESKTOP_TAURI` | arquitectura del producto + `src-tauri/` |
| Canal secundario | `WEB` | build Vite raiz |
| API compartida | `0.1.0`, contrato `v1` | `apps/api/package.json` + `API_VERSION` |
| Sync | protocolo/schema `2` | `packages/shared/src/index.ts` |
| Dexie | schema `33` | `DEXIE_SCHEMA_VERSION` + cadena final de `dexieSchema.ts` |
| OLTP | migracion `039` | `apps/api/migrations/` |
| DWH | `dwh-08-002` | `DWH_SCHEMA_VERSION` |

El tag identifica el commit canonico. El reporte de cierre registra su hash
exacto. El commit posterior que solo agrega el reporte operativo no forma
parte del artefacto desplegable.

## 2. Prueba de ascendencia Git

Se ejecuto `git log --oneline --decorate --graph --all -100` y, para cada
head de Build, `git merge-base --is-ancestor <commit> aaced2f`. Todos
devolvieron exit 0. `main` tambien es ancestro del head de hardening. La
historia de remediacion es lineal; no se hicieron merges duplicados.

| BUILD | BRANCH | KEY COMMIT(S) | IN CANONICAL HEAD | STATUS |
|---|---|---|---|---|
| 01 | `hardening/remediation-01` | `c3c557c`, `e34ffd2`, `4d66fe3`, `a69dc1a` | YES | INCLUDED |
| 02 | `hardening/remediation-02` | `75217e0`, `8163aca`, `e5a22d2` | YES | INCLUDED |
| 03 | `hardening/remediation-03` | `b5721f1`, `79ba535`, `bd9bc19` | YES | INCLUDED |
| 04 | `hardening/remediation-04` | `d0fcc81`, `ef0a3d6`, `4962bb6`, `4a8204b` | YES | INCLUDED |
| 05 | `hardening/remediation-05` | `8e00b6e`, `21753cd`, `a68d69d`, `8583530`, `b4a36f5` | YES | INCLUDED |
| 06 | `hardening/remediation-06` | `3d3ebc0`, `006b366`, `2407f89`, `bbc32da`, `45e8f7d` | YES | INCLUDED |
| 06.1 | `hardening/remediation-06-1` | `c588994`, `215bfc8`, `1af6d98`, `dbbec47`, `1993767`, `48cec66` | YES | INCLUDED |
| 07 | `hardening/remediation-07` | `50fcc00`, `15c752a`, `9daffed`, `d9e9929`, `815e74c`, `7ddd447`, `f51af83` | YES | INCLUDED |
| 07.5 | `hardening/remediation-07-5` | `75dabab`, `3ae7b3e`, `381bd9c`, `2650848` | YES | INCLUDED |
| 07.5A | `hardening/remediation-07-5a` | `c3ca123`, `3927a1a` | YES | INCLUDED |
| 08 | `hardening/remediation-08` | `94a0101` | YES | INCLUDED |
| 09 | `hardening/remediation-09` | `ce570ed` | YES | INCLUDED |
| 09.5A | `hardening/remediation-09-5a` | `56bbe4e` | YES | INCLUDED |
| Operational Gate 09.5A-S1 | `hardening/remediation-09-5a` | `aaced2f` | YES | INCLUDED |

Resultado: no hay Build requerido MISSING ni fuera de la linea base.

## 3. Fuentes de version

| COMPONENTE | FUENTE ACTUAL | VERSION | AUTORITATIVA | STATUS |
|---|---|---|---|---|
| Release | tag Git `v*` + `RELEASE_VERSION` | `0.1.0-rc.1` | YES | DEFINED |
| Desktop bundle | `src-tauri/tauri.conf.json` | `0.1.0` | YES | DEFINED |
| Rust crate | `src-tauri/Cargo.toml` | `0.1.0` | Condicional: debe coincidir con desktop | ALIGNED |
| Tauri framework | `src-tauri/Cargo.lock` | `2.11.2` | YES, dependencia resuelta | LOCKED |
| Web/frontend | `package.json` raiz | `0.1.0` | YES | DEFINED |
| API | `apps/api/package.json` | `0.1.0` | YES | DEFINED |
| Shared types | `packages/shared/package.json` | `0.1.0` | YES para paquete shared | DEFINED |
| API contract | `API_VERSION` en `@nutriclinica/shared` | `v1` | YES | ENFORCED_ON_SYNC |
| Sync contract | `SYNC_SCHEMA_VERSION` en shared | `2` | YES | ENFORCED |
| Dexie schema | `DEXIE_SCHEMA_VERSION` en shared, usado por migracion final | `33` | YES | ENFORCED |
| Docker label | `Dockerfile` | `0.1.0` | NO, metadato derivado | ALIGNED |
| Release workflow | tags `v*` | no version fija | NO, disparador | DEFINED |
| Deployment manifest | builders/constantes anteriores | derivado | NO, consumidor | ALIGNED |

Correccion de esta fase: `frontendVersion` ahora lee el `package.json` raiz
(el inexistente `web/package.json` devolvia `UNKNOWN`), y `apiVersion` lee
`apps/api/package.json` en vez de una literal duplicada.

## 4. Manifest de compatibilidad

El sistema canonico sigue siendo `DeploymentManifest` del Build 09.5A. Se
extendio en lugar de crear un segundo sistema. El comando:

```powershell
$env:ENVIRONMENT_CLASS='TEST'
$env:INSTANCE_ID='release-foundation-step-01'
$env:RELEASE_VERSION='0.1.0-rc.1'
pnpm --filter @nutriclinica/api release:manifest
```

genera `/release-manifest.json` desde el commit actual. Es artefacto de build
ignorado por Git porque contiene hash y timestamp; el builder TypeScript,
tests y comando si estan versionados. Campos probados:

| Campo | Valor baseline |
|---|---|
| `desktopVersion` | `0.1.0` |
| `desktopChannel` | `primary` |
| `desktopTauriVersion` | `2.11.2` |
| `dexieSchemaVersion` | `33` |
| `syncProtocolVersion` | `2` |
| `webVersion` | `0.1.0` |
| `webChannel` | `secondary` |
| `apiVersion` | `0.1.0` |
| `apiContractVersion` | `v1` |
| `oltpSchemaVersion` | `039` |
| `dwhSchemaVersion` | `dwh-08-002` |
| `semanticCatalogVersion` | `smae-catalog-de212940` |
| `knowledgePolicyVersion` | `knowledge-policy.v2` |
| `retrievalPolicyVersion` | `retrieval-policy.v2` |
| `memoryPolicyVersion` | `policy-bundle.v1` |
| `aiPolicyVersion` | `policy-bundle.v1` |
| `evaluationDatasetVersion` | `nutrition-golden-v1` |
| `toolsetVersion` | `toolset.45419c48` |
| `promptBundleVersion` | `prompt-bundle.a2e0df87` |
| `outputSchemaBundleVersion` | `output-schema-bundle.294a0b60` |

`outputSchemaBundleVersion` se calcula con FNV-1a sobre las versiones
existentes. Ningun campo contiene password, connection string, token, API key
o PHI.

## 5. Desktop inventory

| Elemento | Estado real |
|---|---|
| Tauri | v2, exacto `2.11.2` |
| Identificador | `com.nutriclinica.app` |
| Version | `0.1.0` |
| Bundle targets | `all`; workflow intenta Windows, macOS y Linux |
| Validado en esta fase | Windows x64: EXE release + MSI + NSIS PASS |
| Updater | NOT_IMPLEMENTED; no plugin updater ni manifest de update |
| Signing | NOT_CONFIGURED; sin certificados o secretos |
| CSP | fail-closed; actualmente no incluye origen API remoto (gap para Step 02) |
| Permisos | core/window/webview/event/app/resources/menu/tray, log, notification |
| Comandos Rust | health, version, CSV a Downloads |
| Rust DB | `DbState` placeholder; datos reales del cliente en Dexie |
| Dexie | DB `nutriclinica`, schema 33, IndexedDB administrado por WebView/browser |
| localStorage | sesion/preferencias/drafts/config local segun stores existentes |

El identificador termina en `.app`; Tauri advierte conflicto potencial con la
extension de bundles macOS. No se cambio sin una decision de identidad de
producto; macOS queda pendiente de build/signing en host macOS.

## 6. Builds y calidad

- Install reproducible: `pnpm install --frozen-lockfile` PASS.
- Web: `CI=true`, `VITE_API_URL=https://api.release.invalid`, `pnpm build`
  PASS. El dominio `.invalid` es no enrutable y solo prueba configuracion.
- API: `pnpm --filter @nutriclinica/api build` PASS; startup `dist/server.js`.
- Rust: `cargo check --locked --manifest-path src-tauri/Cargo.toml` PASS
  (1 warning legacy: `ping` no usado).
- Desktop: `pnpm build:tauri` PASS en Windows x64; MSI y NSIS generados.
- macOS/Linux: no construidos en Windows; `BLOCKED_BY_HOST_OS` en esta
  ejecucion, aunque el workflow declara ambos targets.
- Test baseline final: ver reporte de cierre.

## 7. Locks y toolchain

| Tool | Requisito/fuente | Ejecutado |
|---|---|---|
| Node | CI `24`; package engine `>=20` | `v24.13.0` |
| pnpm | CI/Docker `11.5.0`; engine `>=9` | `11.5.0` |
| TypeScript | lockfile | `5.9.3` |
| Vite | lockfile | `6.4.2` |
| React | lockfile | `19.2.6` |
| Dexie | lockfile | `4.4.3` |
| Tauri JS API | lockfile | `2.11.0` |
| Tauri CLI | lockfile | `2.11.2` |
| Rust/Cargo | Cargo MSRV `1.77`; runner actual | `1.96.0` |
| Rust target probado | rustup | `x86_64-pc-windows-msvc` |

`pnpm-lock.yaml` ya estaba trackeado. `src-tauri/Cargo.lock` estaba presente
pero ignorado; ahora se trackea, requisito correcto para una aplicacion
binaria. CI usa instalacion frozen. El Rust exacto del runner aun no esta
pinneado por `rust-toolchain.toml`; se documenta, no se actualiza en masa.

## 8. Internal technical RC notes

Arquitectura incluida: ERP desktop-first offline, sync OLTP con concurrencia
optimista, API Express multi-tenant, SQL Server migraciones 001-039, DWH
dwh-08-002, RAG/memoria versionados, runtime AI fail-closed, observabilidad,
shadow readiness y deployment guards 09.5A.

Cambios de compatibilidad de esta fase:

- API contract `v1` y sync protocol `2` se validan antes de pull/push.
- Incompatibilidad API o sync aborta sin tocar datos locales.
- Dexie schema 33 queda en shared como parte de la identidad de release.
- Builds de produccion requieren `VITE_API_URL`; localhost solo existe en DEV.
- Manifest incluye desktop/web/API/sync/Dexie y bundles de politica/version.
- Cargo.lock se incorpora a la fuente canonica.

Bloqueadores que permanecen: staging real inexistente; rotacion SQL historica
pendiente; signing/updater no configurados; CSP API remoto pendiente del
origen elegido en infraestructura; ningun modelo clinico eligible; validacion
profesional no realizada; release clinico NOT_READY.

CURRENT ELIGIBLE CLINICAL MODEL = NONE. `NUTRICLINICA_LOCAL_AUTO` permanece
ABSTAIN. No se aprobo candidato, no se cambio umbral y Patient AI sigue
deshabilitado.

## 9. No deployment

No se provisiono cloud/VPS, no se creo staging, no se tocaron BDs remotas ni
produccion, no se inyectaron secretos reales y no se hizo push.
