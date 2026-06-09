import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@services/db/dexieSchema";
import { ConsentService, type PatientConsent } from "./PatientConsentService";

const makeConsent = (overrides: Partial<PatientConsent> = {}): PatientConsent => ({
  id: overrides.id ?? crypto.randomUUID(),
  patient_id: overrides.patient_id ?? "patient-1",
  type: overrides.type ?? "treatment",
  signed_at: overrides.signed_at ?? new Date().toISOString(),
  expires_at: overrides.expires_at ?? null,
  revoked_at: overrides.revoked_at ?? null,
});

beforeEach(async () => {
  await db.open();
  await db.patient_consents.clear();
});

describe("ConsentService", () => {
  describe("recordConsent", () => {
    it("stores a consent record and returns its id", async () => {
      const consent = makeConsent();
      const id = await ConsentService.recordConsent(consent);

      expect(id).toBe(consent.id);
      const stored = await db.patient_consents.get(id);
      expect(stored).toBeDefined();
      expect(stored!.patient_id).toBe("patient-1");
      expect(stored!.type).toBe("treatment");
    });
  });

  describe("revokeConsent", () => {
    it("sets the revoked_at timestamp", async () => {
      const consent = makeConsent({ revoked_at: null });
      await ConsentService.recordConsent(consent);

      await ConsentService.revokeConsent(consent.id);

      const stored = await db.patient_consents.get(consent.id);
      expect(stored!.revoked_at).toBeTruthy();
      const diff = Math.abs(new Date(stored!.revoked_at!).getTime() - Date.now());
      expect(diff).toBeLessThan(5000);
    });
  });

  describe("isConsentActive", () => {
    it("returns true for an active, unexpired consent", async () => {
      const consent = makeConsent({
        patient_id: "p1",
        type: "treatment",
        expires_at: null,
        revoked_at: null,
      });
      await ConsentService.recordConsent(consent);

      const active = await ConsentService.isConsentActive("p1", "treatment");
      expect(active).toBe(true);
    });

    it("returns false when the only consent is revoked", async () => {
      const consent = makeConsent({
        patient_id: "p1",
        type: "treatment",
        revoked_at: new Date().toISOString(),
      });
      await ConsentService.recordConsent(consent);

      const active = await ConsentService.isConsentActive("p1", "treatment");
      expect(active).toBe(false);
    });

    it("returns false when the only consent is expired", async () => {
      const consent = makeConsent({
        patient_id: "p1",
        type: "treatment",
        expires_at: new Date(Date.now() - 86_400_000).toISOString(),
        revoked_at: null,
      });
      await ConsentService.recordConsent(consent);

      const active = await ConsentService.isConsentActive("p1", "treatment");
      expect(active).toBe(false);
    });

    it("returns true when there is at least one active consent alongside revoked ones", async () => {
      await ConsentService.recordConsent(
        makeConsent({ patient_id: "p1", type: "treatment", revoked_at: new Date().toISOString() }),
      );
      await ConsentService.recordConsent(
        makeConsent({ id: crypto.randomUUID(), patient_id: "p1", type: "treatment" }),
      );

      const active = await ConsentService.isConsentActive("p1", "treatment");
      expect(active).toBe(true);
    });

    it("does not mix consent types", async () => {
      await ConsentService.recordConsent(
        makeConsent({ patient_id: "p1", type: "data_sharing" }),
      );

      const active = await ConsentService.isConsentActive("p1", "treatment");
      expect(active).toBe(false);
    });

    it("does not mix patients", async () => {
      await ConsentService.recordConsent(
        makeConsent({ patient_id: "p1", type: "treatment" }),
      );

      const active = await ConsentService.isConsentActive("p2", "treatment");
      expect(active).toBe(false);
    });
  });

  describe("listByPatient", () => {
    it("returns consents for a given patient in reverse chronological order", async () => {
      const older = makeConsent({
        id: "consent-1",
        patient_id: "p1",
        signed_at: new Date(Date.now() - 10_000).toISOString(),
      });
      const newer = makeConsent({
        id: "consent-2",
        patient_id: "p1",
        signed_at: new Date().toISOString(),
      });
      await ConsentService.recordConsent(older);
      await ConsentService.recordConsent(newer);

      const result = await ConsentService.listByPatient("p1");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("consent-2");
      expect(result[1].id).toBe("consent-1");
    });

    it("does not return consents for other patients", async () => {
      await ConsentService.recordConsent(
        makeConsent({ patient_id: "p1" }),
      );
      await ConsentService.recordConsent(
        makeConsent({ id: crypto.randomUUID(), patient_id: "p2" }),
      );

      const result = await ConsentService.listByPatient("p1");

      expect(result).toHaveLength(1);
      expect(result[0].patient_id).toBe("p1");
    });

    it("returns empty array when patient has no consents", async () => {
      const result = await ConsentService.listByPatient("non-existent");
      expect(result).toEqual([]);
    });
  });

  it("uses the main Dexie DB instance (db.patient_consents)", () => {
    expect(ConsentService.table).toBe(db.patient_consents);
  });
});
