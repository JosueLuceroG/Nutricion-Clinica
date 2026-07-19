import { Patient, type PatientCreate } from "@modules/patient/domain/Patient";
import { SexSchema, type Sex } from "@modules/patient/domain/Sex";
import { Email, Phone } from "@modules/patient/domain/Contact";

/**
 * Mapeo de encabezados CSV a campos del dominio Patient.
 *
 * Acepta encabezados en español o inglés, con o sin snake_case, con tildes o sin ellas.
 * El matching es case-insensitive y normaliza espacios/acentos.
 */
const COLUMN_ALIASES: Record<string, keyof PatientCsvRow> = {
  nombre: "firstName",
  nombres: "firstName",
  "first name": "firstName",
  firstname: "firstName",
  apellido: "lastName",
  apellidos: "lastName",
  "last name": "lastName",
  lastname: "lastName",
  "segundo apellido": "secondLastName",
  "second last name": "secondLastName",
  secondlastname: "secondLastName",
  "fecha de nacimiento": "birthDate",
  fecha_nacimiento: "birthDate",
  "birth date": "birthDate",
  birthdate: "birthDate",
  nacimiento: "birthDate",
  sexo: "sex",
  sex: "sex",
  genero: "gender",
  género: "gender",
  gender: "gender",
  "estado civil": "maritalStatus",
  "marital status": "maritalStatus",
  maritalstatus: "maritalStatus",
  escolaridad: "education",
  education: "education",
  ocupacion: "occupation",
  ocupación: "occupation",
  occupation: "occupation",
  correo: "email",
  email: "email",
  telefono: "phone",
  teléfono: "phone",
  phone: "phone",
  "telefono secundario": "secondaryPhone",
  "teléfono secundario": "secondaryPhone",
  "secondary phone": "secondaryPhone",
  secondaryphone: "secondaryPhone",
  whatsapp: "whatsappEnabled",
  "whatsapp habilitado": "whatsappEnabled",
  "whatsapp enabled": "whatsappEnabled",
  whatsappenabled: "whatsappEnabled",
  "contacto emergencia": "emergencyContactName",
  "contacto de emergencia": "emergencyContactName",
  "emergency contact": "emergencyContactName",
  emergencycontactname: "emergencyContactName",
  parentesco: "emergencyContactRelationship",
  "parentesco emergencia": "emergencyContactRelationship",
  "emergency relationship": "emergencyContactRelationship",
  "telefono emergencia": "emergencyContactPhone",
  "teléfono de emergencia": "emergencyContactPhone",
  "emergency phone": "emergencyContactPhone",
  emergencycontactphone: "emergencyContactPhone",
  notas: "generalNotes",
  notes: "generalNotes",
  "notas generales": "generalNotes",
};

export interface PatientCsvRow {
  firstName: string;
  lastName: string;
  secondLastName?: string;
  birthDate: string;
  sex: string;
  gender?: string;
  maritalStatus?: string;
  education?: string;
  occupation?: string;
  email?: string;
  phone?: string;
  secondaryPhone?: string;
  whatsappEnabled?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  generalNotes?: string;
}

export interface MappedRow {
  rowNumber: number;
  raw: Record<string, string>;
  mapped: PatientCsvRow | null;
  errors: string[];
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function mapHeaders(
  headers: string[],
): Map<number, keyof PatientCsvRow> {
  const map = new Map<number, keyof PatientCsvRow>();
  headers.forEach((h, i) => {
    const key = COLUMN_ALIASES[normalizeHeader(h)];
    if (key) map.set(i, key);
  });
  return map;
}

const SEX_ALIASES: Record<string, Sex> = {
  femenino: "female",
  f: "female",
  female: "female",
  mujer: "female",
  masculino: "male",
  m: "male",
  male: "male",
  hombre: "male",
  intersexual: "intersex",
  intersex: "intersex",
  i: "intersex",
  "prefiero no decir": "undisclosed",
  undisclosed: "undisclosed",
  "no especifica": "undisclosed",
  otro: "undisclosed",
};

function parseSex(raw: string): Sex {
  const key = raw.toLowerCase().trim();
  const mapped = SEX_ALIASES[key];
  if (mapped) return mapped;
  const result = SexSchema.safeParse(raw.toLowerCase().trim());
  if (result.success) return result.data;
  throw new Error(`Valor de sexo no reconocido: "${raw}"`);
}

const DATE_FORMATS: Array<(s: string) => Date | null> = [
  (s) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return null;
  },
  (s) => {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return null;
  },
  (s) => {
    const m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return null;
  },
];

