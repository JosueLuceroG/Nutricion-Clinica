import { describe, it, expect } from "vitest";
import {
  calculateConsultationsPerWeek,
  calculateAverageAdherence,
  calculatePathologyDistribution,
  calculateActivePatientCount,
  calculateConsultationsThisMonth,
  calculatePendingPayments,
} from "./kpiEngine";
import type { ConsultationRow } from "@modules/consultation/infrastructure/consultationMapper";
import type { AdherenceIndexRow } from "@modules/adherence/infrastructure/adherenceMapper";
import type { PatientRow } from "@modules/patient/infrastructure/patientMapper";

const makeConsultation = (overrides: Partial<ConsultationRow> = {}): ConsultationRow => ({
  id: crypto.randomUUID(),
  patient_id: crypto.randomUUID(),
  consultation_date: "2026-01-15",
  consultation_number: 1,
  reason: "Control",
  subjective: null,
  objective: null,
  vitals_json: null,
  assessment: null,
  plan: null,
  anthropometry_id: null,
  lab_panel_id: null,
  next_visit_date: null,
  status: "completed",
  cost: 100,
  paid: true,
  payment_status: "paid",
  payment_concept: "consulta",
  payment_method: null,
  paid_at: null,
  reference: null,
  invoice_number: null,
  billing_notes: null,
  amount_paid: 100,
  created_at: "2026-01-15T10:00:00Z",
  updated_at: "2026-01-15T10:00:00Z",
  deleted_at: null,
  ...overrides,
});

const makeAdherenceIndex = (overrides: Partial<AdherenceIndexRow> = {}): AdherenceIndexRow => ({
  id: crypto.randomUUID(),
  patient_id: crypto.randomUUID(),
  period_start: "2026-01-01",
  period_end: "2026-01-31",
  score_menu: 80,
  score_water: 70,
  score_activity: 60,
  score_supplements: 90,
  score_sleep: 75,
  score_global: 75,
  tendency: "estable",
  calculated_at: Date.now(),
  ...overrides,
});

const makePatient = (overrides: Partial<PatientRow> = {}): PatientRow => ({
  id: crypto.randomUUID(),
  first_name: "Juan",
  last_name: "Pérez",
  second_last_name: null,
  birth_date: "1990-05-10",
  sex: "male",
  gender: null,
  marital_status: null,
  occupation: null,
  education: null,
  email: null,
  phone: null,
  secondary_phone: null,
  emergency_contact_name: null,
  emergency_contact_relationship: null,
  emergency_contact_phone: null,
  record_status: "active",
  record_opened_at: "2025-01-01",
  general_notes: null,
  consentimiento_informado_id: null,
  fecha_firma_consentimiento: null,
  version_politica_privacidad: null,
  clinical_tags: "",
  clave_interna: null, birth_place: null, address: null, nationality: null,
  id_type: null, id_number: null, discharge_reason: null,
  responsible_professional_id: null, external_record_number: null, photo_url: null,
  status: "active",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  deleted_at: null,
  ...overrides,
});

describe("calculateConsultationsPerWeek", () => {
  it("retorna 0 para arreglo vacío", () => {
    expect(calculateConsultationsPerWeek([])).toBe(0);
  });

  it("calcula consultas por semana correctamente", () => {
    const consultations = [
      makeConsultation({ consultation_date: "2026-01-06" }),
      makeConsultation({ consultation_date: "2026-01-06" }),
      makeConsultation({ consultation_date: "2026-01-13" }),
      makeConsultation({ consultation_date: "2026-01-13" }),
      makeConsultation({ consultation_date: "2026-01-20" }),
    ];
    const result = calculateConsultationsPerWeek(consultations);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(5);
  });

  it("retorna 0 si todas las fechas son inválidas", () => {
    const consultations = [
      makeConsultation({ consultation_date: "invalid-date" }),
      makeConsultation({ consultation_date: "not-a-date" }),
    ];
    expect(calculateConsultationsPerWeek(consultations)).toBe(0);
  });

  it("maneja una sola consulta (span de 1 semana)", () => {
    const consultations = [makeConsultation({ consultation_date: "2026-05-01" })];
    const result = calculateConsultationsPerWeek(consultations);
    expect(result).toBe(1);
  });

  it("maneja fechas en un solo día (evita división por cero)", () => {
    const consultations = [
      makeConsultation({ consultation_date: "2026-03-01" }),
      makeConsultation({ consultation_date: "2026-03-01" }),
      makeConsultation({ consultation_date: "2026-03-01" }),
    ];
    const result = calculateConsultationsPerWeek(consultations);
    expect(result).toBe(3);
  });
});

