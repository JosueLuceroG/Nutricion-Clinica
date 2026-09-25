import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  BACKUP_CLASSIFICATIONS,
  FULL_INSTALL_INVENTORY,
  buildFullInstallManifest,
  manifestDigest,
  memoryClassification,
  validateFullInstallManifest,
} from "./contract.mjs";

const execFileAsync = promisify(execFile);
const manifestCli = fileURLToPath(
  new URL("./manifest-cli.mjs", import.meta.url),
);

function validManifest(overrides = {}) {
  return buildFullInstallManifest({
    releaseVersion: "0.1.0-standalone.test",
    appVersion: "0.1.0",
    gitCommit: "a".repeat(40),
    instanceId: "test-instance",
    files: [
      {
        component: "oltp.database",
        relativePath: "sql/oltp.bak",
        sizeBytes: 12,
        sha256: `sha256:${"b".repeat(64)}`,
      },
    ],
    components: [{ id: "oltp.database", status: "present" }],
    ...overrides,
  });
}

test("full-install manifest is valid and has a stable digest", () => {
  const manifest = validManifest();
  assert.deepEqual(validateFullInstallManifest(manifest), {
    valid: true,
    errors: [],
  });
  assert.match(manifestDigest(manifest), /^sha256:[0-9a-f]{64}$/);
});

test("clean snapshots cannot hide an unsettled outbox", () => {
  const result = validateFullInstallManifest(
    validManifest({
      snapshotMode: "clean",
      syncState: "dirty",
      outboxState: "pending",
    }),
  );
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /clean snapshot/);
});

test("manifest rejects secret-shaped fields and traversal paths", () => {
  const secret = validManifest();
  secret.secrets = { password: "must-not-appear" };
  assert.equal(validateFullInstallManifest(secret).valid, false);

  const traversal = validManifest();
  traversal.files[0].relativePath = "../outside.bak";
  assert.equal(validateFullInstallManifest(traversal).valid, false);

  const readableWindowsName = validManifest();
  readableWindowsName.files[0].relativePath =
    "files/documents/Patient note 01.pdf";
  assert.equal(validateFullInstallManifest(readableWindowsName).valid, true);
});

test("inventory covers the local state boundary and memory policy", () => {
  assert.deepEqual(BACKUP_CLASSIFICATIONS, [
    "MUST_BACKUP",
    "REBUILDABLE",
    "MUST_NOT_BACKUP",
    "OPTIONAL",
  ]);
  assert.equal(
    FULL_INSTALL_INVENTORY.find((item) => item.id === "desktop.session_drafts")
      ?.classification,
    "MUST_NOT_BACKUP",
  );
  assert.equal(memoryClassification("sql"), "MUST_BACKUP");
  assert.equal(memoryClassification("memory"), "REBUILDABLE");
});

test("manifest CLI writes a digest and rejects a changed digest", async () => {
  const root = await mkdtemp(join(tmpdir(), "nutriclinica-manifest-"));
  try {
    const input = join(root, "input.json");
    const output = join(root, "manifest.json");
    const digest = join(root, "manifest.digest");
    const validation = join(root, "validation.json");
    await writeFile(
      input,
      JSON.stringify({
        releaseVersion: "0.1.0-standalone.test",
        appVersion: "0.1.0",
        gitCommit: "a".repeat(40),
        instanceId: "test-instance",
        files: [
          {
            component: "oltp.database",
            relativePath: "sql/oltp.bak",
            sizeBytes: 12,
            sha256: `sha256:${"b".repeat(64)}`,
          },
        ],
        components: [{ id: "oltp.database", status: "present" }],
      }),
      "utf8",
    );

    await execFileAsync(process.execPath, [
      manifestCli,
      "build",
      "--input",
      input,
      "--output",
      output,
      "--digest-output",
      digest,
    ]);
    const expectedDigest = (await readFile(digest, "utf8")).trim();
    assert.match(expectedDigest, /^sha256:[0-9a-f]{64}$/);

    await execFileAsync(process.execPath, [
      manifestCli,
      "validate",
      "--input",
      output,
      "--output",
      validation,
      "--digest-input",
      digest,
    ]);
    await writeFile(digest, `sha256:${"0".repeat(64)}\n`, "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, [
        manifestCli,
        "validate",
        "--input",
        output,
        "--output",
        validation,
        "--digest-input",
        digest,
      ]),
      (error) => error?.code === 1 && /digest mismatch/.test(error.stderr),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
