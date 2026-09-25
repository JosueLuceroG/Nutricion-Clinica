# Portable Deployment Package

This package defines NutriClinica server deployment without selecting or
provisioning an infrastructure provider.

- `compose/compose.yaml`: `LOCAL_DEPLOYMENT_SIMULATION` for API/Web artifact
  validation. It is never real staging and intentionally uses no real SQL or
  external integrations.
- `config/deployment-inputs.example`: non-secret deployment driver contract.
- `scripts/validate-config.mjs`: fail-closed provider-neutral input validator.
- `scripts/verify-release-manifest.mjs`: verifies foundation or strict
  deployment manifest evidence; it does not create another manifest.
- `health/smoke.mjs`: liveness, readiness, Web proxy, WebSocket upgrade and
  synthetic PHI echo smoke.
- `scripts/test-api-artifact.mjs`: starts the production API bundle, exercises
  liveness, jobs startup/shutdown and one-shot fail-closed guards.
- `scripts/verify-web-artifact.mjs`: verifies the production static bundle and
  Nginx SPA/cache/WSS contract without reading secrets.

Native/static artifact checks (no container engine required):

```powershell
pnpm --filter @nutriclinica/api build:deploy
pnpm deployment:test
pnpm deployment:api-artifact:test
$env:CI='true'; $env:VITE_API_URL='/api'; pnpm build
pnpm deployment:web-artifact:verify
pnpm deployment:standalone:test
```

## Windows standalone package

`windows/build-package.ps1` assembles a self-contained application package from
the API deployment bundle and the Web artifact. The build must be supplied a
reviewed Node 20+ runtime; the runtime is part of the package so the end user
does not run Node, pnpm or migrations manually. API production dependencies are
scoped to the API, installed with hoisted physical links, and stripped of pnpm
workspace metadata so the package can be moved without the source repository.

```powershell
pwsh -File deployment/windows/build-package.ps1 -NodeRuntimePath <approved-node.exe>
```

The package uses the Windows Task Scheduler as an OS-native host supervisor (no
third-party service wrapper). It starts exactly one API process and one jobs
process, restarts failed children with bounded backoff, and serves the Web
artifact from the API process when `NUTRICLINICA_WEB_ROOT` is configured. This
is a service-equivalent supervisor, not proof of an installed MSI/NSIS product;
the installer integration and signed Windows release remain conditional until
they are exercised on the target host.

The operator lifecycle is exposed by `deployment/windows/install.ps1`,
`start.ps1`, `stop.ps1`, `restart.ps1`, `status.ps1`, `backup.ps1`,
`restore.ps1` and `uninstall.ps1`. Secrets are read only from the protected
server-side `config/server-secrets.env`; they are never copied into `web`,
Desktop, manifests or logs. Uninstall deliberately retains data, backups and
logs.

The full-install backup is a directory package containing native OLTP/DWH SQL
backups, hashed external files and an encrypted Desktop export supplied by the
authorized UI. A clean snapshot requires a clean sync state and an explicit
Desktop export; `-SnapshotMode emergency` is visibly marked and cannot be
restored without an explicit override. The existing local Dexie backup remains
a limited client export and is not a substitute for this contract.

Validate an approved non-secret driver file with:

```powershell
pnpm deployment:validate -- --env-file <approved-input-path> --print-runtime-map
```

Run only when a local container engine is available:

```powershell
$env:RELEASE_VERSION='0.1.0-rc.1'
$env:RELEASE_COMMIT=(git rev-parse HEAD)
docker compose -f deployment/compose/compose.yaml build
docker compose -f deployment/compose/compose.yaml up -d
pnpm deployment:smoke
docker compose -f deployment/compose/compose.yaml down
```

Defaults: Web `http://127.0.0.1:8080`, API
`http://127.0.0.1:3000`. Override smoke endpoints with `WEB_URL`/`API_URL`
when host ports are changed.

The API readiness endpoint is expected to return `503` in this limited
simulation because `sql-not-provisioned.invalid` is deliberate. Real SQL,
migrations, backup/restore, sync and E2E belong to an authorized Step 03
target, not to localhost masquerading as staging.

The API image exposes five operator commands. A real target runs migrations
and DWH schema as exactly-one one-shot workloads and jobs as exactly one
supervised process; API startup never migrates:

```text
WORKLOAD_ROLE=api node dist-deploy/server.js
WORKLOAD_ROLE=migration node dist-deploy/migrate.js
WORKLOAD_ROLE=dwh-schema node dist-deploy/dwh-schema.js
WORKLOAD_ROLE=jobs node dist-deploy/jobs.js
WORKLOAD_ROLE=migration node dist-deploy/retention-backfill.js  # dry-run default
```

See `docs/operations/deployment-architecture.md` and
`docs/operations/real-staging-requirements.md` before using any non-local
target.
