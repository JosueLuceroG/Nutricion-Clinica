import { copyFileSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, "..", "..");
const repositoryRoot = resolve(apiRoot, "..", "..");
const outdir = join(apiRoot, "dist-deploy");

rmSync(outdir, { force: true, recursive: true });
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: {
    server: join(apiRoot, "src", "server.ts"),
    jobs: join(apiRoot, "src", "jobs.ts"),
    migrate: join(apiRoot, "src", "db", "migrateCli.ts"),
    "dwh-schema": join(
      apiRoot,
      "src",
      "modules",
      "dwh",
      "schema",
      "applyDwhSchema.ts",
    ),
    healthcheck: join(apiRoot, "src", "scripts", "containerHealthcheck.ts"),
    "standalone-preflight": join(
      apiRoot,
      "src",
      "scripts",
      "standalonePreflight.ts",
    ),
    "retention-backfill": join(
      apiRoot,
      "src",
      "scripts",
      "retentionBackfill.ts",
    ),
  },
  outdir,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  alias: {
    "@nutriclinica/shared": join(
      repositoryRoot,
      "packages",
      "shared",
      "src",
      "index.ts",
    ),
  },
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
});

copyFileSync(
  join(apiRoot, "src", "modules", "dwh", "schema", "dwh-schema.sql"),
  join(outdir, "dwh-schema.sql"),
);
copyFileSync(
  join(apiRoot, "src", "modules", "dwh", "schema", "dwh-upgrade-08-003.sql"),
  join(outdir, "dwh-upgrade-08-003.sql"),
);
cpSync(join(apiRoot, "migrations"), join(outdir, "migrations"), {
  recursive: true,
});
