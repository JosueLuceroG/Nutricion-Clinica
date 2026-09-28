import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL(".", import.meta.url);
async function script(name) {
  return readFile(new URL(name, root), "utf8");
}

test("Windows package exposes the complete operator lifecycle", async () => {
  for (const name of [
    "common.ps1",
    "build-package.ps1",
    "install.ps1",
    "supervisor.ps1",
    "start.ps1",
    "stop.ps1",
    "restart.ps1",
    "status.ps1",
    "backup.ps1",
    "restore.ps1",
    "uninstall.ps1",
  ]) {
    await script(name);
  }
  const install = await script("install.ps1");
  assert.match(install, /PreflightEntry/);
  assert.match(install, /MigrateEntry/);
  assert.match(install, /DwhSchemaEntry/);
  assert.match(install, /Initialize-StandaloneConfiguration/);
  assert.match(install, /pwsh\.exe/);
  assert.match(install, /Register-ScheduledTask/);
  assert.match(install, /New-ScheduledTaskTrigger/);
  const environment = await script("standalone.env.example");
  assert.match(environment, /^STANDALONE_MODE=true$/m);

  const builder = await script("build-package.ps1");
  assert.match(builder, /inject-workspace-packages=true/);
  assert.match(builder, /node-linker=hoisted/);
  assert.doesNotMatch(builder, /deploy[^\n]*--legacy/);
  assert.match(builder, /node_modules\\\.modules\.yaml/);

  const supervisor = await script("supervisor.ps1");
  assert.match(supervisor, /api/);
  assert.match(supervisor, /jobs/);
  assert.match(supervisor, /Backoff/);
  assert.match(supervisor, /StartedAt/);
  assert.match(supervisor, /TotalSeconds/);

  const backup = await script("backup.ps1");
  assert.match(backup, /DesktopBackupFile/);
  assert.match(backup, /SnapshotMode/);
  assert.match(backup, /manifest-cli\.mjs/);
  assert.match(backup, /manifest\.digest/);
  const restore = await script("restore.ps1");
  assert.match(restore, /ConfirmRestore/);
  assert.match(restore, /RollbackPrepared/);
  assert.match(restore, /RollbackBackupPath/);
  assert.match(restore, /digest-input/);
  assert.match(restore, /RESTORE VERIFYONLY/);
  assert.match(restore, /checksum/i);
});

test("uninstall script does not delete clinical data or backup roots", async () => {
  const uninstall = await script("uninstall.ps1");
  assert.doesNotMatch(
    uninstall,
    /Remove-Item[^\n]*(DataRoot|BackupRoot|LogRoot)/i,
  );
  assert.match(uninstall, /never remove DataRoot, BackupRoot or LogRoot/i);
});
