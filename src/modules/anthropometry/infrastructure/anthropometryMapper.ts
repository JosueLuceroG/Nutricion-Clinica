import type { Anthropometry, AnthropometryProps, CircumferenceSet, SkinfoldSet } from "../domain/Anthropometry";
import { Anthropometry as AnthropometryEntity } from "../domain/Anthropometry";
import { AnthropometryId } from "../domain/AnthropometryId";
import { PatientId } from "@modules/patient/domain/PatientId";
import { Weight, Height, Circumference, Skinfold } from "../domain/Measurements";

export interface AnthropometryRow {
  id: string;
  patient_id: string;
  measured_at: string;
  weight_kg: number;
  height_m: number;
  circumferences: Record<string, number> | null;
  skinfolds: Record<string, number> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const deserializeCircumferences = (raw: Record<string, number> | null): CircumferenceSet => {
  if (!raw) return {};
  const out: Record<string, Circumference> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      try {
        out[k] = Circumference.fromCm(v);
      } catch {
        // skip invalid
      }
    }
  }
  return out as CircumferenceSet;
};

const deserializeSkinfolds = (raw: Record<string, number> | null): SkinfoldSet => {
  if (!raw) return {};
  const out: Record<string, Skinfold> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      try {
        out[k] = Skinfold.fromMm(v);
      } catch {
        // skip invalid
      }
    }
  }
  return out as SkinfoldSet;
};

const serializeCircumferences = (set: CircumferenceSet): Record<string, number> | null => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(set)) {
    if (v) out[k] = v.toCm();
  }
  return Object.keys(out).length > 0 ? out : null;
};

const serializeSkinfolds = (set: SkinfoldSet): Record<string, number> | null => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(set)) {
    if (v) out[k] = v.toMm();
  }
  return Object.keys(out).length > 0 ? out : null;
};

export const anthropometryRowToDomain = (row: AnthropometryRow): Anthropometry => {
  return AnthropometryEntity.reconstitute({
    id: AnthropometryId.fromUnsafe(row.id),
    patientId: PatientId.fromUnsafe(row.patient_id),
    measuredAt: new Date(row.measured_at),
    weight: Weight.fromKg(row.weight_kg),
    height: Height.fromMeters(row.height_m),
    circumferences: deserializeCircumferences(row.circumferences),
    skinfolds: deserializeSkinfolds(row.skinfolds),
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  });
};

export const anthropometryDomainToRow = (a: Anthropometry): AnthropometryRow => {
  return {
    id: a.id.toString(),
    patient_id: a.patientId.toString(),
    measured_at: a.measuredAt.toISOString(),
    weight_kg: a.weight.toKg(),
    height_m: a.height.toMeters(),
    circumferences: serializeCircumferences(a.circumferences),
    skinfolds: serializeSkinfolds(a.skinfolds),
    notes: a.notes,
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
    deleted_at: a.deletedAt?.toISOString() ?? null,
  };
};

export type { AnthropometryProps };
