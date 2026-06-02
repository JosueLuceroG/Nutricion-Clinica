import { PatientId } from "./PatientId";
import type { Sex } from "./Sex";
import type { Email, Phone } from "./Contact";
import type { PatientStatus } from "./PatientStatus";

/**
 * Entidad de dominio: Patient.
 *
 * Reglas:
 *  - Inmutable: cualquier cambio produce una nueva instancia.
 *  - Sin dependencias de React, Tauri, SQLite o cualquier framework.
 *  - El nombre completo es derivado (firstName + lastName).
 */
export class Patient {
  private constructor(
    public readonly id: PatientId,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly birthDate: Date,
    public readonly sex: Sex,
    public readonly email: Email | null,
    public readonly phone: Phone | null,
    public readonly status: PatientStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
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

  with(updates: Partial<PatientUpdate>): Patient {
    return Patient.reconstitute({
      id: this.id,
      firstName: updates.firstName ?? this.firstName,
      lastName: updates.lastName ?? this.lastName,
      birthDate: updates.birthDate ?? this.birthDate,
      sex: updates.sex ?? this.sex,
      email: updates.email !== undefined ? updates.email : this.email,
      phone: updates.phone !== undefined ? updates.phone : this.phone,
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
      birthDate: this.birthDate,
      sex: this.sex,
      email: this.email,
      phone: this.phone,
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

    return new Patient(
      input.id ?? PatientId.generate(),
      input.firstName.trim(),
      input.lastName.trim(),
      input.birthDate,
      input.sex,
      input.email ?? null,
      input.phone ?? null,
      input.status ?? "active",
      new Date(),
      new Date(),
      null,
    );
  }

  static reconstitute(props: PatientProps): Patient {
    return new Patient(
      props.id,
      props.firstName,
      props.lastName,
      props.birthDate,
      props.sex,
      props.email,
      props.phone,
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
  birthDate: Date;
  sex: Sex;
  email: Email | null;
  phone: Phone | null;
  status: PatientStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PatientCreate {
  id?: PatientId;
  firstName: string;
  lastName: string;
  birthDate: Date;
  sex: Sex;
  email?: Email | null;
  phone?: Phone | null;
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
