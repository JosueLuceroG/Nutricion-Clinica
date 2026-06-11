import type { Dexie } from "dexie";
import type {
  EvolutionRecordProps,
} from "../domain/EvolutionRecord";
import { EvolutionRecord } from "../domain/EvolutionRecord";
import type {
  EvolutionIndicatorProps,
} from "../domain/EvolutionIndicator";
import { EvolutionIndicator } from "../domain/EvolutionIndicator";
import type {
  TemporalComparisonProps,
} from "../domain/TemporalComparison";
import { TemporalComparison } from "../domain/TemporalComparison";
import type {
  StagnationAlertProps,
} from "../domain/StagnationAlert";
import { StagnationAlert } from "../domain/StagnationAlert";
import type { EvolutionRepository } from "../domain/EvolutionRepository";
import {
  recordToRow, rowToRecord, type EvolutionRecordRow,
  indicatorToRow, rowToIndicator, type EvolutionIndicatorRow,
  comparisonToRow, rowToComparison, type TemporalComparisonRow,
  alertToRow, rowToAlert, type StagnationAlertRow,
} from "./evolutionMapper";

export class DexieEvolutionRepository implements EvolutionRepository {
  private db: Dexie;

  constructor(db: Dexie) {
    this.db = db;
  }

  // Evolution Records
  async createRecord(props: EvolutionRecordProps): Promise<EvolutionRecord> {
    const row = recordToRow(props);
    await this.db.table("evolution_records").add(row);
    return new EvolutionRecord(rowToRecord(row));
  }

  async updateRecord(id: string, props: Partial<EvolutionRecordProps>): Promise<EvolutionRecord> {
    const existing = await this.db.table("evolution_records").get(id) as EvolutionRecordRow | undefined;
    if (!existing) throw new Error(`EvolutionRecord no encontrado: ${id}`);
    const merged = { ...existing, ...recordToRow({ ...existing as unknown as EvolutionRecordProps, ...props }), updated_at: Date.now() };
    await this.db.table("evolution_records").put(merged);
    return new EvolutionRecord(rowToRecord(merged));
  }

  async findRecordById(id: string): Promise<EvolutionRecord | null> {
    const row = await this.db.table("evolution_records").get(id) as EvolutionRecordRow | undefined;
    return row ? new EvolutionRecord(rowToRecord(row)) : null;
  }

  async findRecordsByPatient(patientId: string): Promise<EvolutionRecord[]> {
    const rows = await this.db.table("evolution_records").where("patient_id").equals(patientId).toArray() as EvolutionRecordRow[];
    return rows.map((r) => new EvolutionRecord(rowToRecord(r)));
  }

  async findRecordsByConsultation(consultationId: string): Promise<EvolutionRecord | null> {
    const row = await this.db.table("evolution_records").where("consultation_id").equals(consultationId).first() as EvolutionRecordRow | undefined;
    return row ? new EvolutionRecord(rowToRecord(row)) : null;
  }

  // Evolution Indicators
  async createIndicator(props: EvolutionIndicatorProps): Promise<EvolutionIndicator> {
    const row = indicatorToRow(props);
    await this.db.table("evolution_indicators").add(row);
    return new EvolutionIndicator(rowToIndicator(row));
  }

  async findIndicatorsByPatient(patientId: string): Promise<EvolutionIndicator[]> {
    const rows = await this.db.table("evolution_indicators").where("patient_id").equals(patientId).toArray() as EvolutionIndicatorRow[];
    return rows.map((r) => new EvolutionIndicator(rowToIndicator(r)));
  }

  async findIndicatorsByConsultation(consultationId: string): Promise<EvolutionIndicator[]> {
    const rows = await this.db.table("evolution_indicators").where("current_consultation_id").equals(consultationId).toArray() as EvolutionIndicatorRow[];
    return rows.map((r) => new EvolutionIndicator(rowToIndicator(r)));
  }

  async findLatestIndicator(patientId: string, variable: string): Promise<EvolutionIndicator | null> {
    const rows = await this.db.table("evolution_indicators")
      .where({ patient_id: patientId, variable })
      .reverse()
      .sortBy("calculated_at") as EvolutionIndicatorRow[];
    return rows.length > 0 ? new EvolutionIndicator(rowToIndicator(rows[0])) : null;
  }

  // Temporal Comparisons
  async createComparison(props: TemporalComparisonProps): Promise<TemporalComparison> {
    const row = comparisonToRow(props);
    await this.db.table("temporal_comparisons").add(row);
    return new TemporalComparison(rowToComparison(row));
  }

  async findComparisonsByPatient(patientId: string): Promise<TemporalComparison[]> {
    const rows = await this.db.table("temporal_comparisons").where("patient_id").equals(patientId).toArray() as TemporalComparisonRow[];
    return rows.map((r) => new TemporalComparison(rowToComparison(r)));
  }

  async findComparisonBetween(consultationA: string, consultationB: string): Promise<TemporalComparison | null> {
    const rows = await this.db.table("temporal_comparisons").toArray() as TemporalComparisonRow[];
    const match = rows.find(
      (r) => (r.current_consultation_id === consultationA && r.compared_consultation_id === consultationB)
        || (r.current_consultation_id === consultationB && r.compared_consultation_id === consultationA),
    );
    return match ? new TemporalComparison(rowToComparison(match)) : null;
  }

  // Stagnation Alerts
  async createStagnationAlert(props: StagnationAlertProps): Promise<StagnationAlert> {
    const row = alertToRow(props);
    await this.db.table("stagnation_alerts").add(row);
    return new StagnationAlert(rowToAlert(row));
  }

  async updateStagnationAlert(id: string, props: Partial<StagnationAlertProps>): Promise<StagnationAlert> {
    const existing = await this.db.table("stagnation_alerts").get(id) as StagnationAlertRow | undefined;
    if (!existing) throw new Error(`StagnationAlert no encontrado: ${id}`);
    const merged = { ...existing, ...alertToRow({ ...existing as unknown as StagnationAlertProps, ...props }) };
    await this.db.table("stagnation_alerts").put(merged);
    return new StagnationAlert(rowToAlert(merged));
  }

  async findActiveAlertsByPatient(patientId: string): Promise<StagnationAlert[]> {
    const rows = await this.db.table("stagnation_alerts")
      .where("patient_id").equals(patientId)
      .filter((r) => r.resolved_at === null)
      .toArray() as StagnationAlertRow[];
    return rows.map((r) => new StagnationAlert(rowToAlert(r)));
  }

  async resolveAlert(id: string): Promise<void> {
    await this.db.table("stagnation_alerts").update(id, { resolved_at: Date.now() } as Partial<StagnationAlertRow>);
  }
}
