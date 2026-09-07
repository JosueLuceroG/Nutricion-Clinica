import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRuntimeMapping,
  parseDeploymentInputs,
  validateDeploymentInputs,
} from "./validate-config.mjs";

function validInput(overrides = {}) {
  return {
    DEPLOYMENT_ENVIRONMENT: "STAGING",
    RELEASE_VERSION: "0.1.0-rc.1",
    RELEASE_COMMIT: "a".repeat(40),
    API_ARTIFACT: `registry.example.test/nutriclinica-api@sha256:${"a".repeat(64)}`,
    API_ARTIFACT_DIGEST: `sha256:${"a".repeat(64)}`,
    WEB_ARTIFACT: `registry.example.test/nutriclinica-web@sha256:${"b".repeat(64)}`,
    WEB_ARTIFACT_DIGEST: `sha256:${"b".repeat(64)}`,
    API_HOST: "https://api.staging.nutriclinica.mx",
    WEB_HOST: "https://web.staging.nutriclinica.mx",
    OLTP_TARGET: "nc_staging_oltp",
    DWH_TARGET: "nc_staging_dwh",
    SECRET_PROVIDER: "operator-approved",
    STORAGE_TARGET: "persistent-documents",
    BACKUP_TARGET: "off-host-backups",
    SECRET_SCAN_STATUS: "PASS",
    SECRET_SCAN_COMMIT: "a".repeat(40),
    SECRET_SCAN_EVIDENCE_ID: "ci-run-123-secret-scan",
    ...overrides,
  };
}

test("accepts a provider-neutral immutable deployment contract", () => {
  assert.deepEqual(validateDeploymentInputs(validInput()), {
    valid: true,
    errors: [],
  });
});

test("rejects same OLTP/DWH, mutable artifacts, and local staging URLs", () => {
  const result = validateDeploymentInputs(
    validInput({
      DWH_TARGET: "nc_staging_oltp",
      API_ARTIFACT: "nutriclinica-api:latest",
      WEB_ARTIFACT_DIGEST: "sha256:short",
      API_HOST: "http://localhost:3000",
      SECRET_PROVIDER: "<approved-provider>",
    }),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /must be different/);
  assert.match(result.errors.join("\n"), /cannot use latest/);
  assert.match(result.errors.join("\n"), /immutable sha256 digest/);
  assert.match(result.errors.join("\n"), /remote HTTPS/);
  assert.match(result.errors.join("\n"), /operator-approved identity/);
});

test("fails closed for an unknown environment or incomplete commit", () => {
  const result = validateDeploymentInputs(
    validInput({ DEPLOYMENT_ENVIRONMENT: "UNKNOWN", RELEASE_COMMIT: "abc" }),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /TEST, STAGING, or PRODUCTION/);
  assert.match(result.errors.join("\n"), /40-character/);
});

test("rejects malformed semantic release versions", () => {
  for (const RELEASE_VERSION of ["01.2.3", "1.2.3-01", "1.2.3-alpha."]) {
    const result = validateDeploymentInputs(validInput({ RELEASE_VERSION }));
    assert.equal(result.valid, false, RELEASE_VERSION);
    assert.match(result.errors.join("\n"), /semantic version/);
  }
});

test("rejects non-canonical environments and unspecified public hosts", () => {
  const result = validateDeploymentInputs(
    validInput({
      DEPLOYMENT_ENVIRONMENT: "staging",
      API_HOST: "https://[::ffff:127.0.0.1]",
    }),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /TEST, STAGING, or PRODUCTION/);
});

test("rejects IPv4-mapped IPv6 loopback public hosts", () => {
  const result = validateDeploymentInputs(
    validInput({ API_HOST: "https://[::ffff:127.0.0.1]" }),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /remote HTTPS/);
});

test("rejects reserved documentation hosts as deployment targets", () => {
  for (const API_HOST of [
    "https://api.example.test",
    "https://api.invalid",
    "https://example.com",
  ]) {
    const result = validateDeploymentInputs(validInput({ API_HOST }));
    assert.equal(result.valid, false, API_HOST);
    assert.match(result.errors.join("\n"), /remote HTTPS/);
  }
});

test("does not manufacture secret-scan attestation or accept URL credentials", () => {
  const result = validateDeploymentInputs(
    validInput({
      API_HOST: "https://user:password@api.staging.nutriclinica.mx/path",
      SECRET_SCAN_STATUS: "UNVERIFIED",
      SECRET_SCAN_COMMIT: "b".repeat(40),
    }),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /remote HTTPS/);
  assert.match(result.errors.join("\n"), /SECRET_SCAN_STATUS/);
  assert.match(result.errors.join("\n"), /SECRET_SCAN_COMMIT/);
});

test("parses an explicit non-secret input file and renders the runtime mapping", () => {
  const parsed = parseDeploymentInputs(
    "# deployment\nDEPLOYMENT_ENVIRONMENT=STAGING\nAPI_HOST=https://api.staging.nutriclinica.mx\n",
  );
  assert.equal(parsed.DEPLOYMENT_ENVIRONMENT, "STAGING");
  assert.equal(
    buildRuntimeMapping(parsed).PUBLIC_API_URL,
    "https://api.staging.nutriclinica.mx",
  );
  const runtime = buildRuntimeMapping({ RELEASE_VERSION: "0.1.0-rc.2" });
  assert.equal(runtime.DESKTOP_RELEASE_VERSION, "0.1.0-rc.2");
  assert.throws(
    () => parseDeploymentInputs("API_HOST=a\nAPI_HOST=b\n"),
    /duplicate/,
  );
  assert.throws(
    () => parseDeploymentInputs("DB_PASSWORD=do-not-store-this-here\n"),
    /unknown deployment input/,
  );
});
