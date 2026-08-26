# Desktop-First + Web-Secondary Release Contract

Fecha: 2026-08-26. Baseline: `v0.1.0-rc.1`.

## 1. Channels

PRIMARY DISTRIBUTION CHANNEL: **DESKTOP_TAURI**.

SECONDARY DISTRIBUTION CHANNEL: **WEB**.

Ambos usan los mismos contratos de backend. Web no reemplaza a desktop y
desktop no requiere un backend separado. Dexie/IndexedDB y la operacion
offline siguen siendo parte del producto primario.

## 2. Compatibility tuple

Una release desktop no se identifica solo por el numero del frontend:

```text
desktopVersion 0.1.0
+ Tauri 2.11.2
+ Dexie schema 33
+ sync protocol 2
+ API contract v1
+ OLTP schema dependency 039
= compatible release tuple
```

El web artifact usa `webVersion 0.1.0` + `apiContractVersion v1`. El manifest
canonico agrega las identidades DWH/RAG/memoria/AI pero esas no cambian la
migracion Dexie por si solas.

## 3. API URL contract

- `VITE_API_URL` es configuracion publica de build para desktop y web; no es
  un secreto.
- Builds de produccion sin `VITE_API_URL` fallan al usar la API; no caen
  silenciosamente a `localhost`.
- `http://localhost:3000` solo es fallback de modo DEV.
- SQL/DWH credentials, JWT signing secret, encryption keys, AI provider keys
  y service credentials viven exclusivamente en el servidor.
- Cualquier `VITE_*` queda visible en JavaScript/binario. Nunca contiene un
  secreto durable. TURN por env solo puede ser publico/efimero; se prefiere
  el endpoint autenticado `/telemedicina/turn-config`.

Gap real: el CSP Tauri actual permite `self`/IPC pero no el futuro origen
remoto de API/WebSocket. Step 02 debe agregar el origen exacto autorizado (y
`wss:` correspondiente) o un bridge IPC controlado. No se autoriza `*` ni un
origen arbitrario en esta fase.

## 4. API and sync gates

El servidor publica en `/sync/manifest`:

- `apiContractVersion = v1` (`API_VERSION`);
- `syncSchemaVersion = 2` (`SYNC_SCHEMA_VERSION`);
- entidades syncables y limites operativos.

`SyncEngine` valida ambos antes de pull/push:

- schema distinto -> `SyncSchemaMismatchError`;
- API contract distinto -> `ApiContractMismatchError`;
- en ambos casos, no inicia pull, no envia push y no muta Dexie.

Este es el estado upgrade-required fail-closed tecnico. La UX dedicada de
upgrade obligatorio aun es parcial: hoy la incompatibilidad se reporta como
error de sync, no como updater firmado.

## 5. Offline and Dexie contract

- SQL Server es fuente autoritativa de pacientes, consultas,
  antropometrias, labs, planes y adherencia.
- Dexie `nutriclinica` schema 33 es cache offline transaccional y contiene
  tambien modulos local-first fuera del set syncable.
- Pull: cursores por entidad `ISO-8601@id`, lotes atomicos Dexie, soft delete,
  `row_version` local.
- Push: cola local, expected row version, transaccion SQL por operacion,
  conflicto explicito, backoff 1s-60s + jitter, recuperacion de `syncing`
  atascado y limite de reintentos.
- Cursor legacy no compatible provoca pull completo seguro.
- Cambiar indices/stores Dexie exige bump de `DEXIE_SCHEMA_VERSION` y
  migracion Dexie. Cambiar forma sync exige bump de `SYNC_SCHEMA_VERSION`.

## 6. Desktop/API version skew

Desktop N puede hablar con API N+1 **solo si** API contract sigue `v1` y
sync protocol sigue `2`, y los endpoints usados mantienen compatibilidad.

Desktop N-1 puede hablar con la API actual bajo la misma condicion exacta.
No existe una duracion arbitraria garantizada; la ventana temporal de soporte
esta UNDEFINED y cualquier cambio breaking es blocker hasta definirla.

Si cambia sync:

