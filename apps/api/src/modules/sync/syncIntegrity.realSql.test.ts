import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sql from "mssql";
import { getPool, closePool } from "../../db/connection.js";
import { pullChanges, pushBatch } from "./application/syncService.js";
import type { SyncableEntity, SyncPushOperation } from "@nutriclinica/shared";
import { toApiPayload, toLocalPayload } from "@nutriclinica/shared";

const enabled = process.env.SYNC_REAL_SQL_TEST === "1";
const branch = randomUUID();
const actor = { id: randomUUID(), role: "admin" as const };
const patient = randomUUID();
const consultation = randomUUID();
const now = "2026-09-09T10:00:00.000Z";

function localRow(entity: SyncableEntity, id = randomUUID()): Record<string, unknown> {
  const common = { id, sucursal_id: branch, patient_id: patient };
  switch (entity) {
    case "pacientes": return { id, sucursal_id: branch, first_name: "Synthetic", last_name: "Sync", sex: "female", birth_date: "1990-01-01", status: "active", clinical_tags: '["synthetic"]' };
    case "consultas": return { ...common, consultation_date: now, status: "scheduled", reason: "Synthetic sync", vitals_json: '{"systolic":122,"diastolic":78}', cost: 100, paid: false };
    case "antropometrias": return { ...common, measured_at: now, weight_kg: 70, height_m: 1.7, circumferences: { waist: 80 } };
    case "lab_panels": return { ...common, taken_at: now, lab_name: "Synthetic lab", results: [{ test: "glucose", value: 90 }] };
    case "planes_alimenticios": return { ...common, consultation_id: consultation, name: "Synthetic plan", start_date: now, kcal_target: 1800, protein_target_g: 100, carbs_target_g: 200, fat_target_g: 66, meals_json: '[{"slot":"breakfast","exchanges":[{"foodId":"synthetic","count":2}]}]', status: "active" };
    case "adherence_records": return { ...common, consultation_id: consultation, date: "2026-09-09", source: "app", adherence_menu: 80, adherence_water: 80, adherence_activity: 80, adherence_supplements: 80, adherence_sleep: 80 };
  }
}

function operation(entity: SyncableEntity, row: Record<string, unknown>, op: SyncPushOperation["op"] = "create", expectedRowVersion?: string): SyncPushOperation {
  return { operationId: randomUUID(), entity, id: String(row.id), op, payload: op === "delete" ? null : toApiPayload(entity, row), clientUpdatedAt: now, expectedRowVersion };
}
const send = async (op: SyncPushOperation) => (await pushBatch({ sucursalId: branch, operations: [op] }, actor)).results[0]!;

