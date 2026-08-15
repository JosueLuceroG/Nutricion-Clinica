import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "@services/db/dexieSchema";
import type { PatientRow } from "@modules/patient/infrastructure/patientMapper";
import { setSyncRunning } from "@services/sync/syncEnqueuer";

const mocks = vi.hoisted(() => ({
  consume: vi.fn(async () => ({ authorized: true as const })),
  getAuthState: vi.fn(),
}));

vi.mock("@services/api/sensitiveActionApi", () => ({
  sensitiveActionApi: { consume: mocks.consume },
}));

vi.mock("@store/authStore", () => ({
  useAuthStore: { getState: () => mocks.getAuthState() },
}));

import { backupService, importValidatedBackup } from "./backupService";

const EXPORT_AUTH = { action: "backup.export" as const, grant: "export-grant" };
const RESTORE_AUTH = {
  action: "backup.restore" as const,
  grant: "restore-grant",
};

const patient: PatientRow = {
  id: "p1",
  first_name: "María",
  last_name: "Gómez",
  second_last_name: null,
  birth_date: "1990-05-15",
  sex: "female",
  gender: null,
  marital_status: null,
  occupation: null,
  education: null,
  email: "maria@test.com",
  phone: null,
  secondary_phone: null,
  emergency_contact_name: null,
  emergency_contact_relationship: null,
  emergency_contact_phone: null,
  record_status: "active",
  record_opened_at: new Date().toISOString(),
  general_notes: null,
  consentimiento_informado_id: null,
  fecha_firma_consentimiento: null,
  version_politica_privacidad: null,
  clinical_tags: "[]",
  clave_interna: null,
  birth_place: null,
  address: null,
  nationality: null,
  id_type: null,
  id_number: null,
  discharge_reason: null,
  responsible_professional_id: null,
  external_record_number: null,
  photo_url: null,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null,
};

beforeAll(async () => {
  await db.open();
});

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.consume.mockResolvedValue({ authorized: true });
  mocks.getAuthState.mockReturnValue({ user: { id: "admin-1", rol: "admin" } });
  setSyncRunning(false);
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.patients.put(patient);
  await db.smae_custom_foods.put({
    id: "custom-test",
    group: "frutas",
    name: "Test Fruit",
    short_name: "Test",
    serving: "1 piece",
    serving_grams: 100,
    keywords_json: "[]",
    custom: 1,
    created_at: Date.now(),
  });
});

afterAll(async () => {
  await db.delete();
});