1. se incrementa `SYNC_SCHEMA_VERSION`;
2. se publica desktop compatible;
3. el desktop anterior falla cerrado antes de tocar datos;
4. el operador decide mandatory upgrade y rollback de aplicacion (nunca
   downgrade destructivo de Dexie/OLTP).

Si cambia API sin cambiar sync pero rompe estructuras criticas, se incrementa
`API_VERSION`; el cliente anterior falla cerrado. No se reutiliza `v1` para
un cambio breaking.

Estado de politica: **PARTIAL**. Los gates estan implementados; falta ventana
de soporte, UX de mandatory upgrade, updater firmado y prueba con API remota.

## 7. Web/API version skew

Los assets Vite tienen hashes, pero caches pueden conservar HTML/assets
anteriores temporalmente. Dentro de `v1`, la API mantiene compatibilidad
backward para el web artifact previo durante un despliegue coordinado. Un
cambio breaking exige bump de contrato y despliegue coordinado.

Estado: **PARTIAL**. La politica esta definida, pero no existe hosting/CDN ni
gate E2E contra infraestructura real.

## 8. Tauri configuration

| Campo | Valor/estado |
|---|---|
| Product | `NutriClinica` |
| Identifier | `com.nutriclinica.app` |
| Version | `0.1.0` |
| Tauri | `2.11.2` |
| Build frontend | `pnpm build` -> `dist/` |
| Dev URL | `http://localhost:1420` (solo dev) |
| Bundle targets | `all` |
| Windows window | 1440x900, min 1024x700, maximized/fullscreen, custom decorations |
| Plugins | log, fs, notification |
| Capabilities | core/window/webview/event/app/resources/menu/tray, log, notification |
| Native commands | health, app version, CSV a Downloads |
| Updater | NOT_IMPLEMENTED |
| Signing | NOT_CONFIGURED |

El identificador `.app` genera warning en macOS y debe decidirse antes de una
release macOS firmada. No se renombra en esta fase porque es identidad
persistente del producto.

## 9. Storage and session considerations

- IndexedDB/WebView contiene Dexie schema 33. La ruta fisica depende de
  WebView2/browser y no esta fijada en el repo.
- `localStorage` contiene tokens/sesion y preferencias existentes. Logout y
  revocacion server-side se mantienen; una futura politica de updater debe
  probar clearing/compatibilidad.
- Rust `DbState` no abre una BD productiva; es placeholder. No confundirlo con
  la fuente de datos desktop.
- CSV nativo se guarda en Downloads mediante `app.path().download_dir()`.

## 10. Updater and signing policy

Estado updater: **NOT_IMPLEMENTED**.

Requisitos futuros, sin implementacion falsa:

- artefactos Windows/macOS/Linux firmados por plataforma;
- secretos de signing solo en CI/secret store;
- manifest de update firmado y HTTPS;
- compatibilidad API/sync/Dexie declarada por release;
- staged rollout, mandatory upgrade explicito y recuperacion de datos;
- rollback de aplicacion sin downgrade destructivo de schema.

WINDOWS_SIGNING = NOT_CONFIGURED. MACOS_SIGNING = NOT_CONFIGURED. No se
generaron certificados ni se commitearon secretos.

## 11. Distribution targets

El workflow actual intenta `ubuntu-latest`, `windows-latest` y
`macos-latest`. Esta ejecucion valida Windows x64 (EXE, MSI, NSIS). macOS y
Linux quedan `BLOCKED_BY_HOST_OS`; no se afirma PASS cruzado.

WEB_BUILD = PASS. WEB_HOSTING = NOT_CONFIGURED. Build capability no equivale
a producto web desplegado.

## 12. Breaking-change checklist

Antes de cambiar una release compartida:

1. Determinar si cambia API, sync o Dexie.
2. Incrementar la constante/migracion correspondiente; nunca reciclar version.
3. Actualizar `DeploymentManifest` y tests.
4. Probar desktop anterior contra API nueva de forma fail-closed.
5. Probar web previo por cache contra API nueva.
6. Probar migracion offline Dexie con datos sinteticos.
7. Mantener OLTP y DWH como identidades separadas.
8. No habilitar modelos, Patient AI o shadow por un cambio de release.
