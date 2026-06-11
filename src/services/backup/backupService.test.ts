import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@services/db/dexieSchema";
import { backupService } from "./backupService";

beforeAll(async () => {
  await db.open();
  await db.patients.bulkPut([
    {
      id: "p1", first_name: "María", last_name: "Gómez", second_last_name: null,
      birth_date: "1990-05-15", sex: "female", gender: null, marital_status: null,
      occupation: null, education: null, email: "maria@test.com", phone: null,
      secondary_phone: null, emergency_contact_name: null,
      emergency_contact_relationship: null, emergency_contact_phone: null,
      record_status: "active", record_opened_at: new Date().toISOString(),
      general_notes: null,
      consentimiento_informado_id: null, fecha_firma_consentimiento: null,
      version_politica_privacidad: null,
      clinical_tags: "[]",
      clave_interna: null, birth_place: null, address: null, nationality: null,
      id_type: null, id_number: null, discharge_reason: null,
      responsible_professional_id: null, external_record_number: null, photo_url: null,
      status: "active",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    },
  ]);
  await db.smae_custom_foods.bulkPut([
    { id: "custom-test", group: "frutas", name: "Test Fruit", short_name: "Test", serving: "1 piece", serving_grams: 100, keywords_json: "[]", custom: 1 as const, created_at: Date.now() },
  ]);
});

afterAll(async () => {
  await db.delete();
});

describe("backupService", () => {
  describe("exportBackup", () => {
    it("exports without encryption", async () => {
      const result = await backupService.exportBackup();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.fileName).toMatch(/\.json$/);
      expect(result.encrypted).toBe(false);
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it("exports with encryption", async () => {
      const result = await backupService.exportBackup("test-password");
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.fileName).toMatch(/\.enc$/);
      expect(result.encrypted).toBe(true);
    });
  });

  describe("importBackup", () => {
    it("imports unencrypted backup", async () => {
      const exported = await backupService.exportBackup();
      const result = await backupService.importBackup(exported.blob);
      expect(result.success).toBe(true);
      expect(result.tablesImported.length).toBeGreaterThan(0);
      expect(result.rowCount).toBeGreaterThan(0);
    });

    it("imports encrypted backup with correct password", async () => {
      const exported = await backupService.exportBackup("secret123");
      const result = await backupService.importBackup(exported.blob, "secret123");
      expect(result.success).toBe(true);
    });

    it("fails on encrypted backup with wrong password", async () => {
      const exported = await backupService.exportBackup("secret123");
      const result = await backupService.importBackup(exported.blob, "wrong-password");
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes("contraseña"))).toBe(true);
    });

    it("fails on invalid JSON", async () => {
      const blob = new Blob(["not-json"], { type: "application/json" });
      const result = await backupService.importBackup(blob);
      expect(result.success).toBe(false);
    });
  });
});
