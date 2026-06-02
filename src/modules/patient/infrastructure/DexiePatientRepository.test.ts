import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { DexiePatientRepository } from "./DexiePatientRepository";
import { NutriClinicaDB } from "@services/db/dexieSchema";
import { Patient } from "../domain/Patient";
import { PatientId } from "../domain/PatientId";
import { Email, Phone } from "../domain/Contact";
import type { Sex } from "../domain/Sex";

const makePatient = (overrides: Partial<{
  firstName: string;
  lastName: string;
  email: string | null;
  status: "active" | "inactive" | "archived" | "deceased";
}> = {}) => {
  return Patient.create({
    firstName: overrides.firstName ?? "Ana",
    lastName: overrides.lastName ?? "Pérez",
    birthDate: new Date("1990-05-15"),
    sex: "female" as Sex,
    email: overrides.email ? Email.from(overrides.email) : null,
    phone: overrides.email ? Phone.from("+52 55 1234 5678") : null,
    status: overrides.status,
  });
};

describe("DexiePatientRepository", () => {
  let repo: DexiePatientRepository;
  let db: NutriClinicaDB;

  beforeEach(async () => {
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.delete();
    db = new NutriClinicaDB(`test-${Math.random().toString(36).slice(2)}`);
    await db.open();
    repo = new DexiePatientRepository(db);
  });

  it("guarda y recupera un paciente por id", async () => {
    const p = makePatient();
    await repo.save(p);

    const found = await repo.findById(p.id);
    expect(found).not.toBeNull();
    expect(found?.fullName).toBe("Ana Pérez");
    expect(found?.id.equals(p.id)).toBe(true);
  });

  it("retorna null cuando el paciente no existe", async () => {
    const found = await repo.findById(PatientId.generate());
    expect(found).toBeNull();
  });

  it("findAll excluye soft-deleted por defecto", async () => {
    const p1 = makePatient({ firstName: "Ana" });
    const p2 = makePatient({ firstName: "Beto" });
    const p3 = makePatient({ firstName: "Carla" });

    await repo.save(p1);
    await repo.save(p2);
    await repo.save(p3);

    await repo.delete(p2.id, true);

    const all = await repo.findAll();
    const ids = all.map((p) => p.id.toString());
    expect(ids).toContain(p1.id.toString());
    expect(ids).not.toContain(p2.id.toString());
    expect(ids).toContain(p3.id.toString());
  });

  it("count refleja el número de pacientes activos", async () => {
    await repo.save(makePatient({ firstName: "Ana" }));
    await repo.save(makePatient({ firstName: "Beto" }));
    const p3 = makePatient({ firstName: "Carla" });
    await repo.save(p3);
    await repo.delete(p3.id, true);

    expect(await repo.count()).toBe(2);
  });

  it("filtra por search en nombre y apellido", async () => {
    await repo.save(makePatient({ firstName: "María", lastName: "García" }));
    await repo.save(makePatient({ firstName: "Juan", lastName: "Pérez" }));
    await repo.save(makePatient({ firstName: "Marisol", lastName: "López" }));

    const results = await repo.findAll({ search: "mar" });
    expect(results).toHaveLength(2);
    expect(results.map((p) => p.firstName).sort()).toEqual(["Marisol", "María"]);
  });

  it("filtra por status", async () => {
    await repo.save(makePatient({ firstName: "Ana", status: "active" }));
    await repo.save(makePatient({ firstName: "Beto", status: "archived" }));
    await repo.save(makePatient({ firstName: "Carla", status: "inactive" }));

    const active = await repo.findAll({ status: "active" });
    expect(active).toHaveLength(1);
    expect(active[0]?.firstName).toBe("Ana");
  });

  it("filtra por sexo", async () => {
    await repo.save(makePatient({ firstName: "Ana" }));
    await repo.save(
      Patient.create({
        firstName: "Beto",
        lastName: "Pérez",
        birthDate: new Date("1985-01-01"),
        sex: "male" as Sex,
      }),
    );

    const males = await repo.findAll({ sex: "male" });
    expect(males).toHaveLength(1);
    expect(males[0]?.firstName).toBe("Beto");
  });

  it("limita y pagina resultados", async () => {
    for (let i = 0; i < 10; i++) {
      const num = String(i).padStart(2, "0");
      await repo.save(makePatient({ firstName: `P${num}`, lastName: "Test" }));
    }
    const first = await repo.findAll({ limit: 3, offset: 0 });
    const second = await repo.findAll({ limit: 3, offset: 3 });
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    expect(first[0]?.id.equals(second[0]?.id ?? PatientId.generate())).toBe(false);
  });

  it("preserva datos a través de save/findById roundtrip", async () => {
    const p = Patient.create({
      firstName: "Lucía",
      lastName: "Ramírez",
      birthDate: new Date("1992-08-20"),
      sex: "female" as Sex,
      email: Email.from("lucia@example.com"),
      phone: Phone.from("+52 55 9876 5432"),
    });
    await repo.save(p);

    const found = await repo.findById(p.id);
    expect(found?.email?.toString()).toBe("lucia@example.com");
    expect(found?.phone?.toString()).toBe("+52 55 9876 5432");
    expect(found?.birthDate.toISOString()).toBe(new Date("1992-08-20").toISOString());
  });

  it("soft delete actualiza deletedAt y status", async () => {
    const p = makePatient();
    await repo.save(p);
    await repo.delete(p.id, true);

    const found = await repo.findById(p.id);
    expect(found?.deletedAt).not.toBeNull();
    expect(found?.status).toBe("inactive");
  });

  it("hard delete elimina definitivamente", async () => {
    const p = makePatient();
    await repo.save(p);
    await repo.delete(p.id, false);

    const found = await repo.findById(p.id);
    expect(found).toBeNull();
  });
});
