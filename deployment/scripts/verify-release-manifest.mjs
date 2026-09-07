import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isReleaseVersion } from "./release-version.mjs";

const EXPECTED = {
  apiContractVersion: "v1",
  syncProtocolVersion: 2,
  dexieSchemaVersion: 33,
  oltpSchemaVersion: "039",
  dwhSchemaVersion: "dwh-08-002",
  desktopChannel: "primary",
  desktopTauriVersion: "2.11.2",
  webChannel: "secondary",
};

function unsafeRemoteHostname(hostname) {
  const host = hostname.toLowerCase();
  return (
    host.endsWith(".") ||
    /(?:^|\.)(?:example|invalid|test)$/.test(host) ||
    /^(?:.+\.)?example\.(?:com|net|org)$/.test(host) ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    /^127\./.test(host) ||
    host === "[::]" ||
    host === "[::1]" ||
    /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(host)
  );
}

function validRemoteHttpsOrigin(value) {
  try {
    const url = new URL(String(value ?? ""));
    return (
      url.protocol === "https:" &&
      !unsafeRemoteHostname(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function validDigest(value) {
  return /^sha256:[0-9a-f]{64}$/i.test(String(value ?? ""));
}

function validDigestBoundArtifact(artifact) {
  const id = String(artifact?.id ?? "");
  const digest = String(artifact?.digest ?? "");
  const suffix = `@${digest}`;
  if (!validDigest(digest) || !id.endsWith(suffix)) return false;
  const repository = id.slice(0, -suffix.length);
  return /^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,299}$/.test(repository);
}

export function verifyReleaseManifest(
  manifest,
  verificationMode = "deployment",
  expected = {},
) {
  if (!new Set(["foundation", "deployment"]).has(verificationMode)) {
    throw new Error(
      "RELEASE_MANIFEST_VERIFICATION_MODE must be foundation or deployment",
    );
  }

  const failures = [];
  const blockers = [];
  for (const [name, value] of Object.entries(EXPECTED)) {
    if (manifest[name] !== value) failures.push(`${name}: expected ${value}`);
  }
  const releaseVersion = String(manifest.releaseVersion ?? "");
  if (!isReleaseVersion(releaseVersion)) {
    failures.push("releaseVersion must be an explicit semantic version");
  } else {
    const componentVersion = releaseVersion.split("-", 1)[0];
    if (manifest.desktopVersion !== releaseVersion) {
      failures.push(
        `desktopVersion must match releaseVersion ${releaseVersion}`,
      );
    }
    for (const field of ["webVersion", "apiVersion"]) {
      if (manifest[field] !== componentVersion) {
        failures.push(
          `${field} must match releaseVersion base ${componentVersion}`,
        );
      }
    }
  }
  const gitCommit = String(manifest.gitCommit ?? "");
  if (!/^[0-9a-f]{40}$/i.test(gitCommit)) {
    failures.push("gitCommit must be a full Git SHA");
  }
  if (
    manifest.environment?.gitCommit !== gitCommit ||
    manifest.environment?.releaseVersion !== releaseVersion
  ) {
    failures.push(
      "environment identity must match releaseVersion and gitCommit",
    );
  }
  if (expected.commit && gitCommit !== expected.commit) {
    failures.push("gitCommit does not match the expected release commit");
  }
  if (expected.version && releaseVersion !== expected.version) {
    failures.push("releaseVersion does not match the expected release version");
  }
  if (
    typeof manifest.deployedAt !== "string" ||
    !Number.isFinite(Date.parse(manifest.deployedAt)) ||
    new Date(manifest.deployedAt).toISOString() !== manifest.deployedAt
  ) {
    failures.push("deployedAt must be an ISO timestamp");
  }

  const evidenceId = String(manifest.securityEvidence?.evidenceId ?? "").trim();
  if (
    manifest.securityEvidence?.secretScanStatus !== "PASS" ||
    manifest.securityEvidence?.commit !== manifest.gitCommit ||
    !/^[A-Za-z0-9][A-Za-z0-9._:/+-]{5,199}$/.test(evidenceId) ||
    /(?:^sk-|change|replace|example|placeholder|todo)/i.test(evidenceId)
  ) {
    failures.push("commit-bound secret scan evidence is required");
  }

  for (const endpoint of ["api", "web"]) {
    if (!validRemoteHttpsOrigin(manifest.publicEndpoints?.[endpoint])) {
      const issue = `${endpoint} public endpoint is not configured as a remote HTTPS origin`;
      if (verificationMode === "deployment" || expected.requireEndpoints)
        failures.push(issue);
      else blockers.push(issue);
    }
  }

  if (!validDigestBoundArtifact(manifest.artifacts?.desktop)) {
    const issue =
      "primary desktop artifact must be bound to an immutable sha256 digest";
    if (verificationMode === "deployment") failures.push(issue);
    else blockers.push(issue);
  }

  if (!manifest.artifacts || !manifest.publicEndpoints) {
    failures.push("deployment artifact and endpoint slots are required");
  } else {
    for (const channel of ["api", "web"]) {
      if (!validDigestBoundArtifact(manifest.artifacts[channel])) {
        failures.push(
          `${channel} artifact must be bound to an immutable sha256 digest`,
        );
      }
    }
  }

  const json = JSON.stringify(manifest);
  if (/PHI_DEPLOYMENT_MARKER_6f6db2/.test(json))
    failures.push("synthetic PHI marker leaked");
  if (/"(?:password|secret|apiKey|credential|privateKey)"\s*:/i.test(json)) {
    failures.push("secret-shaped key present in manifest");
  }

  return { failures, blockers };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const manifestPath = resolve(process.argv[2] ?? "release-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const verificationMode =
    process.env.RELEASE_MANIFEST_VERIFICATION_MODE ?? "deployment";
  const { failures, blockers } = verifyReleaseManifest(
    manifest,
    verificationMode,
    {
      commit: process.env.EXPECTED_RELEASE_COMMIT,
      version: process.env.EXPECTED_RELEASE_VERSION,
      requireEndpoints: process.env.REQUIRE_RELEASE_ENDPOINTS === "true",
    },
  );
  for (const blocker of blockers)
    console.warn(`[release-manifest] BLOCKED: ${blocker}`);
  if (failures.length > 0) {
    for (const failure of failures)
      console.error(`[release-manifest] ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(
      verificationMode === "foundation"
        ? `release-manifest-foundation: PASS_WITH_BLOCKERS (${blockers.length})`
        : "release-manifest-deployment: PASS",
    );
  }
}
