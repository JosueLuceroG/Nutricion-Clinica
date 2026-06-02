import { LabPanel } from "../domain/LabPanel";
import { LabPanelId } from "../domain/LabPanelId";
import { LabResult } from "../domain/LabResult";
import { PatientId } from "@modules/patient/domain/PatientId";
import type { LabTestCode } from "../domain/LabTest";

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

const rowToResults = (rows: LabResultRow[]) =>
  rows.map((r) => LabResult.from({ test: r.test, value: r.value }));

const resultsToRows = (results: ReadonlyArray<LabResult>): LabResultRow[] =>
  results.map((r) => ({ test: r.test, value: r.value }));

export const labPanelRowToDomain = (row: LabPanelRow): LabPanel => {
  return LabPanel.reconstitute({
    id: LabPanelId.fromUnsafe(row.id),
    patientId: PatientId.fromUnsafe(row.patient_id),
    takenAt: new Date(row.taken_at),
    labName: row.lab_name,
    notes: row.notes,
    results: rowToResults(row.results),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  });
};

export const labPanelDomainToRow = (panel: LabPanel): LabPanelRow => {
  return {
    id: panel.id.toString(),
    patient_id: panel.patientId.toString(),
    taken_at: panel.takenAt.toISOString(),
    lab_name: panel.labName,
    notes: panel.notes,
    results: resultsToRows(panel.results),
    created_at: panel.createdAt.toISOString(),
    updated_at: panel.updatedAt.toISOString(),
    deleted_at: panel.deletedAt ? panel.deletedAt.toISOString() : null,
  };
};
