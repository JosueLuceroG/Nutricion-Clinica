import Dexie, { type Table } from "dexie";
import type { PatientRow } from "@modules/patient/infrastructure/patientMapper";
import type { AnthropometryRow } from "@modules/anthropometry/infrastructure/anthropometryMapper";
import type { LabPanelRow } from "@modules/laboratory/infrastructure/labPanelMapper";
import type { ConsultationRow } from "@modules/consultation/infrastructure/consultationMapper";

export class NutriClinicaDB extends Dexie {
  patients!: Table<PatientRow, string>;
  anthropometry!: Table<AnthropometryRow, string>;
  lab_panels!: Table<LabPanelRow, string>;
  consultations!: Table<ConsultationRow, string>;

  constructor(name = "nutriclinica") {
    super(name);

    this.version(1).stores({
      patients: [
        "id",
        "first_name",
        "last_name",
        "[last_name+first_name]",
        "email",
        "status",
        "sex",
        "birth_date",
        "created_at",
        "updated_at",
        "deleted_at",
      ].join(", "),
      anthropometry: [
        "id",
        "patient_id",
        "measured_at",
        "[patient_id+measured_at]",
        "created_at",
        "updated_at",
        "deleted_at",
      ].join(", "),
      lab_panels: [
        "id",
        "patient_id",
        "taken_at",
        "[patient_id+taken_at]",
        "created_at",
        "updated_at",
        "deleted_at",
      ].join(", "),
      consultations: [
        "id",
        "patient_id",
        "consultation_date",
        "[patient_id+consultation_date]",
        "status",
        "anthropometry_id",
        "lab_panel_id",
        "created_at",
        "updated_at",
        "deleted_at",
      ].join(", "),
    });
  }
}

export const db = new NutriClinicaDB();