export function parseDate(raw: string): Date | null {
  const trimmed = raw.trim();
  for (const fmt of DATE_FORMATS) {
    const d = fmt(trimmed);
    if (d && !Number.isNaN(d.getTime())) return d;
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseWhatsappEnabled(raw: string): boolean {
  const normalized = raw
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["true", "1", "si", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new Error(`Valor de WhatsApp no reconocido: "${raw}"`);
}

export function mapRow(
  rowIndex: number,
  values: string[],
  headerMap: Map<number, keyof PatientCsvRow>,
): MappedRow {
  const raw: Record<string, string> = {};
  const mapped: Partial<PatientCsvRow> = {};
  headerMap.forEach((key, colIdx) => {
    const v = (values[colIdx] ?? "").trim();
    if (v) {
      raw[key] = v;
      (mapped as Record<string, string>)[key] = v;
    }
  });
  const errors: string[] = [];

  if (!mapped.firstName) errors.push("Falta nombre");
  if (!mapped.lastName) errors.push("Falta apellido");
  if (!mapped.birthDate) {
    errors.push("Falta fecha de nacimiento");
  } else {
    const d = parseDate(mapped.birthDate);
    if (!d) errors.push(`Fecha de nacimiento inválida: "${mapped.birthDate}"`);
  }
  if (!mapped.sex) {
    errors.push("Falta sexo");
  } else {
    try {
      parseSex(mapped.sex);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "Sexo inválido");
    }
  }
  if (mapped.email) {
    try {
      Email.from(mapped.email);
    } catch {
      errors.push(`Email inválido: "${mapped.email}"`);
    }
  }
  if (mapped.phone) {
    try {
      Phone.from(mapped.phone);
    } catch {
      errors.push(`Teléfono inválido: "${mapped.phone}"`);
    }
  }
  if (mapped.secondaryPhone) {
    try {
      Phone.from(mapped.secondaryPhone);
    } catch {
      errors.push(`Teléfono secundario inválido: "${mapped.secondaryPhone}"`);
    }
  }
  if (mapped.whatsappEnabled) {
    try {
      parseWhatsappEnabled(mapped.whatsappEnabled);
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : "Valor de WhatsApp inválido",
      );
    }
  }
  if (mapped.emergencyContactPhone) {
    try {
      Phone.from(mapped.emergencyContactPhone);
    } catch {
      errors.push(
        `Teléfono de emergencia inválido: "${mapped.emergencyContactPhone}"`,
      );
    }
  }

  return {
    rowNumber: rowIndex + 1,
    raw,
    mapped: errors.length === 0 ? (mapped as PatientCsvRow) : null,
    errors,
  };
}

export interface PatientImportResult {
  patient: Patient;
  raw: Record<string, string>;
  rowNumber: number;
}

export class PatientRowImportError extends Error {
  constructor(
    public readonly rowNumber: number,
    public readonly fieldErrors: string[],
  ) {
    super(`Fila ${rowNumber}: ${fieldErrors.join("; ")}`);
    this.name = "PatientRowImportError";
  }
}

export function toPatientCreate(row: MappedRow): PatientCreate {
  if (!row.mapped) {
    throw new PatientRowImportError(row.rowNumber, row.errors);
  }
  const m = row.mapped;
  const birthDate = parseDate(m.birthDate);
  if (!birthDate) {
    throw new PatientRowImportError(row.rowNumber, [
      `Fecha inválida: ${m.birthDate}`,
    ]);
  }
  return {
    firstName: m.firstName,
    lastName: m.lastName,
    secondLastName: m.secondLastName ?? null,
    birthDate,
    sex: parseSex(m.sex),
    gender: null,
    maritalStatus: null,
    occupation: m.occupation ?? null,
    education: null,
    email: m.email ? Email.from(m.email) : null,
    phone: m.phone ? Phone.from(m.phone) : null,
    secondaryPhone: m.secondaryPhone ? Phone.from(m.secondaryPhone) : null,
    whatsappEnabled: m.whatsappEnabled
      ? parseWhatsappEnabled(m.whatsappEnabled)
      : null,
    emergencyContactName: m.emergencyContactName ?? null,
    emergencyContactRelationship: m.emergencyContactRelationship ?? null,
    emergencyContactPhone: m.emergencyContactPhone
      ? Phone.from(m.emergencyContactPhone)
      : null,
    generalNotes: m.generalNotes ?? null,
  };
}

export function tryCreatePatient(row: MappedRow): Patient | null {
  if (!row.mapped) return null;
  try {
    return Patient.create(toPatientCreate(row));
  } catch {
    return null;
  }
}

export const REQUIRED_COLUMNS: Array<keyof PatientCsvRow> = [
  "firstName",
  "lastName",
  "birthDate",
  "sex",
];

export function validateRequiredHeaders(headers: string[]): {
  missing: string[];
  ok: boolean;
} {
  const map = mapHeaders(headers);
  const present = new Set(map.values());
  const missing = REQUIRED_COLUMNS.filter((k) => !present.has(k));
  return { missing, ok: missing.length === 0 };
}
