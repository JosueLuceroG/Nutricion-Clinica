import type { Table } from "dexie";
import { db } from "@services/db/dexieSchema";
import { cryptoService } from "@services/crypto/cryptoService";
import { sensitiveActionApi } from "@services/api/sensitiveActionApi";
import { useAuthStore } from "@store/authStore";
import { isSyncRunning } from "@services/sync/syncEnqueuer";
import { withDatabaseOperationLock } from "@services/sync/databaseOperationLock";
import { APP_VERSION } from "../../appVersion";
import type {
  BackupAuthorization,
  BackupData,
  BackupResult,
  ImportResult,
  BackupTable,
} from "./types";

const BACKUP_VERSION = 2;
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
const SYNC_MANAGED_TABLES = new Set([
  "patients",
  "consultations",
  "anthropometry",
  "lab_panels",
  "meal_plans",
  "adherence_records",
]);
const EXCLUDED_TABLES = new Set([
  "audit_events",
  "sync_queue",
  "sync_meta",
  "ai_cache",
  "telemedicina_recordings",
  ...SYNC_MANAGED_TABLES,
]);
const ACTIVE_HTML_PATTERN =
  /<(?:script|iframe|object|embed|link|meta|base|svg|math|style)\b|\son[a-z]+\s*=|(?:javascript|vbscript|data:text\/html)\s*:/i;

async function requireAuthorization(
  authorization: BackupAuthorization,
  expectedAction: BackupAuthorization["action"],
): Promise<void> {
  const user = useAuthStore.getState().user;
  if (
    !user ||
    user.rol !== "admin" ||
    authorization.action !== expectedAction
  ) {
    throw new Error("No autorizado para respaldar o restaurar la base local");
  }
  await sensitiveActionApi.consume(authorization);
}

function restorableTables(): Table[] {
  return db.tables.filter((table) => !EXCLUDED_TABLES.has(table.name));
}

async function exportTables(): Promise<BackupTable[]> {
  const tables = restorableTables();
  return db.transaction("r", [...tables, db.sync_queue], async () => {
    await assertCleanSyncQueue();
    const result: BackupTable[] = [];
    for (const table of tables) {
      const rows = await table.toArray();
      result.push({
        name: table.name,
        rows: rows as Record<string, unknown>[],
      });
    }
    return result;
  });
}

function parseBackup(json: string): { data?: BackupData; error?: string } {
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    return { error: "El archivo no es un JSON válido" };
  }
  if (
    !isRecord(input) ||
    (input.version !== 1 && input.version !== BACKUP_VERSION) ||
    !Array.isArray(input.tables)
  ) {
    return { error: "Formato de backup no reconocido" };
  }
  if (input.version === BACKUP_VERSION && input.schemaVersion !== db.verno) {
    return {
      error: `Versión de esquema incompatible: se esperaba ${db.verno}`,
    };
  }
  if (input.version === BACKUP_VERSION && input.syncState !== "clean") {
    return {
      error: "El backup no acredita un estado de sincronización limpio",
    };
  }

  const expectedNames = new Set(restorableTables().map((table) => table.name));
  const knownNames = new Set(db.tables.map((table) => table.name));
  const seenNames = new Set<string>();
  const tables: BackupTable[] = [];
  let legacySyncQueueWasClean = input.version !== 1;
  for (const rawTable of input.tables) {
    if (
      !isRecord(rawTable) ||
      typeof rawTable.name !== "string" ||
      !Array.isArray(rawTable.rows)
    ) {
      return { error: "El manifiesto de tablas es inválido" };
    }
    if (!knownNames.has(rawTable.name))
      return { error: `Tabla desconocida: ${rawTable.name}` };
    if (seenNames.has(rawTable.name))
      return { error: `Tabla duplicada: ${rawTable.name}` };
    seenNames.add(rawTable.name);
    if (input.version === 1 && rawTable.name === "sync_queue") {
      legacySyncQueueWasClean = rawTable.rows.every(
        (row) => isRecord(row) && row.status === "applied",
      );
    }
    if (EXCLUDED_TABLES.has(rawTable.name)) continue;
    if (!rawTable.rows.every(isRecord))
      return { error: `Registros inválidos en la tabla ${rawTable.name}` };
    const tableError = validateTableRows(rawTable.name, rawTable.rows);
    if (tableError) return { error: tableError };
    tables.push({ name: rawTable.name, rows: rawTable.rows });
  }
  if (
    !legacySyncQueueWasClean ||
    (input.version === 1 && !seenNames.has("sync_queue"))
  ) {
    return {
      error:
        "El backup legado contiene cambios sin sincronizar o no permite comprobarlos",
    };
  }

  const importedNames = new Set(tables.map((table) => table.name));
  const missingNames = [...expectedNames].filter(
    (name) => !importedNames.has(name),
  );
  if (missingNames.length > 0) {
    if (input.version === 1) {
      tables.push(...missingNames.map((name) => ({ name, rows: [] })));
    } else {
      return {
        error: `El backup no contiene todas las tablas requeridas: ${missingNames.join(", ")}`,
      };
    }
  }

  return {
    data: {
      version: input.version,
      exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : "",
      appVersion: typeof input.appVersion === "string" ? input.appVersion : "",
      schemaVersion:
        typeof input.schemaVersion === "number"
          ? input.schemaVersion
          : undefined,
      syncState: input.version === BACKUP_VERSION ? "clean" : undefined,
      tables,
    },
  };
}

