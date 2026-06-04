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
    birthDate: new Date(row.birth_date),
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
    recordOpenedAt: new Date(row.record_opened_at),
    generalNotes: row.general_notes,
    consentimientoInformadoId: row.consentimiento_informado_id ? ConsentId.fromUnsafe(row.consentimiento_informado_id) : null,
    fechaFirmaConsentimiento: row.fecha_firma_consentimiento ? new Date(row.fecha_firma_consentimiento) : null,
    versionPoliticaPrivacidad: row.version_politica_privacidad,
    clinicalTags: row.clinical_tags ? JSON.parse(row.clinical_tags) : [],
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
    second_last_name: patient.secondLastName,
    birth_date: patient.birthDate.toISOString(),
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
    record_opened_at: patient.recordOpenedAt.toISOString(),
    general_notes: patient.generalNotes,
    consentimiento_informado_id: patient.consentimientoInformadoId?.toString() ?? null,
    fecha_firma_consentimiento: patient.fechaFirmaConsentimiento?.toISOString() ?? null,
    version_politica_privacidad: patient.versionPoliticaPrivacidad,
    clinical_tags: JSON.stringify(patient.clinicalTags),
    status: patient.status,
    created_at: patient.createdAt.toISOString(),
    updated_at: patient.updatedAt.toISOString(),
    deleted_at: patient.deletedAt?.toISOString() ?? null,
  };
};

export type { PatientProps };
