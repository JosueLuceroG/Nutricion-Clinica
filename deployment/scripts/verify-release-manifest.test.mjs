import assert from "node:assert/strict";
import test from "node:test";
import { verifyReleaseManifest } from "./verify-release-manifest.mjs";

const digestA = `sha256:${"a".repeat(64)}`;
const digestB = `sha256:${"b".repeat(64)}`;

function manifest(overrides = {}) {
  return {
    releaseVersion: "0.1.0-rc.1",
    gitCommit: "c".repeat(40),
    environment: {
      releaseVersion: "0.1.0-rc.1",
      gitCommit: "c".repeat(40),
    },
    desktopVersion: "0.1.0-rc.1",
    desktopTauriVersion: "2.11.2",
    webVersion: "0.1.0",
    apiVersion: "0.1.0",
    apiContractVersion: "v1",
    syncProtocolVersion: 2,
    dexieSchemaVersion: 33,
    oltpSchemaVersion: "039",
    dwhSchemaVersion: "dwh-08-002",
    desktopChannel: "primary",
    webChannel: "secondary",
    publicEndpoints: { api: "UNCONFIGURED", web: "UNCONFIGURED" },
    artifacts: {
      desktop: { id: "UNSET", digest: "UNSET" },
      api: { id: `registry.example/api@${digestA}`, digest: digestA },
      web: { id: `registry.example/web@${digestB}`, digest: digestB },
    },
    securityEvidence: {
      secretScanStatus: "PASS",
      commit: "c".repeat(40),
      evidenceId: "github-run-123-1",
    },
    deployedAt: "2026-08-28T12:00:00.000Z",
    ...overrides,
  };
}

test("foundation accepts only explicit endpoint and desktop blockers", () => {
  const result = verifyReleaseManifest(manifest(), "foundation");
  assert.deepEqual(result.failures, []);
  assert.equal(result.blockers.length, 3);
});

test("deployment mode fails closed for foundation blockers", () => {
  const result = verifyReleaseManifest(manifest(), "deployment");
  assert.equal(result.blockers.length, 0);
  assert.equal(result.failures.length, 3);
});

test("publication preflight requires endpoints while desktop remains blocked", () => {
  const result = verifyReleaseManifest(manifest(), "foundation", {
    requireEndpoints: true,
  });
  assert.equal(result.blockers.length, 1);
  assert.equal(result.failures.length, 2);
});

test("rejects unbound artifacts, URL credentials, and empty evidence", () => {
  const value = manifest({
    publicEndpoints: {
      api: "https://user:password@api.staging.nutriclinica.mx/path",
      web: "https://web.staging.nutriclinica.mx",
    },
    artifacts: {
      desktop: { id: `desktop-installer@${digestA}`, digest: digestA },
      api: { id: "registry.example/api:mutable", digest: digestA },
      web: { id: `registry.example/web@${digestB}`, digest: digestB },
    },
    securityEvidence: {
      secretScanStatus: "PASS",
      commit: "c".repeat(40),
      evidenceId: "",
    },
  });
  const result = verifyReleaseManifest(value, "deployment");
  assert.match(result.failures.join("\n"), /remote HTTPS origin/);
  assert.match(result.failures.join("\n"), /api artifact/);
  assert.match(result.failures.join("\n"), /secret scan evidence/);
});

test("rejects unspecified and loopback public endpoints", () => {
  const value = manifest({
    publicEndpoints: {
      api: "https://0.0.0.0",
      web: "https://127.0.0.2",
    },
  });
  const result = verifyReleaseManifest(value, "foundation");
  assert.equal(
    result.blockers.filter((blocker) => blocker.includes("HTTPS origin"))
      .length,
    2,
  );
});

test("rejects reserved documentation endpoints", () => {
  const value = manifest({
    publicEndpoints: {
      api: "https://api.example.test",
      web: "https://web.invalid",
    },
  });
  const result = verifyReleaseManifest(value, "foundation");
  assert.equal(
    result.blockers.filter((blocker) => blocker.includes("HTTPS origin"))
      .length,
    2,
  );
});

test("rejects release identity and component version drift", () => {
  const value = manifest({
    apiVersion: "0.2.0",
    environment: {
      releaseVersion: "0.1.0-rc.1",
      gitCommit: "d".repeat(40),
    },
  });
  const result = verifyReleaseManifest(value, "foundation", {
    commit: "e".repeat(40),
    version: "0.1.0",
  });

  assert.match(result.failures.join("\n"), /apiVersion/);
  assert.match(result.failures.join("\n"), /environment identity/);
  assert.match(result.failures.join("\n"), /expected release commit/);
  assert.match(result.failures.join("\n"), /expected release version/);
});

test("rejects malformed release SemVer", () => {
  const value = manifest({
    releaseVersion: "0.1.0-01",
    desktopVersion: "0.1.0-01",
    environment: {
      releaseVersion: "0.1.0-01",
      gitCommit: "c".repeat(40),
    },
  });
  assert.match(
    verifyReleaseManifest(value, "foundation").failures.join("\n"),
    /semantic version/,
  );
});
