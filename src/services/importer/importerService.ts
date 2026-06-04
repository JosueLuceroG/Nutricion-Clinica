import { parseCsv, CsvParseError } from "./csvParser";
import {
  mapHeaders,
  mapRow,
  toPatientCreate,
  validateRequiredHeaders,
  type MappedRow,
} from "./patientImporter";
import { Patient } from "@modules/patient/domain/Patient";
import type { PatientRepository } from "@modules/patient/domain/PatientRepository";

export interface ImporterPreview {
  headers: string[];
  valid: MappedRow[];
  invalid: MappedRow[];
  missingRequiredColumns: string[];
  totalRows: number;
}

export interface ImporterApplyResult {
  imported: number;
  failed: Array<{ rowNumber: number; errors: string[] }>;
}

/**
 * Servicio de importación de pacientes desde CSV.
 *
 * Flujo:
 *  1. `preview(csv)` parsea + valida sin persistir; útil para mostrar al usuario
 *     los errores antes de confirmar.
 *  2. `apply(csv)` parsea + valida + persiste usando el `PatientRepository` inyectado.
 *
 * La separación `preview`/`apply` cumple la regla RN-IMP-01: la importación CSV
 * no se aplica de forma automática (spec §24.7).
 */
export class PatientImporterService {
  constructor(private readonly repo: PatientRepository) {}

  preview(csv: string): ImporterPreview {
    const parsed = parseCsv(csv);
    const headerCheck = validateRequiredHeaders(parsed.headers);
    if (!headerCheck.ok) {
      return {
        headers: parsed.headers,
        valid: [],
        invalid: [],
        missingRequiredColumns: headerCheck.missing,
        totalRows: parsed.totalRows,
      };
    }
    const headerMap = mapHeaders(parsed.headers);
    const mapped: MappedRow[] = parsed.rows.map((values, i) => mapRow(i, values, headerMap));
    return {
      headers: parsed.headers,
      valid: mapped.filter((r) => r.mapped !== null),
      invalid: mapped.filter((r) => r.mapped === null),
      missingRequiredColumns: [],
      totalRows: parsed.totalRows,
    };
  }

  async apply(csv: string): Promise<ImporterApplyResult> {
    const previewResult = this.preview(csv);
    if (previewResult.missingRequiredColumns.length > 0) {
      throw new Error(
        `Faltan columnas obligatorias: ${previewResult.missingRequiredColumns.join(", ")}`,
      );
    }

    let imported = 0;
    const failed: ImporterApplyResult["failed"] = [];

    for (const row of previewResult.valid) {
      if (!row.mapped) continue;
      try {
        const create = toPatientCreate(row);
        const patient = Patient.create(create);
        await this.repo.save(patient);
        imported++;
      } catch (err) {
        failed.push({
          rowNumber: row.rowNumber,
          errors: [err instanceof Error ? err.message : String(err)],
        });
      }
    }

    for (const row of previewResult.invalid) {
      failed.push({ rowNumber: row.rowNumber, errors: row.errors });
    }

    return { imported, failed };
  }
}

export { CsvParseError };
