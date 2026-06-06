/**
 * CascadingPatientDeletor: soft-delete en cascada para un paciente.
 *
 * Estrategia:
 *  - Itera sobre cada tabla sincronizable con FK a pacientes.
 *  - Por cada fila con `patient_id = X` y `deleted_at = null`:
 *      1) la reconstituye a su entidad de dominio
 *      2) llama al método de soft-delete de la entidad
 *      3) la persiste con `put`
 *  - El SyncEnqueuer detecta cada `put` y encola la operación `delete`
 *    en sync_queue. El push del servidor borra cada fila individualmente.
 *
 * Por qué soft-delete (no hard):
 *  - Consistente con el patrón del resto de la app (soft via deletedAt).
 *  - Permite descartar el cascade desde la UI si el usuario se arrepiente
 *    (descartar el item del queue no lo borra del server hasta el push,
 *    pero el server ya recibe la orden de soft-delete).
 *  - El reconciliador (reconcileAllPendingChanges) filtra filas soft-deleted,
 *    así que un cascade no se vuelve a encolar como create.
 */

import { db } from "@services/db/dexieSchema";
import { consultationRowToDomain, consultationDomainToRow } from "@modules/consultation/infrastructure/consultationMapper";
import { mealPlanRowToDomain, mealPlanDomainToRow } from "@modules/mealplan/infrastructure/mealPlanMapper";
import { labPanelRowToDomain, labPanelDomainToRow } from "@modules/laboratory/infrastructure/labPanelMapper";
import { anthropometryRowToDomain, anthropometryDomainToRow } from "@modules/anthropometry/infrastructure/anthropometryMapper";
import type { PatientId } from "@modules/patient/domain/PatientId";
import type { CascadingPatientDeletor, LinkedCounts, LinkedEntitiesInspector } from "@modules/patient/application/patientUseCases";

export class DexieCascadingPatientDeletor implements CascadingPatientDeletor {
  async softDeleteCascade(patientId: PatientId): Promise<void> {
    const pid = patientId.toString();

    await this.softDeleteInTable(
      db.consultations,
      (row) => row.patient_id === pid && row.deleted_at === null,
      consultationRowToDomain,
      consultationDomainToRow,
    );

    await this.softDeleteInTable(
      db.meal_plans,
      (row) => row.patient_id === pid && row.deleted_at === null,
      mealPlanRowToDomain,
      mealPlanDomainToRow,
    );

    await this.softDeleteInTable(
      db.lab_panels,
      (row) => row.patient_id === pid && row.deleted_at === null,
      labPanelRowToDomain,
      labPanelDomainToRow,
    );

    await this.softDeleteInTable(
      db.anthropometry,
      (row) => row.patient_id === pid && row.deleted_at === null,
      anthropometryRowToDomain,
      anthropometryDomainToRow,
    );
  }

  private async softDeleteInTable<R, D extends { softDelete(): D }>(
    table: { toArray(): Promise<R[]>; put(value: unknown): Promise<unknown> },
    predicate: (row: R) => boolean,
    toDomain: (row: R) => D,
    toRow: (domain: D) => R,
  ): Promise<number> {
    const rows = await table.toArray();
    const targets = rows.filter(predicate);
    for (const row of targets) {
      const domain = toDomain(row);
      const deleted = domain.softDelete();
      await table.put(toRow(deleted));
    }
    return targets.length;
  }
}

export class DexieLinkedEntitiesInspector implements LinkedEntitiesInspector {
  async countForPatient(patientId: PatientId): Promise<LinkedCounts> {
    const pid = patientId.toString();
    const [consultations, mealPlans, labPanels, anthropometry] = await Promise.all([
      db.consultations.filter((r) => r.patient_id === pid && r.deleted_at === null).count(),
      db.meal_plans.filter((r) => r.patient_id === pid && r.deleted_at === null).count(),
      db.lab_panels.filter((r) => r.patient_id === pid && r.deleted_at === null).count(),
      db.anthropometry.filter((r) => r.patient_id === pid && r.deleted_at === null).count(),
    ]);
    return { consultations, mealPlans, labPanels, anthropometry };
  }
}
