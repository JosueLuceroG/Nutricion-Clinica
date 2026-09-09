import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";

async function freePort() {
  const server = createServer();
  await new Promise((resolveListen) =>
    server.listen(0, "127.0.0.1", resolveListen),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("free port unavailable");
  await new Promise((resolveClose) => server.close(resolveClose));
  return address.port;
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Process may still be starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function expectGuardedArtifact(relativePath) {
  const child = spawn(process.execPath, [resolve(relativePath)], {
    env: {
      ...process.env,
      ENVIRONMENT_CLASS: "UNKNOWN",
      DB_PASSWORD: "",
      DWH_PASSWORD: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const exit = await new Promise((resolveExit) => {
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
  if (exit.code === 0 || !output.includes("TargetGuardError")) {
    throw new Error(
      `${relativePath} did not execute its fail-closed target guard`,
    );
  }
}

async function testJobsArtifact() {
  const child = spawn(
    process.execPath,
    [resolve("apps/api/dist-deploy/jobs.js")],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        ENVIRONMENT_CLASS: "TEST",
        WORKLOAD_ROLE: "jobs",
        BACKGROUND_JOBS_ENABLED: "true",
        RETENTION_CLEANUP_ENABLED: "true",
        RETENTION_CRON_SCHEDULE: "0 3 * * *",
        DWH_ENABLED: "false",
        DWH_SCHEDULED_LOAD_ENABLED: "false",
        AI_PATIENT_ENABLED: "false",
        AI_EGRESS_ENABLED: "false",
        EXTERNAL_SIDE_EFFECTS_MODE: "DISABLED",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const exitPromise = new Promise((resolveExit) => {
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
  const deadline = Date.now() + 5_000;
  while (
    !output.includes("[nutriclinica-jobs] started") &&
    Date.now() < deadline
  ) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  if (!output.includes("[nutriclinica-jobs] started")) {
    child.kill("SIGKILL");
    throw new Error(`jobs artifact did not start: ${output}`);
  }
  child.kill("SIGTERM");
  let timeout;
  const exit = await Promise.race([
    exitPromise,
    new Promise((resolveExit) => {
      timeout = setTimeout(
        () => resolveExit({ code: null, signal: "TIMEOUT" }),
        5_000,
      );
    }),
  ]);
  clearTimeout(timeout);
  if (exit.signal === "TIMEOUT") {
    child.kill("SIGKILL");
    throw new Error("jobs artifact did not stop after SIGTERM");
  }
  if (
    process.platform !== "win32" &&
    (exit.code !== 0 ||
      !output.includes("[nutriclinica-jobs] shutdown SIGTERM"))
  ) {
    throw new Error("jobs artifact did not complete graceful SIGTERM shutdown");
  }
}

async function testInvalidStartupFailsClosed() {
  const secret = "deployment-artifact-secret-value";
  const apiDigest = `sha256:${"a".repeat(64)}`;
  const webDigest = `sha256:${"b".repeat(64)}`;
  const child = spawn(
    process.execPath,
    [resolve("apps/api/dist-deploy/server.js")],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        ENVIRONMENT_CLASS: "STAGING",
        ENVIRONMENT_NAME: "artifact-staging",
        INSTANCE_ID: marker,
        DEPLOYMENT_ID: "artifact-deployment-1",
        RELEASE_VERSION: "0.1.0-artifact-test",
        GIT_COMMIT: "c".repeat(40),
        WORKLOAD_ROLE: "api",
        API_BIND_HOST: "127.0.0.1",
        PORT: "3000",
        TRUST_PROXY: "1",
        BACKGROUND_JOBS_ENABLED: "false",
        PUBLIC_API_URL: "https://api.example.test",
        PUBLIC_WEB_URL: "https://web.example.test",
        CORS_ORIGIN: marker,
        DB_SERVER: "sql.example.test",
        DB_NAME: "artifact_staging_oltp",
        DWH_DATABASE: "artifact_staging_dwh",
        DB_ENCRYPT: "true",
        DB_TRUST_CERT: "false",
        DB_TRUSTED: "false",
        DB_PASSWORD: "7zQ9pL2nR8vK5mX4cD6h",
        JWT_SECRET: secret,
        FIELD_ENCRYPTION_KEY: "3uN6hB9sW2kP7qZ5vC8mR1xD4jL0tF6aY9gE2iO",
        API_ARTIFACT: `registry.example.test/nutriclinica-api@${apiDigest}`,
        API_ARTIFACT_DIGEST: apiDigest,
        WEB_ARTIFACT: `registry.example.test/nutriclinica-web@${webDigest}`,
        WEB_ARTIFACT_DIGEST: webDigest,
        SECRET_SCAN_STATUS: "PASS",
        SECRET_SCAN_COMMIT: "c".repeat(40),
        SECRET_SCAN_EVIDENCE_ID: "artifact-secret-scan-123",
        EXTERNAL_SIDE_EFFECTS_MODE: "DISABLED",
        AI_EGRESS_ENABLED: "false",
        AI_PATIENT_ENABLED: "false",
        AI_SHADOW_STATE: "DISABLED",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  let timeout;
  const exit = await Promise.race([
    new Promise((resolveExit) => {
      child.once("exit", (code, signal) => resolveExit({ code, signal }));
    }),
    new Promise((resolveExit) => {
      timeout = setTimeout(
        () => resolveExit({ code: null, signal: "TIMEOUT" }),
        5_000,
      );
    }),
  ]);
  clearTimeout(timeout);
  if (exit.signal === "TIMEOUT") {
    child.kill("SIGKILL");
    throw new Error("invalid production config did not fail fast");
  }
  if (exit.code === 0 || !output.includes("fail-fast")) {
    throw new Error(
      "invalid production config did not report fail-closed startup",
    );
  }
  if (output.includes(marker) || output.includes(secret)) {
    throw new Error("invalid startup leaked synthetic PHI/secret marker");
  }
}

const port = await freePort();
const artifact = resolve("apps/api/dist-deploy/server.js");
const marker = "PHI_DEPLOYMENT_MARKER_6f6db2";
const child = spawn(process.execPath, [artifact], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    ENVIRONMENT_CLASS: "TEST",
    ENVIRONMENT_NAME: "LOCAL_DEPLOYMENT_SIMULATION",
    INSTANCE_ID: "api-artifact-test",
    RELEASE_VERSION: "0.1.0-artifact-test",
    GIT_COMMIT: "a".repeat(40),
    API_BIND_HOST: "127.0.0.1",
    PORT: String(port),
    TRUST_PROXY: "false",
    BACKGROUND_JOBS_ENABLED: "false",
    DWH_ENABLED: "false",
    RETENTION_CLEANUP_ENABLED: "false",
    AI_CERTIFICATION_STORE: "memory",
    AI_EGRESS_ENABLED: "false",
    AI_PATIENT_ENABLED: "false",
    AI_SHADOW_STATE: "DISABLED",
    EXTERNAL_SIDE_EFFECTS_MODE: "DISABLED",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const exitPromise = new Promise((resolveExit) => {
  child.once("exit", (code, signal) => resolveExit({ code, signal }));
});

let logs = "";
child.stdout.on("data", (chunk) => {
  logs += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  logs += chunk.toString();
});

try {
  const response = await waitFor(
    `http://127.0.0.1:${port}/health/live?patient=${marker}`,
    10_000,
  );
  const body = await response.text();
  if (body.includes(marker))
    throw new Error("health echoed synthetic PHI marker");
} finally {
  child.kill("SIGTERM");
}

let timeout;
const exit = await Promise.race([
  exitPromise,
  new Promise((resolveExit) => {
    timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolveExit({ code: null, signal: "TIMEOUT" });
    }, 10_000);
  }),
]);
clearTimeout(timeout);

if (exit.signal === "TIMEOUT")
  throw new Error("API did not stop after SIGTERM");
if (
  process.platform !== "win32" &&
  (exit.code !== 0 || !logs.includes("[nutriclinica-api] shutdown SIGTERM"))
) {
  throw new Error("API did not complete graceful SIGTERM shutdown");
}
if (logs.includes(marker))
  throw new Error("synthetic PHI marker leaked to startup logs");
if (/BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY/.test(logs)) {
  throw new Error("private key marker leaked to startup logs");
}

await Promise.all([
  access(resolve("apps/api/dist-deploy/dwh-schema.sql")),
  access(resolve("apps/api/dist-deploy/dwh-upgrade-08-003.sql")),
]);
await expectGuardedArtifact("apps/api/dist-deploy/migrate.js");
await expectGuardedArtifact("apps/api/dist-deploy/dwh-schema.js");
await expectGuardedArtifact("apps/api/dist-deploy/retention-backfill.js");
await testJobsArtifact();
await testInvalidStartupFailsClosed();

console.log(`api-deployment-artifact: PASS (exit=${exit.code ?? exit.signal})`);
