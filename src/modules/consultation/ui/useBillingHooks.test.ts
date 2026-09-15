import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { renderHook, waitFor, act } from "@testing-library/react";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Patient } from "@modules/patient/domain/Patient";
import { PatientId } from "@modules/patient/domain/PatientId";
import { Email, Phone } from "@modules/patient/domain/Contact";
import type { Sex } from "@modules/patient/domain/Sex";
import { DexiePatientRepository } from "@modules/patient/infrastructure/DexiePatientRepository";
import { DexieConsultationRepository } from "@modules/consultation/infrastructure/DexieConsultationRepository";
import { Consultation } from "@modules/consultation/domain/Consultation";
import { ScheduleConsultationUseCase, RegisterPaymentUseCase, DeleteConsultationUseCase } from "@modules/consultation/application/consultationUseCases";
import { usePendingPayments, usePatientPaymentSummary, useConsultationLive } from "./useBillingHooks";
import { useSyncStore } from "@store/syncStore";
import { useAuthStore } from "@store/authStore";

const makePatient = (overrides: { firstName: string; lastName?: string }) =>
  Patient.create({
    firstName: overrides.firstName,
    lastName: overrides.lastName ?? "Pérez",
    birthDate: new Date("1990-05-15"),
    sex: "female" as Sex,
    email: Email.from(`${overrides.firstName.toLowerCase()}@b.com`),
    phone: Phone.from("+52 55 1234 5678"),
  });

beforeEach(() => {
  useSyncStore.getState().setSucursalId("suc-1");
  useAuthStore.setState({ user: null });
});

describe("usePendingPayments", () => {
  let db: NutriClinicaDB;
  let patientRepo: DexiePatientRepository;
  let consultRepo: DexieConsultationRepository;
  let schedule: ScheduleConsultationUseCase;
  let registerPayment: RegisterPaymentUseCase;
  let del: DeleteConsultationUseCase;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-billing-${Math.random().toString(36).slice(2)}`);
    await db.open();
    await db.consultations.clear();
    await db.patients.clear();
    patientRepo = new DexiePatientRepository(db);
    consultRepo = new DexieConsultationRepository(db);
    schedule = new ScheduleConsultationUseCase(consultRepo);
    registerPayment = new RegisterPaymentUseCase(consultRepo);
    del = new DeleteConsultationUseCase(consultRepo);
  });

  it("devuelve solo consultas con cost>0 y paid=false", async () => {
    const p = makePatient({ firstName: "Ana" });
    await patientRepo.save(p);
    const c1 = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 1,
      reason: "Control inicial",
      cost: 1000,
    });
    const c2 = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-06-02"),
      consultationNumber: 2,
      reason: "Seguimiento",
      cost: 500,
    });
    await registerPayment.execute(c2.id, {
      paid: true,
      paymentMethod: "cash",
      paidAt: new Date(),
    });

    const { result } = renderHook(() => usePendingPayments({}, db));
    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0]?.consultation.id.toString()).toBe(c1.id.toString());
    expect(result.current.total).toBe(1);
    expect(result.current.totalAmount).toBe(1000);
  });

  it("excluye soft-deleted", async () => {
    const p = makePatient({ firstName: "Bea" });
    await patientRepo.save(p);
    const c = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 1,
      reason: "Control inicial",
      cost: 800,
    });
    await del.execute(c.id, true);

    const { result } = renderHook(() => usePendingPayments({}, db));
    await waitFor(() => expect(result.current.items.length).toBe(0));
  });

  it("filtra por rango de fecha (from)", async () => {
    const p = makePatient({ firstName: "Cris" });
    await patientRepo.save(p);
    await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-01-01"),
      consultationNumber: 1,
      reason: "Antigua",
      cost: 100,
    });
    const recent = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 2,
      reason: "Reciente",
      cost: 200,
    });
    const { result } = renderHook(() =>
      usePendingPayments({ from: new Date("2026-05-01") }, db),
    );
    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0]?.consultation.id.toString()).toBe(recent.id.toString());
  });

  it("busca por nombre de paciente", async () => {
    const a = makePatient({ firstName: "Ana" });
    const b = makePatient({ firstName: "Beatriz" });
    await patientRepo.save(a);
    await patientRepo.save(b);
    await schedule.execute({
      patientId: a.id,
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 1,
      reason: "Control",
      cost: 100,
    });
    await schedule.execute({
      patientId: b.id,
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 1,
      reason: "Control",
      cost: 200,
    });
    const { result } = renderHook(() =>
      usePendingPayments({ patientQuery: "bea" }, db),
    );
    await waitFor(() => expect(result.current.items.length).toBe(1));
    expect(result.current.items[0]?.patientName).toBe("Beatriz Pérez");
  });

  it("se actualiza en vivo al registrar un pago", async () => {
    const p = makePatient({ firstName: "Diana" });
    await patientRepo.save(p);
    const c = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 1,
      reason: "Control",
      cost: 500,
    });
    const { result } = renderHook(() => usePendingPayments({}, db));
    await waitFor(() => expect(result.current.items.length).toBe(1));

    await act(async () => {
      await registerPayment.execute(c.id, {
        paid: true,
        paymentMethod: "cash",
        paidAt: new Date(),
      });
    });
    await waitFor(() => expect(result.current.items.length).toBe(0));
  });

  it("excluye consultas y pacientes de otra sucursal", async () => {
    const patient = makePatient({ firstName: "Otra" });
    await patientRepo.save(patient);
    const consultation = await schedule.execute({
      patientId: patient.id,
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 1,
      reason: "No visible",
      cost: 500,
    });
    await db.consultations.update(consultation.id.toString(), {
      sucursal_id: "suc-2",
    });

    const { result } = renderHook(() => usePendingPayments({}, db));
    await waitFor(() => expect(result.current.items).toEqual([]));
  });
});

describe("usePatientPaymentSummary", () => {
  let db: NutriClinicaDB;
  let patientRepo: DexiePatientRepository;
  let consultRepo: DexieConsultationRepository;
  let schedule: ScheduleConsultationUseCase;
  let registerPayment: RegisterPaymentUseCase;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-ppsum-${Math.random().toString(36).slice(2)}`);
    await db.open();
    await db.consultations.clear();
    await db.patients.clear();
    patientRepo = new DexiePatientRepository(db);
    consultRepo = new DexieConsultationRepository(db);
    schedule = new ScheduleConsultationUseCase(consultRepo);
    registerPayment = new RegisterPaymentUseCase(consultRepo);
  });

  it("refunded/cancelled NO cuentan como pendientes ni como pagadas", async () => {
    const p = makePatient({ firstName: "Eva" });
    await patientRepo.save(p);
    const pending = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 1,
      reason: "Pendiente",
      cost: 1000,
    });
    const cancelled = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-06-02"),
      consultationNumber: 2,
      reason: "Cancelada",
      cost: 500,
    });
    await registerPayment.execute(cancelled.id, {
      paid: false,
      paymentStatus: "cancelled",
      paymentMethod: null,
      paidAt: null,
    });
    const refunded = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-06-03"),
      consultationNumber: 3,
      reason: "Reembolsada",
      cost: 300,
    });
    await registerPayment.execute(refunded.id, {
      paid: true,
      paymentStatus: "refunded",
      paymentMethod: "cash",
      paidAt: new Date(),
    });
    void pending;

    const { result } = renderHook(() => usePatientPaymentSummary(p.id.toString(), db));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({
      pendingCount: 1,
      paidCount: 0,
      partialCount: 0,
      totalPending: 1000,
    });
  });

  it("suma pagadas y parciales correctamente", async () => {
    const p = makePatient({ firstName: "Fer" });
    await patientRepo.save(p);
    const paid = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 1,
      reason: "Pagada",
      cost: 1000,
    });
    const partial = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date("2026-06-02"),
      consultationNumber: 2,
      reason: "Parcial",
      cost: 500,
    });
    await registerPayment.execute(paid.id, {
      paid: true,
      paymentMethod: "cash",
      paidAt: new Date(),
    });
    await registerPayment.execute(partial.id, {
      paid: false,
      paymentStatus: "partial",
      paymentMethod: "cash",
      paidAt: new Date(),
      amountPaid: 200,
    });

    const { result } = renderHook(() => usePatientPaymentSummary(p.id.toString(), db));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({
      paidCount: 1,
      partialCount: 1,
      pendingCount: 0,
      totalPaid: 1200,
      totalPending: 300,
    });
  });
});

