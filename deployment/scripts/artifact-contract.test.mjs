import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  apiDockerfile,
  webDockerfile,
  compose,
  nginx,
  nginxSecurityHeaders,
  dockerignore,
  serviceWorker,
  releaseWorkflow,
] = await Promise.all([
  readFile("apps/api/Dockerfile", "utf8"),
  readFile("Dockerfile", "utf8"),
  readFile("deployment/compose/compose.yaml", "utf8"),
  readFile("nginx.conf", "utf8"),
  readFile("nginx-security-headers.conf", "utf8"),
  readFile(".dockerignore", "utf8"),
  readFile("public/sw.js", "utf8"),
  readFile(".github/workflows/release.yml", "utf8"),
]);

test("API and Web images are pinned, non-root, traceable, and health checked", () => {
  assert.match(apiDockerfile, /^FROM node:24\.13\.0-bookworm-slim/m);
  assert.match(apiDockerfile, /^USER node$/m);
  assert.match(apiDockerfile, /^HEALTHCHECK /m);
  assert.match(apiDockerfile, /dist-deploy\/healthcheck\.js/);
  assert.match(apiDockerfile, /org\.opencontainers\.image\.revision=/);
  assert.match(apiDockerfile, /pnpm --config\.inject-workspace-packages=true/);
  assert.doesNotMatch(apiDockerfile, /COPY\s+\.env/);

  assert.match(webDockerfile, /^FROM node:24\.13\.0-alpine/m);
  assert.match(webDockerfile, /^FROM nginx:1\.28\.0-alpine/m);
  assert.match(
    webDockerfile,
    /COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml/,
  );
  assert.match(webDockerfile, /^USER nginx$/m);
  assert.match(webDockerfile, /^HEALTHCHECK /m);
  assert.doesNotMatch(`${apiDockerfile}\n${webDockerfile}`, /:latest\b/);
});

test("Compose is explicitly a no-secret local simulation", () => {
  assert.match(compose, /LOCAL_DEPLOYMENT_SIMULATION/);
  assert.match(compose, /sql-not-provisioned\.invalid/);
  assert.match(compose, /BACKGROUND_JOBS_ENABLED:\s*"false"/);
  assert.match(compose, /AI_PATIENT_ENABLED:\s*"false"/);
  assert.match(compose, /read_only:\s*true/);
  assert.match(compose, /internal:\s*true/);
  assert.doesNotMatch(
    compose,
    /DB_PASSWORD|DWH_PASSWORD|JWT_SECRET|FIELD_ENCRYPTION_KEY/,
  );
  assert.doesNotMatch(compose, /mssql|sqlserver|azure-sql-edge/i);
});

test("Nginx preserves SPA, WebSocket, cache, and telemedicine contracts", () => {
  assert.match(nginx, /try_files \$uri \/index\.html/);
  assert.match(nginx, /proxy_set_header Upgrade \$http_upgrade/);
  assert.match(
    nginx,
    /location \/api\/ \{[\s\S]*?access_log off;[\s\S]*?Sec-WebSocket-Protocol \$http_sec_websocket_protocol/,
  );
  assert.match(nginx, /Cache-Control "public, immutable"/);
  assert.match(nginx, /location \/assets\/ \{[\s\S]*?Cache-Control "no-cache"/);
  assert.match(nginxSecurityHeaders, /camera=\(self\), microphone=\(self\)/);
  assert.match(nginx, /client_max_body_size 100m/);
  assert.match(nginx, /X-Forwarded-Proto \$proxy_forwarded_proto/);
  assert.ok(
    (
      nginx.match(/include \/etc\/nginx\/snippets\/security-headers\.conf/g) ??
      []
    ).length >= 6,
  );
  assert.match(nginxSecurityHeaders, /X-Content-Type-Options "nosniff" always/);
  assert.match(nginxSecurityHeaders, /Content-Security-Policy/);
  assert.match(nginxSecurityHeaders, /default-src 'self'/);
  assert.match(nginxSecurityHeaders, /connect-src 'self'/);
  assert.doesNotMatch(nginxSecurityHeaders, /connect-src[^;]*(?:\*|\bws:|\bhttp:)/i);
  assert.match(nginxSecurityHeaders, /object-src 'none'/);
  assert.match(nginxSecurityHeaders, /frame-ancestors 'none'/);
  assert.match(nginx, /listen 8080/);
  assert.match(serviceWorker, /isVersionedBuildAsset/);
  assert.match(serviceWorker, /networkFirstStaticAsset/);
});

test("Docker context excludes secrets and mutable operator artifacts", () => {
  const patterns = new Set(dockerignore.split(/\r?\n/));
  for (const pattern of [
    ".env*",
    "*.bak",
    "*.key",
    "*.pem",
    "**/coverage",
    "release-manifest.json",
  ]) {
    assert.equal(patterns.has(pattern), true, `missing ${pattern}`);
  }
  assert.equal(patterns.has("**/reports"), false);
  assert.equal(
    patterns.has("apps/api/src/modules/ai/evaluation/reports"),
    true,
  );
});

test("release workflow materializes target-bound Desktop metadata portably", () => {
  assert.match(releaseWorkflow, /release-version\.mjs "\$\{GITHUB_REF_NAME\}"/);
  assert.ok(
    (
      releaseWorkflow.match(
        /node deployment\/scripts\/set-desktop-version\.mjs/g,
      ) ?? []
    ).length >= 2,
  );
  assert.match(releaseWorkflow, /DESKTOP_API_ORIGIN:/);
  assert.match(releaseWorkflow, /prerelease:.*contains/);
  assert.doesNotMatch(releaseWorkflow, /mapfile[^\n]*updater_artifacts/);
  assert.match(releaseWorkflow, /while IFS= read -r -d '' artifact/);
  assert.match(releaseWorkflow, /environment: desktop-release/);
  assert.match(releaseWorkflow, /overwrite_files: false/);
  assert.match(
    releaseWorkflow,
    /gh api "repos\/\$\{GITHUB_REPOSITORY\}\/releases\/tags\/\$\{GITHUB_REF_NAME\}"/,
  );
  assert.match(releaseWorkflow, /if ! grep -q '\(HTTP 404\)'/);
  const buildJobHeader = releaseWorkflow.match(
    /  build-tauri:[\s\S]*?\n    strategy:/,
  )?.[0];
  assert.ok(buildJobHeader);
  assert.doesNotMatch(buildJobHeader, /TAURI_SIGNING_PRIVATE_KEY/);
});
