import { createHash } from "node:crypto";

export const STANDALONE_CONTRACT_VERSION = "standalone-windows-v1";
export const FULL_INSTALL_BACKUP_FORMAT = "nutriclinica-full-install-v1";
export const OLTP_SCHEMA_VERSION = "039";
export const DWH_SCHEMA_VERSION = "dwh-08-003";

export const BACKUP_CLASSIFICATIONS = Object.freeze([
  "MUST_BACKUP",
  "REBUILDABLE",
  "MUST_NOT_BACKUP",
  "OPTIONAL",
]);

/**
 * Canonical inventory. The entries describe ownership and recovery behavior,
 * not the contents of a backup. A manifest contains hashes and metadata only.
 */
export const FULL_INSTALL_INVENTORY = Object.freeze([
  {
    id: "oltp.database",
    classification: "MUST_BACKUP",
    owner: "server",
    restore: "sql-native",
    notes: "Authoritative clinical and operational records.",
  },
  {
    id: "dwh.database",
    classification: "MUST_BACKUP",
    owner: "server",
    restore: "sql-native-or-rebuild-from-oltp",
    notes: "Historical analytics; rebuild remains possible from OLTP and ETL.",
  },
  {
    id: "files.documents",
    classification: "MUST_BACKUP",
    owner: "server",
    restore: "copy-and-hash-verify",
    notes: "Clinical documents and generated files.",
  },
  {
    id: "files.telemedicina_recordings",
    classification: "MUST_BACKUP",
    owner: "server",
    restore: "copy-and-hash-verify",
    notes: "Encrypted recordings remain outside SQL row backups.",
  },
  {
    id: "rag.knowledge_documents",
    classification: "MUST_BACKUP",
    owner: "server",
    restore: "sql-native",
    notes: "Governed source documents, approvals and versions.",
  },
  {
    id: "rag.retrieval_index",
    classification: "REBUILDABLE",
    owner: "server",
    restore: "rebuild-from-governed-documents",
    notes: "Never treated as the authority for clinical content.",
  },
  {
    id: "ai.memory",
    classification: "MUST_BACKUP",
    owner: "server",
    restore: "sql-native-when-sql-store",
    notes: "SQL mode is recoverable; memory mode is explicitly ephemeral.",
  },
  {
    id: "observability.telemetry",
    classification: "OPTIONAL",
    owner: "server",
    restore: "sql-native-when-configured",
    notes: "No raw PHI is allowed in the manifest or operator logs.",
  },
  {
    id: "desktop.dexie_local_only",
    classification: "MUST_BACKUP",
    owner: "desktop",
    restore: "encrypted-dexie-export",
    notes: "Non-server-managed local data only.",
  },
  {
    id: "desktop.sync_outbox",
    classification: "MUST_BACKUP",
    owner: "desktop",
    restore: "preserve-or-replay-after-emergency-restore",
    notes: "A clean snapshot requires no unsettled operations.",
  },
  {
    id: "desktop.sync_cursors_and_conflicts",
    classification: "MUST_BACKUP",
    owner: "desktop",
    restore: "encrypted-dexie-export",
    notes: "Required to avoid silent divergence after recovery.",
  },
  {
    id: "desktop.session_drafts",
    classification: "MUST_NOT_BACKUP",
    owner: "desktop",
    restore: "discard-at-session-boundary",
    notes: "Preserves the existing session isolation policy.",
  },
  {
    id: "web.build",
    classification: "REBUILDABLE",
    owner: "release",
    restore: "reinstall-from-release-digest",
    notes: "Static artifact is reproducible and never contains secrets.",
  },
  {
    id: "server.secrets",
    classification: "MUST_NOT_BACKUP",
    owner: "server",
    restore: "re-provision-from-protected-secret-store",
    notes: "Secret values are never copied, hashed into manifests or logged.",
  },
  {
    id: "server.logs",
    classification: "OPTIONAL",
    owner: "server",
    restore: "not-required",
    notes: "Operational logs rotate separately and must be PHI-safe.",
  },
]);

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const SHA256 = /^sha256:[0-9a-f]{64}$/i;
const SECRET_KEY =
  /(?:password|secret|token|credential|api[_-]?key|private[_-]?key)/i;
const PHI_MARKER = /PHI_DEPLOYMENT_MARKER_6f6db2/;

export function memoryClassification(store) {
  return store === "sql" ? "MUST_BACKUP" : "REBUILDABLE";
}

export function isSafeRelativePath(value) {
  if (typeof value !== "string" || !value || value.length > 512) return false;
  if (value.includes("\\") || value.includes(":") || value.includes("\0"))
    return false;
  if (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.includes("..") ||
    value.includes("//")
  )
    return false;
  return !/[\u0000-\u001f]/.test(value);
}

