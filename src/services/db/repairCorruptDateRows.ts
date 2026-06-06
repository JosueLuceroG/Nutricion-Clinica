/**
 * Reparación de datos locales: escanea todas las tablas sincronizables
 * y reescribe filas que tengan campos de fecha inválidos (string vacío,
 * `Invalid Date`, valor no parseable).
 *
 * Por qué existe:
 *  - El pull del servidor puede dejar Date objects en IndexedDB; el
 *    round-trip a un string ISO nunca pasó por el mapper, así que si
 *    el mapper los lee y los vuelve a escribir, queda un string ISO
 *    válido.
 *  - Mutaciones interrumpidas a medio commit (recargar pestaña, crash
 *    del worker, etc.) pueden dejar campos requeridos en `""` o
 *    `undefined`. La próxima vez que el mapper los lea, `new Date("")`
 *    produce `Invalid Date` y `.toISOString()` lanza `RangeError`,
 *    rompiendo toda operación (e.g. soft-delete, edit) sin manera
 *    limpia de recuperar.
 *
 * Estrategia:
 *  - Lee cada fila con `toArray()`.
 *  - La pasa por el mapper row→domain (que ahora es defensivo vía
 *    `safeDate` y reemplaza fechas inválidas por fallbacks).
 *  - La vuelve a escribir con `domain→row` (que también es defensivo).
 *  - Reporta cuántas filas fueron tocadas.
 *
 * Esta función es segura de correr varias veces: si la fila ya está
 * sana, el round-trip no la modifica.
 */

import { db } from "@services/db/dexieSchema";
import { patientRowToDomain, patientDomainToRow } from "@modules/patient/infrastructure/patientMapper";
import { consultationRowToDomain, consultationDomainToRow } from "@modules/consultation/infrastructure/consultationMapper";
import { anthropometryRowToDomain, anthropometryDomainToRow } from "@modules/anthropometry/infrastructure/anthropometryMapper";
import { labPanelRowToDomain, labPanelDomainToRow } from "@modules/laboratory/infrastructure/labPanelMapper";
import { mealPlanRowToDomain, mealPlanDomainToRow } from "@modules/mealplan/infrastructure/mealPlanMapper";
import { isInvalidDateValue } from "./safeDate";

export interface RepairResult {
  scanned: number;
  repaired: number;
  byTable: Record<string, { scanned: number; repaired: number }>;
}

const DATE_FIELD_KEYS = [
  "created_at",
  "updated_at",
  "deleted_at",
  "birth_date",
  "record_opened_at",
  "fecha_firma_consentimiento",
  "consultation_date",
  "next_visit_date",
  "measured_at",
  "taken_at",
  "start_date",
  "end_date",
];

function rowHasInvalidDate(row: Record<string, unknown>): boolean {
  return DATE_FIELD_KEYS.some((k) => k in row && isInvalidDateValue((row as Record<string, unknown>)[k]));
}

/**
 * Recorre todas las tablas sincronizables y reescribe las filas que
 * tengan fechas inválidas. Devuelve un reporte para mostrar en UI.
 */
export async function repairCorruptDateRows(): Promise<RepairResult> {
  const result: RepairResult = { scanned: 0, repaired: 0, byTable: {} };

  const tasks: Array<{ name: string; run: () => Promise<void> }> = [
    {
      name: "patients",
      run: async () => {
        const rows = await db.patients.toArray();
        let scanned = 0;
        let repaired = 0;
        for (const row of rows) {
          scanned++;
          if (!rowHasInvalidDate(row as unknown as Record<string, unknown>)) continue;
          const domain = patientRowToDomain(row);
          await db.patients.put(patientDomainToRow(domain));
          repaired++;
        }
        result.byTable.patients = { scanned, repaired };
        result.scanned += scanned;
        result.repaired += repaired;
      },
    },
    {
      name: "consultations",
      run: async () => {
        const rows = await db.consultations.toArray();
        let scanned = 0;
        let repaired = 0;
        for (const row of rows) {
          scanned++;
          if (!rowHasInvalidDate(row as unknown as Record<string, unknown>)) continue;
          const domain = consultationRowToDomain(row);
          await db.consultations.put(consultationDomainToRow(domain));
          repaired++;
        }
        result.byTable.consultations = { scanned, repaired };
        result.scanned += scanned;
        result.repaired += repaired;
      },
    },
    {
      name: "anthropometry",
      run: async () => {
        const rows = await db.anthropometry.toArray();
        let scanned = 0;
        let repaired = 0;
        for (const row of rows) {
          scanned++;
          if (!rowHasInvalidDate(row as unknown as Record<string, unknown>)) continue;
          const domain = anthropometryRowToDomain(row);
          await db.anthropometry.put(anthropometryDomainToRow(domain));
          repaired++;
        }
        result.byTable.anthropometry = { scanned, repaired };
        result.scanned += scanned;
        result.repaired += repaired;
      },
    },
    {
      name: "lab_panels",
      run: async () => {
        const rows = await db.lab_panels.toArray();
        let scanned = 0;
        let repaired = 0;
        for (const row of rows) {
          scanned++;
          if (!rowHasInvalidDate(row as unknown as Record<string, unknown>)) continue;
          const domain = labPanelRowToDomain(row);
          await db.lab_panels.put(labPanelDomainToRow(domain));
          repaired++;
        }
        result.byTable.lab_panels = { scanned, repaired };
        result.scanned += scanned;
        result.repaired += repaired;
      },
    },
    {
      name: "meal_plans",
      run: async () => {
        const rows = await db.meal_plans.toArray();
        let scanned = 0;
        let repaired = 0;
        for (const row of rows) {
          scanned++;
          if (!rowHasInvalidDate(row as unknown as Record<string, unknown>)) continue;
          const domain = mealPlanRowToDomain(row);
          await db.meal_plans.put(mealPlanDomainToRow(domain));
          repaired++;
        }
        result.byTable.meal_plans = { scanned, repaired };
        result.scanned += scanned;
        result.repaired += repaired;
      },
    },
  ];

  for (const t of tasks) {
    try {
      await t.run();
    } catch (err) {
      // Si una tabla falla, seguimos con las demás para que el usuario
      // pueda reparar lo que sí se pueda.
       
      console.error(`[repair] tabla ${t.name} falló:`, err);
      result.byTable[t.name] = {
        scanned: 0,
        repaired: 0,
      };
    }
  }

  return result;
}
