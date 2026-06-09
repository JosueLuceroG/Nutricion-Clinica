import { LabPanel } from "../domain/LabPanel";
import { LabPanelId } from "../domain/LabPanelId";
import { LabResult } from "../domain/LabResult";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { LabTestCode } from "../domain/LabTest";
import { safeDate, toIsoStringSafe } from "@services/db/safeDate";

export interface LabResultRow {
  test: LabTestCode;
  value: number;
}

export interface LabPanelRow {
  id: string;
  patient_id: string;
  taken_at: string;
  lab_name: string | null;
  notes: string | null;
  results: LabResultRow[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const rowToResults = (rows: LabResultRow[] | null | undefined): LabResult[] => {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => LabResult.from({ test: r.test, value: r.value }));
};

const resultsToRows = (results: ReadonlyArray<LabResult>): LabResultRow[] =>
  results.map((r) => ({ test: r.test, value: r.value }));

export const labPanelRowToDomain = (row: LabPanelRow): LabPanel => {
  return LabPanel.reconstitute({
    id: LabPanelId.fromUnsafe(row.id),
    patientId: PatientId.fromUnsafe(row.patient_id),
    takenAt: safeDate(row.taken_at, undefined, "lab_panel.taken_at")!,
    labName: row.lab_name,
    notes: row.notes,
    results: rowToResults(row.results),
    createdAt: safeDate(row.created_at, undefined, "lab_panel.created_at")!,
    updatedAt: safeDate(row.updated_at, undefined, "lab_panel.updated_at")!,
    deletedAt: safeDate(row.deleted_at, null, "lab_panel.deleted_at"),
  });
};

export const labPanelDomainToRow = (panel: LabPanel): LabPanelRow => {
  return {
    id: panel.id.toString(),
    patient_id: panel.patientId.toString(),
    taken_at: toIsoStringSafe(panel.takenAt, new Date().toISOString(), "lab_panel.taken_at")!,
    lab_name: panel.labName,
    notes: panel.notes,
    results: resultsToRows(panel.results),
    created_at: toIsoStringSafe(panel.createdAt, new Date().toISOString(), "lab_panel.created_at")!,
    updated_at: toIsoStringSafe(panel.updatedAt, new Date().toISOString(), "lab_panel.updated_at")!,
    deleted_at: toIsoStringSafe(panel.deletedAt, null, "lab_panel.deleted_at"),
  };
};
