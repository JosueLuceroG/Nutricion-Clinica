export type PatientRecordNumberSegment =
  | { readonly id: string; readonly type: "text"; readonly value: string }
  | { readonly id: string; readonly type: "separator"; readonly value: string }
  | { readonly id: string; readonly type: "firstName"; readonly length: number }
  | { readonly id: string; readonly type: "lastName"; readonly length: number }
  | {
      readonly id: string;
      readonly type: "secondLastName";
      readonly length: number;
    }
  | { readonly id: string; readonly type: "day" }
  | { readonly id: string; readonly type: "month" }
  | { readonly id: string; readonly type: "year"; readonly digits: 2 | 4 }
  | { readonly id: string; readonly type: "sequence"; readonly digits: number };

export type PatientRecordNumberSegmentType = PatientRecordNumberSegment["type"];

export interface PatientRecordNumberConfig {
  readonly segments: readonly PatientRecordNumberSegment[];
  readonly uppercase: boolean;
}

export interface PatientRecordNumberInput {
  readonly firstName: string;
  readonly lastName: string;
  readonly secondLastName?: string;
  readonly sequence: number;
  readonly date?: Date;
}

interface LegacyPatientRecordNumberConfig {
  readonly prefix?: string;
  readonly separator?: string;
  readonly includeMonth?: boolean;
  readonly firstNameLetters?: number;
  readonly lastNameLetters?: number;
  readonly yearDigits?: 0 | 2 | 4;
  readonly sequenceDigits?: number;
  readonly uppercase?: boolean;
}

type PatientRecordNumberConfigValue =
  | PatientRecordNumberConfig
  | LegacyPatientRecordNumberConfig;

export const DEFAULT_PATIENT_RECORD_NUMBER_CONFIG: PatientRecordNumberConfig =
  Object.freeze({
    uppercase: true,
    segments: Object.freeze([
      Object.freeze({ id: "default-prefix", type: "text", value: "EXP" }),
      Object.freeze({
        id: "default-separator-1",
        type: "separator",
        value: "-",
      }),
      Object.freeze({ id: "default-month", type: "month" }),
      Object.freeze({
        id: "default-separator-2",
        type: "separator",
        value: "-",
      }),
      Object.freeze({ id: "default-first-name", type: "firstName", length: 2 }),
      Object.freeze({ id: "default-last-name", type: "lastName", length: 1 }),
      Object.freeze({ id: "default-year", type: "year", digits: 2 }),
      Object.freeze({ id: "default-sequence", type: "sequence", digits: 2 }),
    ] satisfies PatientRecordNumberSegment[]),
  });

export function createPatientRecordNumberSegment(
  type: PatientRecordNumberSegmentType,
  id: string,
): PatientRecordNumberSegment {
  switch (type) {
    case "text":
      return { id, type, value: "" };
    case "separator":
      return { id, type, value: "-" };
    case "firstName":
    case "lastName":
    case "secondLastName":
      return { id, type, length: 1 };
    case "year":
      return { id, type, digits: 2 };
    case "sequence":
      return { id, type, digits: 2 };
    case "day":
    case "month":
      return { id, type };
  }
}

export function normalizePatientRecordNumberConfig(
  value: PatientRecordNumberConfigValue,
): PatientRecordNumberConfig {
  const candidate = value as Partial<PatientRecordNumberConfig>;
  if (Array.isArray(candidate.segments)) {
    return {
      uppercase: candidate.uppercase !== false,
      segments: candidate.segments
        .slice(0, 30)
        .map((segment, index) => normalizeSegment(segment, index))
        .filter((segment): segment is PatientRecordNumberSegment =>
          Boolean(segment),
        ),
    };
  }

  return normalizeLegacyConfig(value as LegacyPatientRecordNumberConfig);
}

export function formatPatientRecordNumber(
  configValue: PatientRecordNumberConfigValue,
  input: PatientRecordNumberInput,
): string {
  const config = normalizePatientRecordNumberConfig(configValue);
  const date = input.date ?? new Date();
  const transformCase = (value: string) =>
    config.uppercase ? value.toUpperCase() : value.toLowerCase();
  const cleanText = (value: string) =>
    transformCase(
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, ""),
    );
  const sequence = Math.max(1, Math.trunc(input.sequence));

  return config.segments
    .map((segment) => {
      switch (segment.type) {
        case "text":
          return cleanText(segment.value);
        case "separator":
          return segment.value;
        case "firstName":
          return cleanText(input.firstName).slice(0, segment.length);
        case "lastName":
          return cleanText(input.lastName).slice(0, segment.length);
        case "secondLastName":
          return cleanText(input.secondLastName ?? "").slice(0, segment.length);
        case "day":
          return String(date.getDate()).padStart(2, "0");
        case "month":
          return String(date.getMonth() + 1).padStart(2, "0");
        case "year": {
          const year = String(date.getFullYear());
          return segment.digits === 4 ? year : year.slice(-2);
        }
        case "sequence":
          return String(sequence).padStart(segment.digits, "0");
      }
    })
    .join("")
    .slice(0, 100);
}

