import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { PatientId } from "@modules/patient/domain/PatientId";
import { db } from "@services/db/dexieSchema";
import { markRemoteTransaction } from "@services/sync/atomicOutbox";
import { useSyncStore } from "@store/syncStore";
import {
  DexieCascadingPatientDeletor,
  DexieLinkedEntitiesInspector,
} from "./cascadingPatientDeletor";

describe("DexieCascadingPatientDeletor", () => {
  beforeEach(async () => {
    useSyncStore.getState().setSucursalId("11111111-1111-4111-8111-111111111111");
    await db.transaction(
      "rw",
      [db.consultations, db.meal_plans, db.lab_panels, db.anthropometry, db.adherence_records, db.sync_queue],
      async () => {
        markRemoteTransaction();
        await Promise.all([
          db.consultations.clear(),
          db.meal_plans.clear(),
          db.lab_panels.clear(),
          db.anthropometry.clear(),
          db.adherence_records.clear(),
          db.sync_queue.clear(),
        ]);
      },
    );
  });

  it("cuenta y convierte adherencia activa en tombstones durables", async () => {
    const patientId = PatientId.generate();
    const otherPatientId = PatientId.generate();
    const targetId = crypto.randomUUID();
    const otherId = crypto.randomUUID();
    const otherBranchId = crypto.randomUUID();
    await db.transaction("rw", db.adherence_records, async () => {
      markRemoteTransaction();
      await db.adherence_records.bulkPut([
        {
          id: targetId,
          sucursal_id: "11111111-1111-4111-8111-111111111111",
          patient_id: patientId.toString(),
          consultation_id: null,
          date: "2026-09-12",
          source: "manual",
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: null,
          row_version: "AAAAAAAAAAE=",
        },
        {
          id: otherId,
          sucursal_id: "11111111-1111-4111-8111-111111111111",
          patient_id: otherPatientId.toString(),
          consultation_id: null,
          date: "2026-09-12",
          source: "manual",
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: null,
          row_version: "AAAAAAAAAAE=",
        },
        {
          id: otherBranchId,
          sucursal_id: "22222222-2222-4222-8222-222222222222",
          patient_id: patientId.toString(),
          consultation_id: null,
          date: "2026-09-12",
          source: "manual",
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: null,
          row_version: "AAAAAAAAAAE=",
        },
      ] as never);
    });

    expect(await new DexieLinkedEntitiesInspector().countForPatient(patientId))
      .toMatchObject({ adherenceRecords: 1 });

    await new DexieCascadingPatientDeletor().softDeleteCascade(patientId);

    expect(await db.adherence_records.get(targetId)).toMatchObject({ deleted_at: expect.any(String) });
    expect(await db.adherence_records.get(otherId)).toMatchObject({ deleted_at: null });
    expect(await db.adherence_records.get(otherBranchId)).toMatchObject({ deleted_at: null });
    expect(await db.sync_queue.toArray()).toEqual([
      expect.objectContaining({
        entity: "adherence_records",
        entityId: targetId,
        op: "delete",
      }),
    ]);
  });
});
