import type { PatientRow } from "@modules/patient/infrastructure/patientMapper";

const EXPORT_HEADERS = [
  "nombre",
  "apellido",
  "segundo apellido",
  "fecha de nacimiento",
  "sexo",
  "correo",
  "teléfono",
  "whatsapp",
  "ocupación",
  "notas",
] as const;

function csvCell(value: string | null | undefined): string {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

export function currentPatientRowsForBranch(
  rows: PatientRow[],
  branchId: string | null,
): PatientRow[] {
  return rows
    .filter(
      (row) =>
        row.deleted_at === null &&
        (!branchId || !row.sucursal_id || row.sucursal_id === branchId),
    )
    .sort((left, right) =>
      `${left.last_name} ${left.first_name}`.localeCompare(
        `${right.last_name} ${right.first_name}`,
        "es",
      ),
    );
}

export function patientRowsToCsv(rows: PatientRow[]): string {
  const body = rows.map((row) =>
    [
      row.first_name,
      row.last_name,
      row.second_last_name,
      row.birth_date.slice(0, 10),
      row.sex,
      row.email,
      row.phone,
      row.whatsapp_enabled === true
        ? "true"
        : row.whatsapp_enabled === false
          ? "false"
          : null,
      row.occupation,
      row.general_notes,
    ]
      .map(csvCell)
      .join(","),
  );

  return [EXPORT_HEADERS.map(csvCell).join(","), ...body].join("\n");
}