export async function importValidatedBackup(
  data: BackupData,
  resolveTable: (name: string) => Table = (name) => db.table(name),
): Promise<ImportResult> {
  const tables = data.tables.map((table) => db.table(table.name));
  const resetTables = [db.ai_cache];
  let totalRows = 0;
  if (isSyncRunning()) {
    return {
      success: false,
      tablesImported: [],
      rowCount: 0,
      errors: [
        "Hay una sincronización en curso. Intenta restaurar cuando finalice.",
      ],
    };
  }
  try {
    await db.transaction("rw", [...tables, ...resetTables], async () => {
      for (const table of data.tables) {
        const dexieTable = resolveTable(table.name);
        await dexieTable.clear();
        if (table.rows.length > 0) await dexieTable.bulkPut(table.rows);
        totalRows += table.rows.length;
      }
      for (const table of resetTables) await table.clear();
    });
    return {
      success: true,
      tablesImported: data.tables.map((table) => table.name),
      rowCount: totalRows,
      errors: [],
    };
  } catch (error) {
    return {
      success: false,
      tablesImported: [],
      rowCount: 0,
      errors: [
        `No se aplicó ningún cambio: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

export const backupService = {
  async isEncryptedBackup(blob: Blob): Promise<boolean> {
    if (blob.size > MAX_BACKUP_BYTES) return false;
    try {
      const value: unknown = JSON.parse(await blob.text());
      return (
        isRecord(value) &&
        typeof value.ciphertext === "string" &&
        typeof value.iv === "string" &&
        typeof value.salt === "string"
      );
    } catch {
      return false;
    }
  },

  async exportBackup(
    authorization: BackupAuthorization,
    password?: string,
  ): Promise<BackupResult> {
    return withDatabaseOperationLock(async () => {
      await assertCleanSyncQueue();
      await requireAuthorization(authorization, "backup.export");
      const tables = await exportTables();
      const data: BackupData = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        schemaVersion: db.verno,
        syncState: "clean",
        tables,
      };
      const json = JSON.stringify(data, null, 2);
      const encrypted = Boolean(password);
      const content = password
        ? await cryptoService.encryptToJson(json, password)
        : json;
      const blob = new Blob([content], {
        type: encrypted ? "application/octet-stream" : "application/json",
      });
      if (blob.size > MAX_BACKUP_BYTES) {
        throw new Error("El backup excede el límite portátil de 50 MB");
      }
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const ext = encrypted ? ".enc" : ".json";
      return {
        blob,
        fileName: `nutriclinica-backup-${timestamp}${ext}`,
        sizeBytes: blob.size,
        encrypted,
      };
    });
  },

  async importBackup(
    blob: Blob,
    authorization: BackupAuthorization,
    password?: string,
  ): Promise<ImportResult> {
    if (blob.size > MAX_BACKUP_BYTES) {
      return {
        success: false,
        tablesImported: [],
        rowCount: 0,
        errors: ["El backup excede el límite de 50 MB"],
      };
    }

    const text = await blob.text();
    let json: string;
    if (password) {
      try {
        json = await cryptoService.decryptFromJson(text, password);
      } catch {
        return {
          success: false,
          tablesImported: [],
          rowCount: 0,
          errors: ["Contraseña incorrecta o archivo corrupto"],
        };
      }
    } else {
      json = text;
    }

    const parsed = parseBackup(json);
    if (!parsed.data) {
      return {
        success: false,
        tablesImported: [],
        rowCount: 0,
        errors: [parsed.error ?? "Backup inválido"],
      };
    }
    const data = parsed.data;
    return withDatabaseOperationLock(async () => {
      if (isSyncRunning()) {
        return {
          success: false,
          tablesImported: [],
          rowCount: 0,
          errors: [
            "Hay una sincronización en curso. Intenta restaurar cuando finalice.",
          ],
        };
      }
      await assertCleanSyncQueue();
      await requireAuthorization(authorization, "backup.restore");
      return importValidatedBackup(data);
    });
  },
};

async function assertCleanSyncQueue(): Promise<void> {
  const unsettled = await db.sync_queue
    .filter((item) => item.status !== "applied")
    .count();
  if (unsettled > 0) {
    throw new Error(
      "Sincroniza o resuelve todos los cambios pendientes antes de continuar",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateTableRows(
  tableName: string,
  rows: Record<string, unknown>[],
): string | null {
  const table = db.table(tableName);
  const keyPath = table.schema.primKey.keyPath;
  if (!keyPath)
    return `La tabla ${tableName} no tiene una clave primaria portable`;
  const seenKeys = new Set<string>();
  for (const row of rows) {
    if (typeof keyPath === "string" && !hasValidKey(row[keyPath])) {
      return `Registro sin clave primaria válida en la tabla ${tableName}`;
    }
    if (
      Array.isArray(keyPath) &&
      keyPath.some((key) => !hasValidKey(row[key]))
    ) {
      return `Registro sin clave primaria válida en la tabla ${tableName}`;
    }
    const serializedKey = JSON.stringify(
      Array.isArray(keyPath) ? keyPath.map((key) => row[key]) : row[keyPath],
    );
    if (seenKeys.has(serializedKey)) {
      return `Clave primaria duplicada en la tabla ${tableName}`;
    }
    seenKeys.add(serializedKey);
    if (
      (tableName === "documents" || tableName === "generated_reports") &&
      typeof row.content_html === "string" &&
      ACTIVE_HTML_PATTERN.test(row.content_html)
    ) {
      return `Contenido HTML activo no permitido en la tabla ${tableName}`;
    }
  }
  return null;
}

function hasValidKey(value: unknown): boolean {
  return (
    (typeof value === "string" && value.length > 0) || typeof value === "number"
  );
}

export type BackupService = typeof backupService;
