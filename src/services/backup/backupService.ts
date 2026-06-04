import { db } from "@services/db/dexieSchema";
import { cryptoService } from "@services/crypto/cryptoService";
import type { BackupData, BackupResult, ImportResult, BackupTable } from "./types";

const APP_VERSION = "0.1.0";

async function exportTables(): Promise<BackupTable[]> {
  const tableNames = db.tables.map((t) => t.name);
  const tables: BackupTable[] = [];
  for (const name of tableNames) {
    const rows = await db.table(name).toArray();
    tables.push({ name, rows: rows as Record<string, unknown>[] });
  }
  return tables;
}

async function importTables(data: BackupData): Promise<ImportResult> {
  const errors: string[] = [];
  let totalRows = 0;
  const imported: string[] = [];

  for (const table of data.tables) {
    try {
      const dexieTable = db.table(table.name);
      if (!dexieTable) {
        errors.push(`Tabla "${table.name}" no existe en el esquema actual`);
        continue;
      }
      await dexieTable.clear();
      if (table.rows.length > 0) {
        await dexieTable.bulkPut(table.rows);
      }
      totalRows += table.rows.length;
      imported.push(table.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Error al importar "${table.name}": ${msg}`);
    }
  }

  return { success: errors.length === 0, tablesImported: imported, rowCount: totalRows, errors };
}

export const backupService = {
  async exportBackup(password?: string): Promise<BackupResult> {
    const tables = await exportTables();
    const data: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      tables,
    };
    const json = JSON.stringify(data, null, 2);
    const encrypted = !!password;
    const content = password ? await cryptoService.encryptToJson(json, password) : json;
    const blob = new Blob([content], { type: encrypted ? "application/octet-stream" : "application/json" });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const ext = encrypted ? ".enc" : ".json";
    return {
      blob,
      fileName: `nutriclinica-backup-${timestamp}${ext}`,
      sizeBytes: blob.size,
      encrypted,
    };
  },

  async importBackup(blob: Blob, password?: string): Promise<ImportResult> {
    const text = await blob.text();
    let json: string;
    if (password) {
      try {
        json = await cryptoService.decryptFromJson(text, password);
      } catch {
        return { success: false, tablesImported: [], rowCount: 0, errors: ["Contraseña incorrecta o archivo corrupto"] };
      }
    } else {
      json = text;
    }

    let data: BackupData;
    try {
      data = JSON.parse(json);
    } catch {
      return { success: false, tablesImported: [], rowCount: 0, errors: ["El archivo no es un JSON válido"] };
    }

    if (!data.version || !data.tables || !Array.isArray(data.tables)) {
      return { success: false, tablesImported: [], rowCount: 0, errors: ["Formato de backup no reconocido"] };
    }

    return importTables(data);
  },
};

export type BackupService = typeof backupService;
