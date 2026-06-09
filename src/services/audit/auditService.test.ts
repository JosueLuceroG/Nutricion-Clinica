import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, it, expect, beforeEach } from "vitest";
import { AuditEvent, type AuditEventProps, type AuditEventCreate } from "./domain/AuditEvent";
import type { AuditEventRow } from "./infrastructure/auditEventMapper";
import { DexieAuditEventRepository } from "./infrastructure/DexieAuditEventRepository";
import { auditService } from "./auditService";
import type { NutriClinicaDB } from "@services/db/dexieSchema";

type DB = NutriClinicaDB & { audit_events: Dexie.Table<AuditEventRow, string> };

function makeDB(): DB {
  const dbName = `test-audit-${Date.now()}-${Math.random()}`;
  const db = new Dexie(dbName) as unknown as DB;
  db.version(1).stores({
    audit_events: "id, patient_id, user_id, module, action, resource_type, resource_id, created_at",
  });
  return db;
}

const baseCreate: AuditEventCreate = {
  userId: "user-1",
  module: "patients",
  action: "create",
  resourceType: "patient",
  resourceId: "patient-1",
};

describe("AuditEvent (domain)", () => {
  it("creates an event with default values", () => {
    const event = AuditEvent.create(baseCreate);
    expect(event.id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(event.patientId).toBeNull();
    expect(event.ipAddress).toBe("local");
    expect(event.previousValueHash).toBeNull();
    expect(event.newValueHash).toBeNull();
    expect(event.justification).toBeNull();
    expect(event.createdAt).toBeTruthy();
    expect(event.action).toBe("create");
    expect(event.resourceType).toBe("patient");
    expect(event.resourceId).toBe("patient-1");
    expect(event.module).toBe("patients");
    expect(event.userId).toBe("user-1");
  });

  it("accepts optional fields", () => {
    const event = AuditEvent.create({
      ...baseCreate,
      patientId: "patient-1",
      ipAddress: "192.168.1.1",
      previousValueHash: "abc123",
      newValueHash: "def456",
      justification: "justified",
    });
    expect(event.patientId).toBe("patient-1");
    expect(event.ipAddress).toBe("192.168.1.1");
    expect(event.previousValueHash).toBe("abc123");
    expect(event.newValueHash).toBe("def456");
    expect(event.justification).toBe("justified");
  });

  it("reconstitutes an event from props", () => {
    const props: AuditEventProps = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      patientId: "p-1",
      userId: "u-1",
      ipAddress: "10.0.0.1",
      module: "lab",
      action: "update",
      resourceType: "lab_panel",
      resourceId: "lab-1",
      previousValueHash: null,
      newValueHash: null,
      justification: null,
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    const event = AuditEvent.reconstitute(props);
    expect(event.id.value).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(event.userId).toBe("u-1");
    expect(event.action).toBe("update");
    expect(event.createdAt).toBe("2025-01-01T00:00:00.000Z");
  });

  it("toProps returns a copy", () => {
    const event = AuditEvent.create(baseCreate);
    const props = event.toProps();
    props.patientId = "hacked";
    expect(event.patientId).toBeNull();
  });
});

describe("DexieAuditEventRepository", () => {
  let db: DB;
  let repo: DexieAuditEventRepository;

  beforeEach(() => {
    db = makeDB();
    repo = new DexieAuditEventRepository(db as unknown as NutriClinicaDB);
  });

  async function seed(...overrides: Partial<AuditEventProps>[]) {
    for (const o of overrides) {
      const event = AuditEvent.create({ ...baseCreate, ...o });
      await repo.save(event.toProps());
    }
  }

  it("saves and finds by patientId", async () => {
    await seed(
      { patientId: "p1", resourceId: "x1" },
      { patientId: "p1", resourceId: "x2" },
      { patientId: "p2", resourceId: "y1" },
    );
    const results = await repo.findByPatientId("p1");
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.patientId === "p1")).toBe(true);
  });

  it("saves and finds by userId with limit", async () => {
    for (let i = 0; i < 5; i++) {
      const event = AuditEvent.create({ ...baseCreate, userId: "u1", resourceId: `r-${i}` });
      await repo.save(event.toProps());
    }
    const all = await repo.findByUserId("u1", 100);
    expect(all).toHaveLength(5);

    const limited = await repo.findByUserId("u1", 2);
    expect(limited).toHaveLength(2);
  });

  it("returns empty array for unknown userId", async () => {
    const results = await repo.findByUserId("nonexistent");
    expect(results).toHaveLength(0);
  });

  it("finds by resource type and id", async () => {
    await seed(
      { resourceType: "consultation", resourceId: "c1" },
      { resourceType: "consultation", resourceId: "c2" },
      { resourceType: "lab_panel", resourceId: "c1" },
    );
    const results = await repo.findByResource("consultation", "c1");
    expect(results).toHaveLength(1);
    expect(results[0].resourceId).toBe("c1");
  });

  it("returns empty for unknown resource", async () => {
    const results = await repo.findByResource("consultation", "nonexistent");
    expect(results).toHaveLength(0);
  });

  it("persists all fields correctly", async () => {
    const input: AuditEventCreate = {
      patientId: "p-1",
      userId: "u-1",
      ipAddress: "10.0.0.1",
      module: "consultation",
      action: "update",
      resourceType: "consultation",
      resourceId: "c-1",
      previousValueHash: "old-hash",
      newValueHash: "new-hash",
      justification: "updated weight",
    };
    const event = AuditEvent.create(input);
    await repo.save(event.toProps());

    const saved = await repo.findByPatientId("p-1");
    expect(saved).toHaveLength(1);
    expect(saved[0].userId).toBe("u-1");
    expect(saved[0].ipAddress).toBe("10.0.0.1");
    expect(saved[0].module).toBe("consultation");
    expect(saved[0].action).toBe("update");
    expect(saved[0].resourceType).toBe("consultation");
    expect(saved[0].resourceId).toBe("c-1");
    expect(saved[0].previousValueHash).toBe("old-hash");
    expect(saved[0].newValueHash).toBe("new-hash");
    expect(saved[0].justification).toBe("updated weight");
  });
});

describe("auditService", () => {
  beforeEach(() => {
    makeDB();
  });

  it("records an event and returns it", async () => {
    const event = await auditService.record(baseCreate);
    expect(event).toBeInstanceOf(AuditEvent);
    expect(event.userId).toBe("user-1");
  });

  it("findByPatientId returns events", async () => {
    await auditService.record({ ...baseCreate, patientId: "p1", resourceId: "r1" });
    await auditService.record({ ...baseCreate, patientId: "p1", resourceId: "r2" });
    const events = await auditService.findByPatientId("p1");
    expect(events).toHaveLength(2);
  });

  it("findByUserId returns events", async () => {
    await auditService.record({ ...baseCreate, userId: "dr1", resourceId: "r1" });
    await auditService.record({ ...baseCreate, userId: "dr1", resourceId: "r2" });
    const events = await auditService.findByUserId("dr1");
    expect(events).toHaveLength(2);
  });

  it("findByResource returns events", async () => {
    await auditService.record({
      ...baseCreate,
      resourceType: "consultation",
      resourceId: "c-42",
    });
    const events = await auditService.findByResource("consultation", "c-42");
    expect(events).toHaveLength(1);
  });
});
