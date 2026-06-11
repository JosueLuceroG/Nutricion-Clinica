import { PatientId } from "./PatientId";
import { ConsentId } from "./ConsentId";
import type { Sex } from "./Sex";
import type { Gender } from "./Gender";
import type { MaritalStatus } from "./MaritalStatus";
import type { EducationLevel } from "./EducationLevel";
import type { RecordStatus } from "./RecordStatus";
import type { Email, Phone } from "./Contact";
import type { PatientStatus } from "./PatientStatus";

export class Patient {
  private constructor(
    public readonly id: PatientId,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly secondLastName: string | null,
    public readonly birthDate: Date,
    public readonly sex: Sex,
    public readonly gender: Gender | null,
    public readonly maritalStatus: MaritalStatus | null,
    public readonly occupation: string | null,
    public readonly education: EducationLevel | null,
    public readonly email: Email | null,
    public readonly phone: Phone | null,
    public readonly secondaryPhone: Phone | null,
    public readonly emergencyContactName: string | null,
    public readonly emergencyContactRelationship: string | null,
    public readonly emergencyContactPhone: Phone | null,
    public readonly recordStatus: RecordStatus,
    public readonly recordOpenedAt: Date,
    public readonly generalNotes: string | null,
    public readonly consentimientoInformadoId: ConsentId | null,
    public readonly fechaFirmaConsentimiento: Date | null,
    public readonly versionPoliticaPrivacidad: string | null,
    public readonly clinicalTags: string[],
    public readonly claveInterna: string | null,
    public readonly birthPlace: string | null,
    public readonly address: string | null,
    public readonly nationality: string | null,
    public readonly idType: string | null,
    public readonly idNumber: string | null,
    public readonly dischargeReason: string | null,
    public readonly responsibleProfessionalId: string | null,
    public readonly externalRecordNumber: string | null,
    public readonly photoUrl: string | null,
    public readonly status: PatientStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  get fullName(): string {
    const parts = [this.firstName, this.lastName];
    if (this.secondLastName) parts.push(this.secondLastName);
    return parts.join(" ").trim();
  }

  get age(): number {
    const now = new Date();
    let years = now.getFullYear() - this.birthDate.getFullYear();
    const m = now.getMonth() - this.birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < this.birthDate.getDate())) {
      years--;
    }
    return years;
  }

  get isActive(): boolean {
    return this.status === "active" && this.deletedAt === null;
  }

  get hasSignedConsent(): boolean {
    return this.consentimientoInformadoId !== null && this.fechaFirmaConsentimiento !== null;
  }

  with(updates: Partial<PatientUpdate>): Patient {
    return Patient.reconstitute({
      id: this.id,
      firstName: updates.firstName ?? this.firstName,
      lastName: updates.lastName ?? this.lastName,
      secondLastName: updates.secondLastName !== undefined ? updates.secondLastName : this.secondLastName,
      birthDate: updates.birthDate ?? this.birthDate,
      sex: updates.sex ?? this.sex,
      gender: updates.gender !== undefined ? updates.gender : this.gender,
      maritalStatus: updates.maritalStatus !== undefined ? updates.maritalStatus : this.maritalStatus,
      occupation: updates.occupation !== undefined ? updates.occupation : this.occupation,
      education: updates.education !== undefined ? updates.education : this.education,
      email: updates.email !== undefined ? updates.email : this.email,
      phone: updates.phone !== undefined ? updates.phone : this.phone,
      secondaryPhone: updates.secondaryPhone !== undefined ? updates.secondaryPhone : this.secondaryPhone,
      emergencyContactName: updates.emergencyContactName !== undefined ? updates.emergencyContactName : this.emergencyContactName,
      emergencyContactRelationship: updates.emergencyContactRelationship !== undefined ? updates.emergencyContactRelationship : this.emergencyContactRelationship,
      emergencyContactPhone: updates.emergencyContactPhone !== undefined ? updates.emergencyContactPhone : this.emergencyContactPhone,
      recordStatus: updates.recordStatus ?? this.recordStatus,
      recordOpenedAt: updates.recordOpenedAt ?? this.recordOpenedAt,
      generalNotes: updates.generalNotes !== undefined ? updates.generalNotes : this.generalNotes,
      consentimientoInformadoId: updates.consentimientoInformadoId !== undefined
        ? coerceConsentId(updates.consentimientoInformadoId)
        : this.consentimientoInformadoId,
      fechaFirmaConsentimiento: updates.fechaFirmaConsentimiento !== undefined ? updates.fechaFirmaConsentimiento : this.fechaFirmaConsentimiento,
      versionPoliticaPrivacidad: updates.versionPoliticaPrivacidad !== undefined ? updates.versionPoliticaPrivacidad : this.versionPoliticaPrivacidad,
      clinicalTags: updates.clinicalTags ?? this.clinicalTags,
      claveInterna: updates.claveInterna !== undefined ? updates.claveInterna : this.claveInterna,
      birthPlace: updates.birthPlace !== undefined ? updates.birthPlace : this.birthPlace,
      address: updates.address !== undefined ? updates.address : this.address,
      nationality: updates.nationality !== undefined ? updates.nationality : this.nationality,
      idType: updates.idType !== undefined ? updates.idType : this.idType,
      idNumber: updates.idNumber !== undefined ? updates.idNumber : this.idNumber,
      dischargeReason: updates.dischargeReason !== undefined ? updates.dischargeReason : this.dischargeReason,
      responsibleProfessionalId: updates.responsibleProfessionalId !== undefined ? updates.responsibleProfessionalId : this.responsibleProfessionalId,
      externalRecordNumber: updates.externalRecordNumber !== undefined ? updates.externalRecordNumber : this.externalRecordNumber,
      photoUrl: updates.photoUrl !== undefined ? updates.photoUrl : this.photoUrl,
      status: updates.status ?? this.status,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      deletedAt: this.deletedAt,
    });
  }

  softDelete(now: Date = new Date()): Patient {
    if (this.deletedAt) return this;
    return Patient.reconstitute({
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      secondLastName: this.secondLastName,
      birthDate: this.birthDate,
      sex: this.sex,
      gender: this.gender,
      maritalStatus: this.maritalStatus,
      occupation: this.occupation,
      education: this.education,
      email: this.email,
      phone: this.phone,
      secondaryPhone: this.secondaryPhone,
      emergencyContactName: this.emergencyContactName,
      emergencyContactRelationship: this.emergencyContactRelationship,
      emergencyContactPhone: this.emergencyContactPhone,
      recordStatus: "inactive",
      recordOpenedAt: this.recordOpenedAt,
      generalNotes: this.generalNotes,
      consentimientoInformadoId: this.consentimientoInformadoId,
      fechaFirmaConsentimiento: this.fechaFirmaConsentimiento,
      versionPoliticaPrivacidad: this.versionPoliticaPrivacidad,
      clinicalTags: this.clinicalTags,
      claveInterna: this.claveInterna,
      birthPlace: this.birthPlace,
      address: this.address,
      nationality: this.nationality,
      idType: this.idType,
      idNumber: this.idNumber,
      dischargeReason: this.dischargeReason,
      responsibleProfessionalId: this.responsibleProfessionalId,
      externalRecordNumber: this.externalRecordNumber,
      photoUrl: this.photoUrl,
      status: "inactive",
      createdAt: this.createdAt,
      updatedAt: now,
      deletedAt: now,
    });
  }

  static create(input: PatientCreate): Patient {
    validateName(input.firstName, "firstName");
    validateName(input.lastName, "lastName");
    validateBirthDate(input.birthDate);
    const now = new Date();
    const fechaFirma = input.fechaFirmaConsentimiento ?? null;
    const consentId = coerceConsentId(input.consentimientoInformadoId ?? null);
    if (fechaFirma) validateConsentDate(fechaFirma);

    return new Patient(
      input.id ?? PatientId.generate(),
      input.firstName.trim(),
      input.lastName.trim(),
      input.secondLastName?.trim() ?? null,
      input.birthDate,
      input.sex,
      input.gender ?? null,
      input.maritalStatus ?? null,
      input.occupation?.trim() ?? null,
      input.education ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.secondaryPhone ?? null,
      input.emergencyContactName?.trim() ?? null,
      input.emergencyContactRelationship?.trim() ?? null,
      input.emergencyContactPhone ?? null,
      input.recordStatus ?? "active",
      input.recordOpenedAt ?? now,
      input.generalNotes?.trim() ?? null,
      consentId,
      fechaFirma,
      input.versionPoliticaPrivacidad?.trim() ?? null,
      input.clinicalTags ?? [],
      input.claveInterna?.trim() ?? null,
      input.birthPlace?.trim() ?? null,
      input.address?.trim() ?? null,
      input.nationality?.trim() ?? null,
      input.idType?.trim() ?? null,
      input.idNumber?.trim() ?? null,
      input.dischargeReason?.trim() ?? null,
      input.responsibleProfessionalId?.trim() ?? null,
      input.externalRecordNumber?.trim() ?? null,
      input.photoUrl?.trim() ?? null,
      input.status ?? "active",
      now,
      now,
      null,
    );
  }

  static reconstitute(props: PatientProps): Patient {
    return new Patient(
      props.id,
      props.firstName,
      props.lastName,
      props.secondLastName,
      props.birthDate,
      props.sex,
      props.gender,
      props.maritalStatus,
      props.occupation,
      props.education,
      props.email,
      props.phone,
      props.secondaryPhone,
      props.emergencyContactName,
      props.emergencyContactRelationship,
      props.emergencyContactPhone,
      props.recordStatus,
      props.recordOpenedAt,
      props.generalNotes,
      props.consentimientoInformadoId,
      props.fechaFirmaConsentimiento,
      props.versionPoliticaPrivacidad,
      props.clinicalTags,
      props.claveInterna,
      props.birthPlace,
      props.address,
      props.nationality,
      props.idType,
      props.idNumber,
      props.dischargeReason,
      props.responsibleProfessionalId,
      props.externalRecordNumber,
      props.photoUrl,
      props.status,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }
}

