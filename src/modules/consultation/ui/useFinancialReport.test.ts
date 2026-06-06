import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { renderHook, waitFor, act } from "@testing-library/react";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Patient } from "@modules/patient/domain/Patient";
import { Email, Phone } from "@modules/patient/domain/Contact";
import type { Sex } from "@modules/patient/domain/Sex";
import { DexiePatientRepository } from "@modules/patient/infrastructure/DexiePatientRepository";
import { DexieConsultationRepository } from "@modules/consultation/infrastructure/DexieConsultationRepository";
import { ScheduleConsultationUseCase, RegisterPaymentUseCase } from "@modules/consultation/application/consultationUseCases";
import { useFinancialReport } from "./useFinancialReport";

const makePatient = (overrides: { firstName: string; lastName?: string }) =>
  Patient.create({
    firstName: overrides.firstName,
    lastName: overrides.lastName ?? "Pérez",
    birthDate: new Date("1990-05-15"),
    sex: "female" as Sex,
    email: Email.from(`${overrides.firstName.toLowerCase()}@b.com`),
    phone: Phone.from("+52 55 1234 5678"),
  });

describe("useFinancialReport", () => {
  let db: NutriClinicaDB;
  let patientRepo: DexiePatientRepository;
  let consultRepo: DexieConsultationRepository;
  let schedule: ScheduleConsultationUseCase;
  let registerPayment: RegisterPaymentUseCase;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-fin-${Math.random().toString(36).slice(2)}`);
    await db.open();
    await db.consultations.clear();
    await db.patients.clear();
    patientRepo = new DexiePatientRepository(db);
    consultRepo = new DexieConsultationRepository(db);
    schedule = new ScheduleConsultationUseCase(consultRepo);
    registerPayment = new RegisterPaymentUseCase(consultRepo);
  });

  it("devuelve totales en cero si no hay consultas con costo", async () => {
    const { result } = renderHook(() => useFinancialReport(180, 6, 5));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.totalIncome).toBe(0);
    expect(result.current!.totalPending).toBe(0);
    expect(result.current!.paidCount).toBe(0);
    expect(result.current!.pendingCount).toBe(0);
    expect(result.current!.monthly).toHaveLength(6);
    expect(result.current!.topPatients).toHaveLength(0);
  });

  it("agrega ingresos, pendientes y conteos por mes", async () => {
    const a = makePatient({ firstName: "Ana" });
    const b = makePatient({ firstName: "Bea" });
    await patientRepo.save(a);
    await patientRepo.save(b);
    const now = new Date();
    const a1 = await schedule.execute({
      patientId: a.id,
      consultationDate: new Date(now.getTime() - 10 * 86400000),
      consultationNumber: 1,
      reason: "Control A1",
      cost: 1000,
    });
    const a2 = await schedule.execute({
      patientId: a.id,
      consultationDate: new Date(now.getTime() - 5 * 86400000),
      consultationNumber: 2,
      reason: "Control A2",
      cost: 800,
    });
    const b1 = await schedule.execute({
      patientId: b.id,
      consultationDate: new Date(now.getTime() - 2 * 86400000),
      consultationNumber: 1,
      reason: "Control B1",
      cost: 500,
    });
    await schedule.execute({
      patientId: b.id,
      consultationDate: new Date(now.getTime() - 1 * 86400000),
      consultationNumber: 2,
      reason: "Pendiente B",
      cost: 300,
    });

    await registerPayment.execute(a1.id, { paid: true, paymentMethod: "cash", paidAt: new Date() });
    await registerPayment.execute(a2.id, { paid: true, paymentMethod: "cash", paidAt: new Date() });
    await registerPayment.execute(b1.id, { paid: true, paymentMethod: "cash", paidAt: new Date() });

    const { result } = renderHook(() => useFinancialReport(180, 6, 5, db));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.totalIncome).toBe(2300);
    expect(result.current!.totalPending).toBe(300);
    expect(result.current!.paidCount).toBe(3);
    expect(result.current!.pendingCount).toBe(1);
    expect(result.current!.activePatients).toBe(2);
  });

  it("top patients ordenado por totalPaid desc, limitado a topN", async () => {
    const a = makePatient({ firstName: "Ana" });
    const b = makePatient({ firstName: "Bea" });
    const c = makePatient({ firstName: "Cris" });
    await patientRepo.save(a);
    await patientRepo.save(b);
    await patientRepo.save(c);
    const now = new Date();
    const a1 = await schedule.execute({
      patientId: a.id,
      consultationDate: now,
      consultationNumber: 1,
      reason: "Control A",
      cost: 100,
    });
    const b1 = await schedule.execute({
      patientId: b.id,
      consultationDate: now,
      consultationNumber: 1,
      reason: "Control B",
      cost: 5000,
    });
    const c1 = await schedule.execute({
      patientId: c.id,
      consultationDate: now,
      consultationNumber: 1,
      reason: "Control C",
      cost: 800,
    });
    await registerPayment.execute(a1.id, { paid: true, paymentMethod: "cash", paidAt: new Date() });
    await registerPayment.execute(b1.id, { paid: true, paymentMethod: "cash", paidAt: new Date() });
    await registerPayment.execute(c1.id, { paid: true, paymentMethod: "cash", paidAt: new Date() });

    const { result } = renderHook(() => useFinancialReport(180, 6, 2, db));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.topPatients).toHaveLength(2);
    expect(result.current!.topPatients[0]?.patientName).toBe("Bea Pérez");
    expect(result.current!.topPatients[0]?.totalPaid).toBe(5000);
    expect(result.current!.topPatients[1]?.patientName).toBe("Cris Pérez");
  });

  it("monthly siempre tiene N buckets (uno por mes)", async () => {
    const { result } = renderHook(() => useFinancialReport(180, 3, 5, db));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.monthly).toHaveLength(3);
    const labels = new Set(result.current!.monthly.map((m) => m.label));
    expect(labels.size).toBe(3);
  });

  it("se actualiza en vivo al registrar un pago", async () => {
    const p = makePatient({ firstName: "Diana" });
    await patientRepo.save(p);
    const c = await schedule.execute({
      patientId: p.id,
      consultationDate: new Date(),
      consultationNumber: 1,
      reason: "Control",
      cost: 700,
    });

    const { result } = renderHook(() => useFinancialReport(180, 6, 5, db));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.totalIncome).toBe(0);

    await act(async () => {
      await registerPayment.execute(c.id, {
        paid: true,
        paymentMethod: "cash",
        paidAt: new Date(),
      });
    });
    await waitFor(() => expect(result.current!.totalIncome).toBe(700));
    expect(result.current!.paidCount).toBe(1);
  });
});