function iso(value, field) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO timestamp`);
  }
  const normalized = new Date(value).toISOString();
  if (normalized !== value) throw new Error(`${field} must be canonical ISO`);
  return value;
}

function safeId(value, field) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) {
    throw new Error(`${field} contains an unsafe identifier`);
  }
  return value;
}

function assertNoSecrets(value, path = "manifest") {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries())
      assertNoSecrets(item, `${path}[${index}]`);
    return;
  }
  if (!value || typeof value !== "object") {
    if (
      typeof value === "string" &&
      (SECRET_KEY.test(path) || PHI_MARKER.test(value))
    ) {
      throw new Error(`${path} contains forbidden secret or PHI content`);
    }
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEY.test(key))
      throw new Error(`${path}.${key} is not allowed in a manifest`);
    assertNoSecrets(item, `${path}.${key}`);
  }
}

function validateFile(file, index) {
  if (!file || typeof file !== "object")
    throw new Error(`files[${index}] is invalid`);
  if (!isSafeRelativePath(file.relativePath))
    throw new Error(`files[${index}].relativePath is unsafe`);
  if (!SHA256.test(String(file.sha256 ?? "")))
    throw new Error(`files[${index}].sha256 is invalid`);
  if (!Number.isSafeInteger(file.sizeBytes) || file.sizeBytes < 0) {
    throw new Error(`files[${index}].sizeBytes is invalid`);
  }
  safeId(String(file.component), `files[${index}].component`);
}

export function buildFullInstallManifest(input = {}) {
  const manifest = {
    format: FULL_INSTALL_BACKUP_FORMAT,
    contractVersion: STANDALONE_CONTRACT_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
    release: {
      version: input.releaseVersion ?? "0.0.0-dev",
      appVersion: input.appVersion ?? "0.0.0-dev",
      gitCommit: input.gitCommit ?? "UNKNOWN",
    },
    schemas: {
      oltp: input.oltpSchemaVersion ?? OLTP_SCHEMA_VERSION,
      dwh: input.dwhSchemaVersion ?? DWH_SCHEMA_VERSION,
      dexie: input.dexieSchemaVersion ?? 33,
      sync: input.syncSchemaVersion ?? 2,
    },
    instance: {
      id: input.instanceId ?? "standalone-local",
      environmentClass: input.environmentClass ?? "LOCAL",
      oltpDatabase: input.oltpDatabase ?? "redacted-by-policy",
      dwhDatabase: input.dwhDatabase ?? "redacted-by-policy",
    },
    snapshot: {
      mode: input.snapshotMode ?? "clean",
      syncState: input.syncState ?? "clean",
      outboxState: input.outboxState ?? "empty",
    },
    inventory: FULL_INSTALL_INVENTORY,
    files: input.files ?? [],
    components: input.components ?? [],
  };
  assertNoSecrets(manifest);
  return manifest;
}

export function validateFullInstallManifest(manifest) {
  const errors = [];
  try {
    if (!manifest || typeof manifest !== "object")
      throw new Error("manifest is not an object");
    if (manifest.format !== FULL_INSTALL_BACKUP_FORMAT)
      throw new Error("unsupported backup format");
    if (manifest.contractVersion !== STANDALONE_CONTRACT_VERSION)
      throw new Error("unsupported standalone contract");
    iso(manifest.createdAt, "createdAt");
    safeId(manifest.release?.version, "release.version");
    safeId(manifest.release?.appVersion, "release.appVersion");
    if (
      manifest.release?.gitCommit !== "UNKNOWN" &&
      !/^[0-9a-f]{40}$/i.test(manifest.release?.gitCommit ?? "")
    ) {
      throw new Error("release.gitCommit must be a full Git SHA or UNKNOWN");
    }
    if (manifest.schemas?.oltp !== OLTP_SCHEMA_VERSION)
      throw new Error("OLTP schema version mismatch");
    if (manifest.schemas?.dwh !== DWH_SCHEMA_VERSION)
      throw new Error("DWH schema version mismatch");
    if (manifest.schemas?.dexie !== 33)
      throw new Error("Dexie schema version mismatch");
    if (manifest.schemas?.sync !== 2)
      throw new Error("sync schema version mismatch");
    safeId(manifest.instance?.id, "instance.id");
    if (
      !(
        "LOCAL" === manifest.instance?.environmentClass ||
        "TEST" === manifest.instance?.environmentClass
      )
    ) {
      throw new Error("standalone manifest must identify LOCAL or TEST");
    }
    if (!new Set(["clean", "emergency"]).has(manifest.snapshot?.mode))
      throw new Error("snapshot.mode is invalid");
    if (
      manifest.snapshot.mode === "clean" &&
      (manifest.snapshot.syncState !== "clean" ||
        manifest.snapshot.outboxState !== "empty")
    ) {
      throw new Error("clean snapshot requires clean sync and empty outbox");
    }
    if (!Array.isArray(manifest.files))
      throw new Error("files must be an array");
    manifest.files.forEach(validateFile);
    if (!Array.isArray(manifest.components))
      throw new Error("components must be an array");
    for (const [index, component] of manifest.components.entries()) {
      safeId(component?.id, `components[${index}].id`);
      if (
        !new Set(["present", "absent", "rebuilt", "ephemeral"]).has(
          component?.status,
        )
      ) {
        throw new Error(`components[${index}].status is invalid`);
      }
    }
    assertNoSecrets(manifest);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return { valid: errors.length === 0, errors };
}

export function manifestDigest(manifest) {
  const validation = validateFullInstallManifest(manifest);
  if (!validation.valid)
    throw new Error(
      `cannot hash invalid manifest: ${validation.errors.join("; ")}`,
    );
  return `sha256:${createHash("sha256").update(JSON.stringify(manifest), "utf8").digest("hex")}`;
}
