import {
  Patient,
  type PatientMedicalIntake,
  type PatientProps,
} from "../domain/Patient";
import { PatientId } from "../domain/PatientId";
import { ConsentId } from "../domain/ConsentId";
import type { Sex } from "../domain/Sex";
import type { Gender } from "../domain/Gender";
import type { MaritalStatus } from "../domain/MaritalStatus";
import type { EducationLevel } from "../domain/EducationLevel";
import type { RecordStatus } from "../domain/RecordStatus";
import { Email, Phone } from "../domain/Contact";
import type { PatientStatus } from "../domain/PatientStatus";
import {
  safeDate,
  toIsoStringSafe,
  safeJsonParse,
} from "@services/db/safeDate";

export interface PatientRow {
  id: string;
  sucursal_id?: string | null;
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
  whatsapp_enabled?: boolean | null;
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
  clave_interna: string | null;
  birth_place: string | null;
  address: string | null;
  nationality: string | null;
  id_type: string | null;
  id_number: string | null;
  discharge_reason: string | null;
  responsible_professional_id: string | null;
  external_record_number: string | null;
  admission_reason?: string | null;
  photo_url: string | null;
  medical_intake?: string | Partial<PatientMedicalIntake> | null;
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
    secondaryPhone: row.secondary_phone
      ? Phone.from(row.secondary_phone)
      : null,
    whatsappEnabled:
      typeof row.whatsapp_enabled === "boolean" ? row.whatsapp_enabled : null,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactRelationship: row.emergency_contact_relationship,
    emergencyContactPhone: row.emergency_contact_phone
      ? Phone.from(row.emergency_contact_phone)
      : null,
    recordStatus: row.record_status,
    recordOpenedAt: safeDate(
      row.record_opened_at,
      undefined,
      "patient.record_opened_at",
    )!,
    generalNotes: row.general_notes,
    consentimientoInformadoId: row.consentimiento_informado_id
      ? ConsentId.fromUnsafe(row.consentimiento_informado_id)
      : null,
    fechaFirmaConsentimiento: safeDate(
      row.fecha_firma_consentimiento,
      null,
      "patient.fecha_firma_consentimiento",
    ),
    versionPoliticaPrivacidad: row.version_politica_privacidad,
    clinicalTags: safeJsonParse<string[]>(row.clinical_tags, []),
    claveInterna: row.clave_interna,
    birthPlace: row.birth_place,
    address: row.address,
    nationality: row.nationality,
    idType: row.id_type,
    idNumber: row.id_number,
    dischargeReason: row.discharge_reason,
    responsibleProfessionalId: row.responsible_professional_id,
    externalRecordNumber: row.external_record_number,
    admissionReason: row.admission_reason ?? null,
    photoUrl: row.photo_url,
    medicalIntake: safeJsonParse<Partial<PatientMedicalIntake>>(
      row.medical_intake,
      {},
    ),
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
    birth_date: toIsoStringSafe(
      patient.birthDate,
      new Date().toISOString(),
      "patient.birth_date",
    )!,
    sex: patient.sex,
    gender: patient.gender,
    marital_status: patient.maritalStatus,
    occupation: patient.occupation,
    education: patient.education,
    email: patient.email?.toString() ?? null,
    phone: patient.phone?.toString() ?? null,
    secondary_phone: patient.secondaryPhone?.toString() ?? null,
    whatsapp_enabled: patient.whatsappEnabled,
    emergency_contact_name: patient.emergencyContactName,
    emergency_contact_relationship: patient.emergencyContactRelationship,
    emergency_contact_phone: patient.emergencyContactPhone?.toString() ?? null,
    record_status: patient.recordStatus,
    record_opened_at: toIsoStringSafe(
      patient.recordOpenedAt,
      new Date().toISOString(),
      "patient.record_opened_at",
    )!,
    general_notes: patient.generalNotes,
    consentimiento_informado_id:
      patient.consentimientoInformadoId?.toString() ?? null,
    fecha_firma_consentimiento: toIsoStringSafe(
      patient.fechaFirmaConsentimiento,
      null,
      "patient.fecha_firma_consentimiento",
    ),
    version_politica_privacidad: patient.versionPoliticaPrivacidad,
    clinical_tags: JSON.stringify(patient.clinicalTags),
    clave_interna: patient.claveInterna,
    birth_place: patient.birthPlace,
    address: patient.address,
    nationality: patient.nationality,
    id_type: patient.idType,
    id_number: patient.idNumber,
    discharge_reason: patient.dischargeReason,
    responsible_professional_id: patient.responsibleProfessionalId,
    external_record_number: patient.externalRecordNumber,
    admission_reason: patient.admissionReason,
    photo_url: patient.photoUrl,
    medical_intake: JSON.stringify(patient.medicalIntake),
    status: patient.status,
    created_at: toIsoStringSafe(
      patient.createdAt,
      new Date().toISOString(),
      "patient.created_at",
    )!,
    updated_at: toIsoStringSafe(
      patient.updatedAt,
      new Date().toISOString(),
      "patient.updated_at",
    )!,
    deleted_at: toIsoStringSafe(patient.deletedAt, null, "patient.deleted_at"),
  };
};

export type { PatientProps };