export interface PatientProps {
  id: PatientId;
  firstName: string;
  lastName: string;
  secondLastName: string | null;
  birthDate: Date;
  sex: Sex;
  gender: Gender | null;
  maritalStatus: MaritalStatus | null;
  occupation: string | null;
  education: EducationLevel | null;
  email: Email | null;
  phone: Phone | null;
  secondaryPhone: Phone | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: Phone | null;
  recordStatus: RecordStatus;
  recordOpenedAt: Date;
  generalNotes: string | null;
  consentimientoInformadoId: ConsentId | null;
  fechaFirmaConsentimiento: Date | null;
  versionPoliticaPrivacidad: string | null;
  clinicalTags: string[];
  claveInterna: string | null;
  birthPlace: string | null;
  address: string | null;
  nationality: string | null;
  idType: string | null;
  idNumber: string | null;
  dischargeReason: string | null;
  responsibleProfessionalId: string | null;
  externalRecordNumber: string | null;
  photoUrl: string | null;
  status: PatientStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PatientCreate {
  id?: PatientId;
  firstName: string;
  lastName: string;
  secondLastName?: string | null;
  birthDate: Date;
  sex: Sex;
  gender?: Gender | null;
  maritalStatus?: MaritalStatus | null;
  occupation?: string | null;
  education?: EducationLevel | null;
  email?: Email | null;
  phone?: Phone | null;
  secondaryPhone?: Phone | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: Phone | null;
  recordStatus?: RecordStatus;
  recordOpenedAt?: Date;
  generalNotes?: string | null;
  consentimientoInformadoId?: string | ConsentId | null;
  fechaFirmaConsentimiento?: Date | null;
  versionPoliticaPrivacidad?: string | null;
  clinicalTags?: string[];
  claveInterna?: string | null;
  birthPlace?: string | null;
  address?: string | null;
  nationality?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  dischargeReason?: string | null;
  responsibleProfessionalId?: string | null;
  externalRecordNumber?: string | null;
  photoUrl?: string | null;
  status?: PatientStatus;
}

export type PatientUpdate = Omit<Partial<PatientCreate>, "id">;

function validateName(name: string, field: string): void {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new Error(`El campo ${field} debe tener al menos 2 caracteres.`);
  }
  if (trimmed.length > 100) {
    throw new Error(`El campo ${field} no puede exceder 100 caracteres.`);
  }
}

function validateBirthDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha de nacimiento inválida.");
  }
  const now = new Date();
  if (date.getTime() > now.getTime()) {
    throw new Error("La fecha de nacimiento no puede estar en el futuro.");
  }
  const minDate = new Date(1900, 0, 1);
  if (date.getTime() < minDate.getTime()) {
    throw new Error("La fecha de nacimiento no puede ser anterior a 1900.");
  }
}

function validateConsentDate(date: Date): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha de firma de consentimiento inválida.");
  }
  const now = new Date();
  if (date.getTime() > now.getTime()) {
    throw new Error("La fecha de firma de consentimiento no puede estar en el futuro.");
  }
}

function coerceConsentId(value: string | ConsentId | null): ConsentId | null {
  if (value === null) return null;
  if (typeof value === "string") {
    if (!value.trim()) return null;
    return ConsentId.fromUnsafe(value);
  }
  return value;
}
