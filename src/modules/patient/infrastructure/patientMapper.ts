import { Patient, type PatientProps } from "../domain/Patient";
import { PatientId } from "../domain/PatientId";
import { ConsentId } from "../domain/ConsentId";
import type { Sex } from "../domain/Sex";
import type { Gender } from "../domain/Gender";
import type { MaritalStatus } from "../domain/MaritalStatus";
import type { EducationLevel } from "../domain/EducationLevel";
import type { RecordStatus } from "../domain/RecordStatus";
import { Email, Phone } from "../domain/Contact";
import type { PatientStatus } from "../domain/PatientStatus";
import { safeDate, toIsoStringSafe, safeJsonParse } from "@services/db/safeDate";

export interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  second_last_name: string | null;
  birth_date: string;
  sex: Sex;
  gender: Gender | null;
  marital_status: MaritalStatus | null;
  occupation: string | null;
  education: EducationLevel | null;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
  record_status: RecordStatus;
  record_opened_at: string;
  general_notes: string | null;
  consentimiento_informado_id: string | null;
  fecha_firma_consentimiento: string | null;
  version_politica_privacidad: string | null;
  clinical_tags: string;
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
    secondLastName: row.second_last_name,
    birthDate: safeDate(row.birth_date, undefined, "patient.birth_date")!,
    sex: row.sex,
    gender: row.gender,
    maritalStatus: row.marital_status,
    occupation: row.occupation,
    education: row.education,
    email: row.email ? Email.from(row.email) : null,
    phone: row.phone ? Phone.from(row.phone) : null,
    secondaryPhone: row.secondary_phone ? Phone.from(row.secondary_phone) : null,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactRelationship: row.emergency_contact_relationship,
    emergencyContactPhone: row.emergency_contact_phone ? Phone.from(row.emergency_contact_phone) : null,
    recordStatus: row.record_status,
    recordOpenedAt: safeDate(row.record_opened_at, undefined, "patient.record_opened_at")!,
    generalNotes: row.general_notes,
    consentimientoInformadoId: row.consentimiento_informado_id ? ConsentId.fromUnsafe(row.consentimiento_informado_id) : null,
    fechaFirmaConsentimiento: safeDate(row.fecha_firma_consentimiento, null, "patient.fecha_firma_consentimiento"),
    versionPoliticaPrivacidad: row.version_politica_privacidad,
    clinicalTags: safeJsonParse<string[]>(row.clinical_tags, []),
    status: row.status,
    createdAt: safeDate(row.created_at, undefined, "patient.created_at")!,
    updatedAt: safeDate(row.updated_at, undefined, "patient.updated_at")!,
    deletedAt: safeDate(row.deleted_at, null, "patient.deleted_at"),
  });
};

export const patientDomainToRow = (patient: Patient): PatientRow => {
  return {
    id: patient.id.toString(),
    first_name: patient.firstName,
    last_name: patient.lastName,
    second_last_name: patient.secondLastName,
    birth_date: toIsoStringSafe(patient.birthDate, new Date().toISOString(), "patient.birth_date")!,
    sex: patient.sex,
    gender: patient.gender,
    marital_status: patient.maritalStatus,
    occupation: patient.occupation,
    education: patient.education,
    email: patient.email?.toString() ?? null,
    phone: patient.phone?.toString() ?? null,
    secondary_phone: patient.secondaryPhone?.toString() ?? null,
    emergency_contact_name: patient.emergencyContactName,
    emergency_contact_relationship: patient.emergencyContactRelationship,
    emergency_contact_phone: patient.emergencyContactPhone?.toString() ?? null,
    record_status: patient.recordStatus,
    record_opened_at: toIsoStringSafe(patient.recordOpenedAt, new Date().toISOString(), "patient.record_opened_at")!,
    general_notes: patient.generalNotes,
    consentimiento_informado_id: patient.consentimientoInformadoId?.toString() ?? null,
    fecha_firma_consentimiento: toIsoStringSafe(patient.fechaFirmaConsentimiento, null, "patient.fecha_firma_consentimiento"),
    version_politica_privacidad: patient.versionPoliticaPrivacidad,
    clinical_tags: JSON.stringify(patient.clinicalTags),
    status: patient.status,
    created_at: toIsoStringSafe(patient.createdAt, new Date().toISOString(), "patient.created_at")!,
    updated_at: toIsoStringSafe(patient.updatedAt, new Date().toISOString(), "patient.updated_at")!,
    deleted_at: toIsoStringSafe(patient.deletedAt, null, "patient.deleted_at"),
  };
};

export type { PatientProps };