export function isDefaultPatientRecordNumberConfig(
  value: PatientRecordNumberConfigValue,
): boolean {
  const normalized = normalizePatientRecordNumberConfig(value);
  return (
    normalized.uppercase === DEFAULT_PATIENT_RECORD_NUMBER_CONFIG.uppercase &&
    JSON.stringify(normalized.segments.map(withoutSegmentId)) ===
      JSON.stringify(
        DEFAULT_PATIENT_RECORD_NUMBER_CONFIG.segments.map(withoutSegmentId),
      )
  );
}

export function hasPatientRecordNumberSequence(
  value: PatientRecordNumberConfigValue,
): boolean {
  return normalizePatientRecordNumberConfig(value).segments.some(
    (segment) => segment.type === "sequence",
  );
}

function normalizeLegacyConfig(
  value: LegacyPatientRecordNumberConfig,
): PatientRecordNumberConfig {
  const separator = (value.separator ?? "-").slice(0, 3);
  const firstNameLetters = clampInteger(value.firstNameLetters ?? 2, 0, 10);
  const lastNameLetters = clampInteger(value.lastNameLetters ?? 1, 0, 10);
  const yearDigits =
    value.yearDigits === 4 ? 4 : value.yearDigits === 0 ? 0 : 2;
  const segments: PatientRecordNumberSegment[] = [];
  const appendSeparator = () => {
    if (separator) {
      segments.push({
        id: `legacy-separator-${segments.length}`,
        type: "separator",
        value: separator,
      });
    }
  };

  if (value.prefix?.trim()) {
    segments.push({ id: "legacy-prefix", type: "text", value: value.prefix });
  }
  if (value.includeMonth !== false) {
    if (segments.length > 0) appendSeparator();
    segments.push({ id: "legacy-month", type: "month" });
  }
  if (segments.length > 0) appendSeparator();
  if (firstNameLetters > 0) {
    segments.push({
      id: "legacy-first-name",
      type: "firstName",
      length: firstNameLetters,
    });
  }
  if (lastNameLetters > 0) {
    segments.push({
      id: "legacy-last-name",
      type: "lastName",
      length: lastNameLetters,
    });
  }
  if (yearDigits > 0) {
    segments.push({
      id: "legacy-year",
      type: "year",
      digits: yearDigits as 2 | 4,
    });
  }
  segments.push({
    id: "legacy-sequence",
    type: "sequence",
    digits: clampInteger(value.sequenceDigits ?? 2, 1, 6),
  });

  return { uppercase: value.uppercase !== false, segments };
}

function normalizeSegment(
  value: PatientRecordNumberSegment,
  index: number,
): PatientRecordNumberSegment | null {
  if (!value || typeof value !== "object" || typeof value.type !== "string") {
    return null;
  }
  const id =
    typeof value.id === "string" && value.id ? value.id : `segment-${index}`;

  switch (value.type) {
    case "text":
      return {
        id,
        type: value.type,
        value: String(value.value ?? "").slice(0, 30),
      };
    case "separator":
      return {
        id,
        type: value.type,
        value: String(value.value ?? "").slice(0, 3),
      };
    case "firstName":
    case "lastName":
    case "secondLastName":
      return {
        id,
        type: value.type,
        length: clampInteger(value.length, 1, 10),
      };
    case "year":
      return { id, type: value.type, digits: value.digits === 4 ? 4 : 2 };
    case "sequence":
      return { id, type: value.type, digits: clampInteger(value.digits, 1, 6) };
    case "day":
    case "month":
      return { id, type: value.type };
    default:
      return null;
  }
}

function withoutSegmentId(segment: PatientRecordNumberSegment): object {
  const { id: _id, ...value } = segment;
  return value;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const integer = Number.isFinite(value) ? Math.trunc(value) : minimum;
  return Math.min(maximum, Math.max(minimum, integer));
}
