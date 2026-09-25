# Step 03B - Standalone Windows Operations

Fecha: 2026-09-17. Estado actual: **CONDITIONAL / NOT READY**.

Este documento define el modo standalone de NutriClinica para un host Windows
dedicado. No cambia el modelo de dominio ni crea una segunda aplicacion. El
Desktop Tauri y el Web secundario usan los mismos contratos API `v1`, sync `2`,
Dexie `33`, OLTP `039` y DWH `dwh-08-003`.

## 1. Topologia

```text
Tauri Desktop / browser local
             |
             | HTTP/WS same-origin or loopback
             v
Windows Task Scheduler -> supervisor.ps1
             |
             +--> node api/server.js  (API + optional static Web)
             +--> node api/jobs.js    (exactly one jobs runner)
             |
             +--> SQL Server OLTP     DB_NAME
             +--> SQL Server DWH      DWH_DATABASE (different database)
```

The supervisor is deliberately implemented with the Windows Task Scheduler and
the packaged Node runtime. This avoids an unpinned WinSW/NSSM dependency. It is
an OS-native service-equivalent process, not an SCM Windows Service; a strict
SCM requirement or a signed MSI/NSIS post-install hook remains a release
blocker until exercised on the target host.

The API serves the Web artifact only when `STANDALONE_MODE=true` and
`NUTRICLINICA_WEB_ROOT` is configured. Requests under `/api/` are rewritten to
the existing root API routes. WebSocket paths under `/api/ws/*` are accepted by
the gateway. Normal API mode does not serve static files.

## 2. Package

Build-time only:

```powershell
pwsh -File deployment/windows/build-package.ps1 `
  -NodeRuntimePath <approved-node-20-or-newer-node.exe>
