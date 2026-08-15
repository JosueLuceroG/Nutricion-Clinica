import type { SensitiveAction } from "@nutriclinica/shared";

export interface BackupData {
  version: 1 | 2;
  exportedAt: string;
  appVersion: string;
  schemaVersion?: number;
  syncState?: "clean";
  tables: BackupTable[];
}

export interface BackupTable {
  name: string;
  rows: Record<string, unknown>[];
}

export interface BackupResult {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  encrypted: boolean;
}

export interface ImportResult {
  success: boolean;
  tablesImported: string[];
  rowCount: number;
  errors: string[];
}

export interface BackupAuthorization {
  action: SensitiveAction;
  grant: string;
}
