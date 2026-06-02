import { Patient, type PatientProps } from "../domain/Patient";
import { PatientId } from "../domain/PatientId";
import type { Sex } from "../domain/Sex";
import { Email, Phone } from "../domain/Contact";
import type { PatientStatus } from "../domain/PatientStatus";

export interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: Sex;
  email: string | null;
  phone: string | null;
  status: PatientStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const patientRowToDomain = (row: PatientRow): Patient => {
  return Patient.reconstitute({
    id: PatientId.fromUnsafe(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: new Date(row.birth_date),
    sex: row.sex,
    email: row.email ? Email.from(row.email) : null,
    phone: row.phone ? Phone.from(row.phone) : null,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  });
};

export const patientDomainToRow = (patient: Patient): PatientRow => {
  return {
    id: patient.id.toString(),
    first_name: patient.firstName,
    last_name: patient.lastName,
    birth_date: patient.birthDate.toISOString(),
    sex: patient.sex,
    email: patient.email?.toString() ?? null,
    phone: patient.phone?.toString() ?? null,
    status: patient.status,
    created_at: patient.createdAt.toISOString(),
    updated_at: patient.updatedAt.toISOString(),
    deleted_at: patient.deletedAt?.toISOString() ?? null,
  };
};

export type { PatientProps };
