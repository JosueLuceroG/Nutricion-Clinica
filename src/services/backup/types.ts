export interface BackupData {
  version: 1;
  exportedAt: string;
  appVersion: string;
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