describe("backupService", () => {
  it("rejects direct use by a non-admin before consuming a grant", async () => {
    mocks.getAuthState.mockReturnValue({
      user: { id: "support-1", rol: "soporte_tecnico" },
    });

    await expect(backupService.exportBackup(EXPORT_AUTH)).rejects.toThrow(
      "No autorizado",
    );
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("requires an action-specific grant", async () => {
    await expect(backupService.exportBackup(RESTORE_AUTH)).rejects.toThrow(
      "No autorizado",
    );
    expect(mocks.consume).not.toHaveBeenCalled();
  });

  it("exports a coherent portable manifest and excludes server-managed and non-portable state", async () => {
    const result = await backupService.exportBackup(EXPORT_AUTH);
    const data = JSON.parse(await result.blob.text()) as {
      version: number;
      schemaVersion: number;
      syncState: string;
      tables: Array<{ name: string }>;
    };
    const names = data.tables.map((table) => table.name);

    expect(result.fileName).toMatch(/\.json$/);
    expect(result.encrypted).toBe(false);
    expect(data.version).toBe(2);
    expect(data.schemaVersion).toBe(db.verno);
    expect(data.syncState).toBe("clean");
    expect(names).toContain("smae_custom_foods");
    expect(names).not.toEqual(
      expect.arrayContaining([
        "patients",
        "consultations",
        "anthropometry",
        "lab_panels",
        "meal_plans",
        "adherence_records",
        "audit_events",
        "sync_queue",
        "sync_meta",
        "ai_cache",
        "telemedicina_recordings",
      ]),
    );
    expect(mocks.consume).toHaveBeenCalledWith(EXPORT_AUTH);
  });

  it("round-trips an encrypted backup with the correct password", async () => {
    const exported = await backupService.exportBackup(EXPORT_AUTH, "secret123");
    await db.smae_custom_foods.update("custom-test", { name: "Changed" });
    await db.patients.update("p1", { first_name: "Server managed" });

    const result = await backupService.importBackup(
      exported.blob,
      RESTORE_AUTH,
      "secret123",
    );

    expect(result.success).toBe(true);
    expect((await db.smae_custom_foods.get("custom-test"))?.name).toBe(
      "Test Fruit",
    );
    expect((await db.patients.get("p1"))?.first_name).toBe("Server managed");
    expect(exported.fileName).toMatch(/\.enc$/);
    expect(await backupService.isEncryptedBackup(exported.blob)).toBe(true);
  });

  it("recognizes encrypted content independently of the filename", async () => {
    const exported = await backupService.exportBackup(EXPORT_AUTH, "secret123");
    const renamed = new File([exported.blob], "renamed.json", {
      type: "application/json",
    });

    expect(await backupService.isEncryptedBackup(renamed)).toBe(true);
  });

  it("does not mutate data when the encryption password is wrong", async () => {
    const exported = await backupService.exportBackup(EXPORT_AUTH, "secret123");
    await db.patients.update("p1", { first_name: "Current" });

    const result = await backupService.importBackup(
      exported.blob,
      RESTORE_AUTH,
      "wrong-password",
    );

    expect(result.success).toBe(false);
    expect(result.errors.join(" ").toLowerCase()).toContain("contraseña");
    expect((await db.patients.get("p1"))?.first_name).toBe("Current");
  });

  it("rejects unknown and missing tables before mutating current data", async () => {
    const exported = await backupService.exportBackup(EXPORT_AUTH);
    const data = JSON.parse(await exported.blob.text()) as {
      tables: Array<{ name: string; rows: unknown[] }>;
    };
    data.tables.push({ name: "attacker_table", rows: [] });

    const result = await backupService.importBackup(
      new Blob([JSON.stringify(data)]),
      RESTORE_AUTH,
    );

    expect(result.success).toBe(false);
    expect(result.errors.join(" ")).toContain("Tabla desconocida");
    expect(await db.smae_custom_foods.get("custom-test")).toBeDefined();
  });

  it("rolls back every table when a later write fails", async () => {
    const exported = await backupService.exportBackup(EXPORT_AUTH);
    const data = JSON.parse(await exported.blob.text()) as {
      tables: Array<{ name: string; rows: Record<string, unknown>[] }>;
    };
    const customFoods = data.tables.find(
      (table) => table.name === "smae_custom_foods",
    )!;
    customFoods.rows = [{ ...customFoods.rows[0], name: "Imported" }];
    const allergies = data.tables.find((table) => table.name === "allergies")!;
    allergies.rows = [{ id: "allergy-1" }];
    const result = await importValidatedBackup(
      {
        version: 2,
        exportedAt: new Date().toISOString(),
        appVersion: "0.1.0",
        schemaVersion: db.verno,
        syncState: "clean",
        tables: data.tables,
      },
      (name) => {
        const table = db.table(name);
        if (name !== "allergies") return table;
        return new Proxy(table, {
          get(target, property, receiver) {
            if (property === "bulkPut") {
              return () => Promise.reject(new Error("simulated write failure"));
            }
            return Reflect.get(target, property, receiver);
          },
        });
      },
    );

    expect(result.success).toBe(false);
    expect(result.tablesImported).toEqual([]);
    expect((await db.smae_custom_foods.get("custom-test"))?.name).toBe(
      "Test Fruit",
    );
  });

  it("rejects rows without a primary key and active HTML before mutation", async () => {
    const exported = await backupService.exportBackup(EXPORT_AUTH);
    const missingKey = JSON.parse(await exported.blob.text()) as {
      tables: Array<{ name: string; rows: Record<string, unknown>[] }>;
    };
    missingKey.tables.find(
      (table) => table.name === "smae_custom_foods",
    )!.rows = [{}];

    const keyResult = await backupService.importBackup(
      new Blob([JSON.stringify(missingKey)]),
      RESTORE_AUTH,
    );
    expect(keyResult.success).toBe(false);
    expect(keyResult.errors.join(" ")).toContain("clave primaria");
    expect(await db.smae_custom_foods.get("custom-test")).toBeDefined();

    const activeHtml = JSON.parse(await exported.blob.text()) as {
      tables: Array<{ name: string; rows: Record<string, unknown>[] }>;
    };
    activeHtml.tables.find((table) => table.name === "documents")!.rows = [
      { id: "doc-1", content_html: '<img src="x" onerror="alert(1)">' },
    ];
    const htmlResult = await backupService.importBackup(
      new Blob([JSON.stringify(activeHtml)]),
      RESTORE_AUTH,
    );
    expect(htmlResult.success).toBe(false);
    expect(htmlResult.errors.join(" ")).toContain("HTML activo");
  });

  it("restores a complete legacy backup only when its sync queue is clean", async () => {
    const exported = await backupService.exportBackup(EXPORT_AUTH);
    const data = JSON.parse(await exported.blob.text()) as {
      version: number;
      schemaVersion?: number;
      tables: Array<{ name: string; rows: Record<string, unknown>[] }>;
    };
    data.version = 1;
    delete data.schemaVersion;
    data.tables.push({ name: "sync_queue", rows: [] });

    const result = await backupService.importBackup(
      new Blob([JSON.stringify(data)]),
      RESTORE_AUTH,
    );

    expect(result.success).toBe(true);
    expect(await db.smae_custom_foods.get("custom-test")).toBeDefined();
  });

  it("rejects legacy backups whose sync queue is missing or unsettled", async () => {
    const exported = await backupService.exportBackup(EXPORT_AUTH);
    const data = JSON.parse(await exported.blob.text()) as {
      version: number;
      schemaVersion?: number;
      tables: Array<{ name: string; rows: Record<string, unknown>[] }>;
    };
    data.version = 1;
    delete data.schemaVersion;

    const missingQueue = await backupService.importBackup(
      new Blob([JSON.stringify(data)]),
      RESTORE_AUTH,
    );
    expect(missingQueue.success).toBe(false);
    expect(missingQueue.errors.join(" ")).toContain("no permite comprobarlos");

    data.tables.push({
      name: "sync_queue",
      rows: [{ id: "q1", status: "pending" }],
    });
    const unsettled = await backupService.importBackup(
      new Blob([JSON.stringify(data)]),
      RESTORE_AUTH,
    );
    expect(unsettled.success).toBe(false);
    expect(unsettled.errors.join(" ")).toContain("cambios sin sincronizar");
  });

  it("refuses export and restore while local sync changes are unsettled", async () => {
    const exported = await backupService.exportBackup(EXPORT_AUTH);
    await db.sync_queue.put({
      id: "queue-1",
      sucursalId: "suc-1",
      entity: "pacientes",
      entityId: "p1",
      op: "update",
      payload: JSON.stringify(patient),
      status: "pending",
      retryCount: 0,
      lastError: null,
      expectedRowVersion: null,
      enqueuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await expect(backupService.exportBackup(EXPORT_AUTH)).rejects.toThrow(
      "cambios pendientes",
    );
    await expect(
      backupService.importBackup(exported.blob, RESTORE_AUTH),
    ).rejects.toThrow("cambios pendientes");
    expect(await db.sync_queue.count()).toBe(1);
  });

  it("refuses restore before mutation while sync is already running", async () => {
    const exported = await backupService.exportBackup(EXPORT_AUTH);
    await db.patients.update("p1", { first_name: "Current" });
    setSyncRunning(true);
    try {
      const result = await backupService.importBackup(
        exported.blob,
        RESTORE_AUTH,
      );
      expect(result.success).toBe(false);
      expect(result.errors.join(" ")).toContain("sincronización en curso");
      expect((await db.patients.get("p1"))?.first_name).toBe("Current");
    } finally {
      setSyncRunning(false);
    }
  });
});