describe.runIf(enabled)("six-entity SQL sync integrity on disposable local SQL", () => {
  beforeAll(async () => {
    expect(process.env.DB_SERVER?.toLowerCase()).toBe("localhost\\sqlexpress");
    expect(process.env.DB_NAME).toMatch(/^nc_step03a_sync_[0-9a-f]{8}$/);
    expect(process.env.ENVIRONMENT_CLASS).toBe("TEST");
    const pool = await getPool();
    await pool.request().input("branch", sql.UniqueIdentifier, branch).input("actor", sql.UniqueIdentifier, actor.id)
      .query("INSERT INTO sucursales (id,nombre) VALUES (@branch,'Synthetic Step03A'); INSERT INTO profesionales (id,email,password_hash,nombre_completo,rol) VALUES (@actor,'synthetic-step03a@example.invalid','UNUSABLE_TEST_HASH','Synthetic Step03A','admin');");
    expect((await send(operation("pacientes", localRow("pacientes", patient)))).status).toBe("applied");
    expect((await send(operation("consultas", localRow("consultas", consultation)))).status).toBe("applied");
  }, 30_000);
  afterAll(async () => { await closePool(); }, 30_000);

  for (const entity of ["pacientes", "consultas", "antropometrias", "lab_panels", "planes_alimenticios", "adherence_records"] as const) {
    it(`${entity}: Dexie representation -> push -> SQL -> pull -> representation; replay, stale update and tombstone`, async () => {
      const row = localRow(entity);
      const create = operation(entity, row);
      const first = await send(create);
      expect(first, JSON.stringify(first)).toMatchObject({ status: "applied", operationId: create.operationId });
      expect(first.serverRowVersion).toBeTruthy();
      // Simulates a response lost after COMMIT: exact UUID/payload replay must
      // return the original acknowledgement without another SQL write.
      expect(await send(create)).toEqual(first);
      const pull = await pullChanges(branch, null, [entity], actor);
      const change = pull.changes.find((item) => item.id.toLowerCase() === String(row.id).toLowerCase())!;
      expect(change).toBeDefined();
      const reconstructed = toLocalPayload(entity, JSON.parse(JSON.stringify(change.payload)) as Record<string, unknown>);
      expect(reconstructed.id).toBe(row.id);
      if (entity === "consultas") expect(JSON.parse(String(reconstructed.vitals_json))).toEqual(JSON.parse(String(row.vitals_json)));
      if (entity === "planes_alimenticios") {
        expect(String(reconstructed.consultation_id).toLowerCase()).toBe(consultation.toLowerCase());
        expect(JSON.parse(String(reconstructed.meals_json))).toEqual(JSON.parse(String(row.meals_json)));
        expect(reconstructed).not.toHaveProperty("consulta_id");
      }
      if (entity === "pacientes") expect(reconstructed.first_name).toBe(row.first_name);
      if (entity === "antropometrias") expect(reconstructed.weight_kg).toBe(70);
      if (entity === "lab_panels") expect(reconstructed.results).toEqual(row.results);
      if (entity === "adherence_records") {
        expect(reconstructed.adherence_menu).toBe(80);
        expect(reconstructed.date).toBe("2026-09-09");
        expect(typeof reconstructed.created_at).toBe("number");
        expect(typeof reconstructed.updated_at).toBe("number");
      }

      const edit = operation(entity, { ...row, ...(entity === "pacientes" ? { first_name: "Edited" } : entity === "consultas" ? { reason: "Edited" } : { notes: "Edited" }) }, "update", first.serverRowVersion);
      const updated = await send(edit);
      expect(updated, JSON.stringify(updated)).toMatchObject({ status: "applied" });
      expect(updated.serverRowVersion).not.toBe(first.serverRowVersion);
      expect(await send(edit)).toEqual(updated);
      expect(await send({ ...edit, operationId: randomUUID() })).toMatchObject({ status: "conflict", error: "ROW_VERSION_CONFLICT" });
      const reboundPayload = entity === "pacientes"
        ? { first_name: "Changed idempotency payload" }
        : entity === "consultas"
          ? { reason: "Changed idempotency payload" }
          : { notes: "Changed idempotency payload" };
      expect(await send({ ...edit, payload: reboundPayload })).toMatchObject({ status: "error", error: "OPERATION_ID_REUSED" });

      const remove = operation(entity, row, "delete", updated.serverRowVersion);
      const deleted = await send(remove);
      expect(deleted, JSON.stringify(deleted)).toMatchObject({ status: "applied", serverDeleted: true });
      expect(await send(remove)).toEqual(deleted);
      expect(await send(operation(entity, row, "update", deleted.serverRowVersion))).toMatchObject({ status: "conflict", error: "ENTITY_DELETED" });
      const tombstone = (await pullChanges(branch, pull.cursors, [entity], actor)).changes.find((item) => item.id.toLowerCase() === String(row.id).toLowerCase());
      expect(tombstone?.op).toBe("delete");
      const count = await (await getPool()).request().input("id", sql.UniqueIdentifier, row.id)
        .query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${entity} WHERE id=@id`);
      expect(count.recordset[0]!.n).toBe(1);
    });
  }

  it("concurrent writers with one base version produce one apply and one explicit conflict", async () => {
    const row = localRow("pacientes");
    const created = await send(operation("pacientes", row));
    const results = await Promise.all(["A", "B"].map((name) => send(operation("pacientes", { ...row, first_name: name }, "update", created.serverRowVersion))));
    expect(results.map((result) => result.status).sort()).toEqual(["applied", "conflict"]);
  });

  it("serializes concurrent replay of the same operation UUID to one mutation receipt", async () => {
    const row = localRow("pacientes");
    const op = operation("pacientes", row);
    const results = await Promise.all([send(op), send(op)]);
    expect(results).toEqual([results[0], results[0]]);
    expect(results[0]).toMatchObject({ status: "applied", operationId: op.operationId });
    const receipt = await (await getPool()).request()
      .input("id", sql.UniqueIdentifier, op.operationId)
      .query<{ n: number }>("SELECT COUNT(*) AS n FROM audit_log WHERE id=@id AND entity_type='sync_receipt_v1'");
    expect(receipt.recordset[0]!.n).toBe(1);
  });

  it("does not advance the ROWVERSION cursor past a writer that commits late", async () => {
    const delayedRow = localRow("pacientes");
    const fastRow = localRow("pacientes");
    expect((await send(operation("pacientes", delayedRow))).status).toBe("applied");
    expect((await send(operation("pacientes", fastRow))).status).toBe("applied");
    const baseline = await pullChanges(branch, null, ["pacientes"], actor);
    const tx = (await getPool()).transaction();
    let committed = false;
    try {
      await tx.begin();
      await tx.request()
        .input("id", sql.UniqueIdentifier, delayedRow.id)
        .query("UPDATE pacientes SET nombres='Delayed commit', updated_at=SYSUTCDATETIME() WHERE id=@id");
      await (await getPool()).request()
        .input("id", sql.UniqueIdentifier, fastRow.id)
        .query("UPDATE pacientes SET nombres='Fast commit', updated_at=SYSUTCDATETIME() WHERE id=@id");

      const fencedPull = pullChanges(branch, baseline.cursors, ["pacientes"], actor);
      // READ COMMITTED can wait while scanning the locked row even though the
      // captured fence excludes it. Release it explicitly and inspect the
      // response produced with the earlier fence.
      await new Promise((resolve) => setTimeout(resolve, 200));
      await tx.commit();
      committed = true;
      const fenced = await fencedPull;
      expect(fenced.changes).toEqual([]);
      expect(fenced.cursors).toEqual({});

      const resumed = await pullChanges(branch, baseline.cursors, ["pacientes"], actor);
      expect(resumed.changes.map((change) => change.id.toLowerCase()).sort()).toEqual([
        String(delayedRow.id).toLowerCase(),
        String(fastRow.id).toLowerCase(),
      ].sort());
    } finally {
      if (!committed) await tx.rollback().catch(() => undefined);
    }
  }, 20_000);

  it("receipt and mutation roll back together when receipt persistence fails", async () => {
    const pool = await getPool();
    const row = localRow("pacientes");
    const op = operation("pacientes", row);
    await pool.request().query("CREATE TRIGGER step03a_reject_receipt ON audit_log AFTER INSERT AS BEGIN IF EXISTS (SELECT 1 FROM inserted WHERE entity_type='sync_receipt_v1') THROW 51003, 'Synthetic receipt persistence failure', 1; END");
    try {
      expect((await send(op)).status).toBe("error");
      const result = await pool.request().input("id", sql.UniqueIdentifier, row.id).query<{ n: number }>("SELECT COUNT(*) AS n FROM pacientes WHERE id=@id");
      expect(result.recordset[0]!.n).toBe(0);
    } finally { await pool.request().query("DROP TRIGGER step03a_reject_receipt"); }
    expect((await send(op)).status).toBe("applied");
  });

  it("reserves conflict UUIDs and projects evidence for billing actors", async () => {
    const operationId = randomUUID();
    const stale: SyncPushOperation = {
      operationId,
      entity: "consultas",
      id: consultation,
      op: "update",
      payload: {
        payment_status: "paid",
        reason: "SENSITIVE_CLINICAL_INPUT",
      },
      expectedRowVersion: Buffer.alloc(8).toString("base64"),
      clientUpdatedAt: now,
    };
    const billingActor = { id: actor.id, role: "facturacion" as const };
    const conflict = (await pushBatch(
      { sucursalId: branch, operations: [stale] },
      billingActor,
    )).results[0]!;

    expect(conflict).toMatchObject({
      status: "conflict",
      error: "ROW_VERSION_CONFLICT",
      operationId,
    });
    expect(conflict.serverPayload).not.toHaveProperty("reason");
    expect(conflict.serverPayload).not.toHaveProperty("subjective");

    const rebound = (await pushBatch(
      {
        sucursalId: branch,
        operations: [{
          ...stale,
          payload: { payment_status: "partial" },
          expectedRowVersion: conflict.serverRowVersion,
        }],
      },
      billingActor,
    )).results[0]!;
    expect(rebound).toMatchObject({
      status: "error",
      error: "OPERATION_ID_REUSED",
    });
  });

  it("requires active persisted parents for restore and keeps rejection retryable", async () => {
    const parentRow = localRow("pacientes");
    const childRow = {
      ...localRow("consultas"),
      patient_id: parentRow.id,
    };
    const parentCreated = await send(operation("pacientes", parentRow));
    const childCreated = await send(operation("consultas", childRow));
    const childDeleted = await send(operation(
      "consultas",
      childRow,
      "delete",
      childCreated.serverRowVersion,
    ));
    const parentDeleted = await send(operation(
      "pacientes",
      parentRow,
      "delete",
      parentCreated.serverRowVersion,
    ));
    const restoreChild: SyncPushOperation = {
      ...operation(
        "consultas",
        childRow,
        "update",
        childDeleted.serverRowVersion,
      ),
      restoreDeleted: true,
    };

    expect(await send(restoreChild)).toMatchObject({
      status: "error",
      error: "SYNC_OPERATION_REJECTED_404",
    });
    expect(await send({
      ...operation(
        "pacientes",
        parentRow,
        "update",
        parentDeleted.serverRowVersion,
      ),
      restoreDeleted: true,
    })).toMatchObject({ status: "applied" });
    expect(await send(restoreChild)).toMatchObject({ status: "applied" });
  });

  it("does not commit a parent tombstone while an active child remains", async () => {
    const parentRow = localRow("pacientes");
    const childRow = {
      ...localRow("consultas"),
      patient_id: parentRow.id,
    };
    const parentCreated = await send(operation("pacientes", parentRow));
    const childCreated = await send(operation("consultas", childRow));
    const deleteParent = operation(
      "pacientes",
      parentRow,
      "delete",
      parentCreated.serverRowVersion,
    );

    expect(await send(deleteParent)).toMatchObject({
      status: "error",
      error: "SYNC_OPERATION_REJECTED_409",
    });
    expect(await send(operation(
      "consultas",
      childRow,
      "delete",
      childCreated.serverRowVersion,
    ))).toMatchObject({ status: "applied" });
    expect(await send(deleteParent)).toMatchObject({ status: "applied" });
  });

  it("rejects consultation links owned by a different patient", async () => {
    const ownerRow = localRow("pacientes");
    const otherRow = localRow("pacientes");
    expect(await send(operation("pacientes", ownerRow))).toMatchObject({ status: "applied" });
    expect(await send(operation("pacientes", otherRow))).toMatchObject({ status: "applied" });
    const measurementId = randomUUID();
    const measurement = {
      ...localRow("antropometrias", measurementId),
      patient_id: otherRow.id,
    };
    expect(await send(operation("antropometrias", measurement))).toMatchObject({ status: "applied" });
    const invalidConsultation = {
      ...localRow("consultas"),
      patient_id: ownerRow.id,
      anthropometry_id: measurementId,
    };

    expect(await send(operation("consultas", invalidConsultation))).toMatchObject({
      status: "error",
      error: "SYNC_OPERATION_REJECTED_404",
    });
  });

  it("resets a cursor beyond the current database rowversion horizon", async () => {
    const replay = await pullChanges(
      branch,
      { pacientes: "rv:ffffffffffffffff" },
      ["pacientes"],
      actor,
    );
    expect(replay.changes.some(
      (change) => change.id.toLowerCase() === patient.toLowerCase(),
    )).toBe(true);
  });
});
