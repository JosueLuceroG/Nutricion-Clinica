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
```

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
