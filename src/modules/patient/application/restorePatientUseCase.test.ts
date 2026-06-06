import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexiePatientRepository } from "@modules/patient/infrastructure/DexiePatientRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Patient } from "@modules/patient/domain/Patient";
import { Email, Phone } from "@modules/patient/domain/Contact";
import type { Sex } from "@modules/patient/domain/Sex";
import {
  RestorePatientUseCase,
  ListDeletedPatientsUseCase,
} from "@modules/patient/application/patientUseCases";

const makePatient = (overrides: { firstName: string; lastName?: string; status?: "active" }) => {
  return Patient.create({
    firstName: overrides.firstName,
    lastName: overrides.lastName ?? "Pérez",
    birthDate: new Date("1990-05-15"),
    sex: "female" as Sex,
    email: Email.from("a@b.com"),
    phone: Phone.from("+52 55 1234 5678"),
    status: overrides.status,
  });
};

describe("RestorePatientUseCase", () => {
  let repo: DexiePatientRepository;
  let restore: RestorePatientUseCase;
  let listDeleted: ListDeletedPatientsUseCase;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-restore-${Date.now()}-${Math.random()}`);
    await db.open();
    await db.patients.clear();
    repo = new DexiePatientRepository(db);
    restore = new RestorePatientUseCase(repo);
    listDeleted = new ListDeletedPatientsUseCase(repo);
  });

  it("restaura un paciente soft-deleted a active y deletedAt=null", async () => {
    const p = makePatient({ firstName: "Recuperable" });
    await repo.save(p);
    await repo.delete(p.id, true);

    // sanity: está borrado
    expect((await repo.findById(p.id))?.deletedAt).not.toBeNull();

    const restored = await restore.execute(p.id);
    expect(restored.deletedAt).toBeNull();
    expect(restored.status).toBe("active");

    // Persistido en el repo
    const stored = await repo.findById(p.id);
    expect(stored?.deletedAt).toBeNull();
    expect(stored?.status).toBe("active");
  });

  it("NO aparece en la papelera después de restaurar", async () => {
    const p = makePatient({ firstName: "Ximena" });
    await repo.save(p);
    await repo.delete(p.id, true);
    expect((await listDeleted.execute()).items.length).toBe(1);

    await restore.execute(p.id);
    expect((await listDeleted.execute()).items.length).toBe(0);
  });

  it("es idempotente: restaurar un paciente ya activo no rompe ni duplica", async () => {
    const p = makePatient({ firstName: "Yago" });
    await repo.save(p);
    // El paciente ya está active, no se borra nunca.
    const first = await restore.execute(p.id);
    const second = await restore.execute(p.id);
    expect(first.deletedAt).toBeNull();
    expect(second.deletedAt).toBeNull();
    // Sigue siendo 1 solo registro
    expect((await listDeleted.execute()).items.length).toBe(0);
  });

  it("lanza PatientNotFoundError si el paciente no existe", async () => {
    await expect(
      restore.execute({ toString: () => "non-existent-id" } as never),
    ).rejects.toThrow(/no encontrado/i);
  });
});