describe("calculateAverageAdherence", () => {
  it("retorna 0 para arreglo vacío", () => {
    expect(calculateAverageAdherence([])).toBe(0);
  });

  it("calcula promedio de score_global correctamente", () => {
    const indexes = [
      makeAdherenceIndex({ score_global: 80 }),
      makeAdherenceIndex({ score_global: 90 }),
      makeAdherenceIndex({ score_global: 70 }),
    ];
    expect(calculateAverageAdherence(indexes)).toBe(80);
  });

  it("retorna el mismo valor para un solo registro", () => {
    const indexes = [makeAdherenceIndex({ score_global: 65.5 })];
    expect(calculateAverageAdherence(indexes)).toBe(65.5);
  });

  it("maneja valores con decimales correctamente", () => {
    const indexes = [
      makeAdherenceIndex({ score_global: 33.33 }),
      makeAdherenceIndex({ score_global: 66.67 }),
    ];
    expect(calculateAverageAdherence(indexes)).toBe(50);
  });
});

describe("calculatePathologyDistribution", () => {
  it("retorna objeto vacío para arreglo vacío", () => {
    expect(calculatePathologyDistribution([])).toEqual({});
  });

  it("cuenta patologías correctamente", () => {
    const patients = [
      makePatient({ clinical_tags: "diabetes, hipertensión" }),
      makePatient({ clinical_tags: "diabetes, obesidad" }),
      makePatient({ clinical_tags: "hipertensión" }),
    ];
    const result = calculatePathologyDistribution(patients);
    expect(result).toEqual({
      diabetes: 2,
      hipertensión: 2,
      obesidad: 1,
    });
  });

  it("maneja pacientes sin clinical_tags", () => {
    const patients = [
      makePatient({ clinical_tags: "" }),
      makePatient({ clinical_tags: "diabetes" }),
    ];
    const result = calculatePathologyDistribution(patients);
    expect(result).toEqual({ diabetes: 1 });
  });

  it("ignora espacios alrededor de tags", () => {
    const patients = [
      makePatient({ clinical_tags: "  diabetes , hipertensión " }),
    ];
    const result = calculatePathologyDistribution(patients);
    expect(result).toEqual({ diabetes: 1, hipertensión: 1 });
  });

  it("no cuenta strings vacíos como patología", () => {
    const patients = [
      makePatient({ clinical_tags: " , diabetes, " }),
    ];
    const result = calculatePathologyDistribution(patients);
    expect(result).toEqual({ diabetes: 1 });
  });
});

describe("calculateActivePatientCount", () => {
  it("retorna 0 para arreglo vacío", () => {
    expect(calculateActivePatientCount([])).toBe(0);
  });

  it("cuenta solo pacientes con status active", () => {
    const patients = [
      makePatient({ status: "active" }),
      makePatient({ status: "active" }),
      makePatient({ status: "inactive" }),
      makePatient({ status: "archived" }),
    ];
    expect(calculateActivePatientCount(patients)).toBe(2);
  });

  it("retorna 0 si ningún paciente está activo", () => {
    const patients = [
      makePatient({ status: "inactive" }),
      makePatient({ status: "archived" }),
    ];
    expect(calculateActivePatientCount(patients)).toBe(0);
  });
});

describe("calculateConsultationsThisMonth", () => {
  it("retorna 0 para arreglo vacío", () => {
    expect(calculateConsultationsThisMonth([])).toBe(0);
  });

  it("retorna 0 si no hay consultas este mes", () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    const dateStr = lastYear.toISOString().slice(0, 10);
    const consultations = [makeConsultation({ consultation_date: dateStr })];
    expect(calculateConsultationsThisMonth(consultations)).toBe(0);
  });

  it("cuenta consultas del mes actual", () => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const consultations = [
      makeConsultation({ consultation_date: todayStr }),
      makeConsultation({ consultation_date: todayStr }),
    ];
    expect(calculateConsultationsThisMonth(consultations)).toBe(2);
  });
});

describe("calculatePendingPayments", () => {
  it("retorna 0 para arreglo vacío", () => {
    expect(calculatePendingPayments([])).toBe(0);
  });

  it("cuenta consultas no pagadas", () => {
    const consultations = [
      makeConsultation({ paid: false }),
      makeConsultation({ paid: true }),
      makeConsultation({ paid: false }),
    ];
    expect(calculatePendingPayments(consultations)).toBe(2);
  });

  it("retorna 0 si todas están pagadas", () => {
    const consultations = [
      makeConsultation({ paid: true }),
      makeConsultation({ paid: true }),
    ];
    expect(calculatePendingPayments(consultations)).toBe(0);
  });
});