```

The package contains:

```text
api/server.js
api/jobs.js
api/migrate.js
api/dwh-schema.js
api/standalone-preflight.js
api/migrations/*.sql
api/dwh-schema.sql
api/dwh-upgrade-08-003.sql
api/package.json
api/node_modules/* (production dependencies only, hoisted and relocatable)
web/*
runtime/node.exe
config/standalone.env.example
config/server-secrets.env.example
deployment/windows/*.ps1
deployment/standalone/contract.mjs
deployment/standalone/manifest-cli.mjs
package-manifest.json
```

The package builder removes pnpm lock metadata, workspace links, source maps and
non-example `.env` files. A Node runtime is an immutable package dependency, not
a customer prerequisite. The builder does not download SQL Server, a provider,
a secret manager or a model. The generated `standalone.env.example` explicitly
sets `STANDALONE_MODE=true`.

## 3. Configuration and endpoint discovery

`install.ps1` creates `config/standalone.env` from the non-secret template, or
accepts an explicit `-ConfigFile`. Put only server-side secret values in the
ACL-protected `config/server-secrets.env`:

```text
JWT_SECRET=<generated random value>
FIELD_ENCRYPTION_KEY=<generated random value>
```

The service reads configuration from those files; no Desktop or Web artifact
receives SQL credentials, JWT keys, field keys, SMTP credentials or AI keys.
The service account must be able to read the protected secret file. The default
binding is `127.0.0.1:3000`; LAN binding requires an explicit host,
`STANDALONE_ALLOW_LAN=true`, firewall rules and exact CORS origins. A future
remote deployment changes configuration/edge routing, not domain code.

For the Web artifact set `VITE_API_URL=/api` at build time. For Tauri, the
release target supplies an explicit API origin; production builds never fall
back silently to a developer localhost endpoint. `httpClient.ts` resolves a
relative API base against the browser origin, and WebSocket clients construct an
absolute `ws:`/`wss:` URL from the same base.

## 4. Install and lifecycle

The operator-facing commands are:

```powershell
pwsh -File deployment/windows/install.ps1 `
  -InstallRoot <package-root> `
  -SecretFile <protected-secret-source> `
  -StartAfterInstall
pwsh -File deployment/windows/status.ps1 -InstallRoot <package-root>
pwsh -File deployment/windows/stop.ps1 -InstallRoot <package-root>
pwsh -File deployment/windows/start.ps1 -InstallRoot <package-root>
pwsh -File deployment/windows/restart.ps1 -InstallRoot <package-root>
pwsh -File deployment/windows/uninstall.ps1 -InstallRoot <package-root>
```

The lifecycle scripts require PowerShell 7 (`pwsh.exe`). The installer performs
the install/runtime preflights and registers the Task Scheduler host task; the
operator does not need to invoke Node, pnpm or SQL migration commands manually.

Installation performs, in order:

1. creates application state, backup and log directories;
2. protects the server secret file;
3. runs install-phase preflight;
4. runs exactly one OLTP migration workload;
5. runs exactly one DWH schema workload;
6. runs runtime preflight requiring OLTP `039` and DWH `dwh-08-003`;
7. registers the host task and optionally starts it.

The API process always runs with `BACKGROUND_JOBS_ENABLED=false`; the separate
jobs process runs with it explicitly enabled. The supervisor restarts either
child with bounded exponential backoff and records coarse process metadata and
per-process stdout/stderr under the log root. It does not put passwords, tokens,
request bodies or patient identifiers in its own log messages.

Uninstall removes the task. It never removes the configured data, backup or log
roots. Application files are removed only with the explicit
`-RemoveApplicationFiles` switch, and that switch still excludes those roots.

## 5. Preflight

`api/standalone-preflight.js --phase=install|runtime` checks without printing
secret values:

- explicit standalone mode and LOCAL/TEST environment;
- instance identity and safe loopback/LAN binding;
- distinct OLTP/DWH database identities;
- Windows-auth or protected SQL-auth configuration;
- SQL-backed DWH configuration;
- JWT and field-encryption key presence/strength;
- Patient AI disabled and professional Shadow disabled;
- SQL persistence for enabled Memory/RAG/telemetry stores;
- data, backup, log and Web directories;
- OLTP and DWH connectivity;
- exact migration checksums and DWH schema-chain compatibility at runtime.

Install phase permits an uninitialized schema only so the one-shot workloads
can create it. Runtime phase fails closed if either schema is absent, drifts or
cannot be checked. SQL errors are reduced to stable check failures in the
report.

## 6. SQL strategy

The application does not install or license SQL Server. The supported local
verification path is a customer-approved SQL Server instance, including the
previously verified `localhost\SQLEXPRESS` Windows-auth path for disposable
synthetic testing. A customer rollout must separately approve the SQL Server
edition, version, compatibility level, licensing, service account permissions,
encryption/certificate policy, capacity, backup location and patch ownership.

Named-instance discovery may use SQL Browser when no port is configured; a
customer production profile should prefer an explicit TCP endpoint. Windows
authentication is preferred where the service identity has an approved database
grant. SQL authentication, when required, reads credentials only from the
protected server file.

OLTP migration and DWH schema are separate one-shot workloads. API startup does
not migrate. The DWH store uses `getDwhPool()` and the DWH database must differ
from `DB_NAME`; moving analytics tables into OLTP is prohibited.

## 7. Readiness and offline operation

- `/health/live` reports process liveness only.
- `/health/ready` requires OLTP and, when enabled as SQL, DWH connectivity.
- Jobs readiness is a process marker plus supervisor state.
- AI provider eligibility is not readiness; the current clinical eligibility
  remains `NONE` and Patient AI remains disabled.
- `EXTERNAL_SIDE_EFFECTS_MODE=DISABLED` and `AI_EGRESS_ENABLED=false` are valid
  standalone defaults.
- Core patient, consultation, anthropometry, lab, meal-plan, adherence and
  local-first workflows must continue with internet disconnected after local
  SQL/API availability is established.
- SMTP, TURN, external AI and other network integrations are optional and must
  fail closed or visibly degrade; they cannot be required for core ERP use.

## 8. Current evidence and remaining blockers

Implemented and unit/static-tested in this repository:

- relative `/api` HTTP and absolute WebSocket URL resolution;
- `/api` route prefix and optional same-process Web hosting;
- dedicated SQL DWH store selection;
- migration files included in the deployment artifact;
- standalone preflight and no-secret failure reporting;
- package lifecycle scripts, manifest contract and inventory tests.

Not yet certifiable as `PASS` here:

- a real packaged Node runtime and signed installer on a target Windows host;
- actual Task Scheduler boot, child failure/restart and OS reboot evidence;
- customer SQL edition/licensing and service-account approval;
- full-install SQL/file/Desktop backup and isolated restore rehearsal;
- an authorized full offline/recovery exercise with synthetic data;
- remote staging, DNS/TLS/WSS, provider, registry or off-host storage.

Final Step 03B reporting must use `PASS`, `CONDITIONAL` or `FAIL` separately
for each gate. Existing Step 03A test evidence must not be reused as evidence
for any unexecuted Windows or recovery gate.