describe("useConsultationLive", () => {
  it("devuelve null si el id no existe", async () => {
    const db = new NutriClinicaDB(`test-clv-${Math.random().toString(36).slice(2)}`);
    await db.open();
    const { result } = renderHook(() => useConsultationLive(null));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it("carga una consulta existente por id", async () => {
    const db = new NutriClinicaDB(`test-clv2-${Math.random().toString(36).slice(2)}`);
    await db.open();
    await db.consultations.clear();
    const repo = new DexieConsultationRepository(db);
    const pid = PatientId.generate();
    const c = Consultation.create({
      patientId: pid,
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 1,
      reason: "Control inicial",
    });
    await repo.save(c);

    const { result } = renderHook(() => useConsultationLive(c.id.toString(), db));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.id.toString()).toBe(c.id.toString());
  });

  it("redacta datos clínicos para el rol de facturación", async () => {
    useAuthStore.setState({ user: { rol: "facturacion" } as never });
    const db = new NutriClinicaDB(`test-clv3-${Math.random().toString(36).slice(2)}`);
    await db.open();
    const repo = new DexieConsultationRepository(db);
    const consultation = Consultation.create({
      patientId: PatientId.generate(),
      consultationDate: new Date("2026-06-01"),
      consultationNumber: 1,
      reason: "Diagnóstico sensible",
      subjective: "Síntoma sensible",
      assessment: "Evaluación sensible",
      cost: 500,
    });
    await repo.save(consultation);

    const { result } = renderHook(() =>
      useConsultationLive(consultation.id.toString(), db),
    );
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({
      reason: "",
      subjective: null,
      assessment: null,
      cost: 500,
    });
  });
});
