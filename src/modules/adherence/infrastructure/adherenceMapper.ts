import { AdherenceRecord, type AdherenceRecordProps } from "../domain/AdherenceRecord";
import type { AdherenceId } from "../domain/AdherenceId";
import { BarrierEvent, type BarrierEventProps } from "../domain/BarrierEvent";
import { AdherenceIndex, type AdherenceIndexProps } from "../domain/AdherenceIndex";

export interface AdherenceRecordRow {
  id: string;
  sucursal_id?: string | null;
  patient_id: string;
  date: string;
  consultation_id: string | null;
  source: string;
  adherence_menu: number;
  adherence_water: number;
  adherence_activity: number;
  adherence_supplements: number;
  adherence_sleep: number;
  hunger_avg: number | null;
  satiety_avg: number | null;
  mood_avg: number | null;
  energy_avg: number | null;
  intercurrent_events: string;
  barriers: string;
  facilitators: string;
  meals_logged: string;
  notes: string;
  created_at: number;
  updated_at: number;
}
export interface AdherenceIndexRow {
  id: string;
  sucursal_id?: string | null;
  patient_id: string;
  period_start: string;
  period_end: string;
  score_menu: number;
  score_water: number;
  score_activity: number;
  score_supplements: number;
  score_sleep: number;
  score_global: number;
  tendency: string;
  calculated_at: number;
}
export interface BarrierEventRow {
  id: string;
  patient_id: string;
  type: string;
  description: string;
  date: string;
  resolution_date: string | null;
  action_taken: string;
  created_at: number;
}

export function adherenceRecordToRow(record: AdherenceRecord): AdherenceRecordRow {
  const p = record.toProps();
  return {
    id: p.id,
    patient_id: p.patientId,
    date: p.date,
    consultation_id: p.consultationId ?? null,
    source: p.source,
    adherence_menu: p.adherenceMenu,
    adherence_water: p.adherenceWater,
    adherence_activity: p.adherenceActivity,
    adherence_supplements: p.adherenceSupplements,
    adherence_sleep: p.adherenceSleep,
    hunger_avg: p.hungerAvg ?? null,
    satiety_avg: p.satietyAvg ?? null,
    mood_avg: p.moodAvg ?? null,
    energy_avg: p.energyAvg ?? null,
    intercurrent_events: p.intercurrentEvents,
    barriers: p.barriers,
    facilitators: p.facilitators,
    meals_logged: p.mealsLogged,
    notes: p.notes,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function rowToAdherenceRecord(row: AdherenceRecordRow): AdherenceRecord {
  return AdherenceRecord.reconstitute({
    id: row.id as AdherenceId,
    patientId: row.patient_id,
    date: row.date,
    consultationId: row.consultation_id ?? undefined,
    source: row.source as AdherenceRecordProps["source"],
    adherenceMenu: row.adherence_menu,
    adherenceWater: row.adherence_water,
    adherenceActivity: row.adherence_activity,
    adherenceSupplements: row.adherence_supplements,
    adherenceSleep: row.adherence_sleep,
    hungerAvg: row.hunger_avg ?? undefined,
    satietyAvg: row.satiety_avg ?? undefined,
    moodAvg: row.mood_avg ?? undefined,
    energyAvg: row.energy_avg ?? undefined,
    intercurrentEvents: row.intercurrent_events,
    barriers: row.barriers,
    facilitators: row.facilitators,
    mealsLogged: row.meals_logged,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function adherenceIndexToRow(index: AdherenceIndex): AdherenceIndexRow {
  const p = index.toProps();
  return {
    id: p.id,
    patient_id: p.patientId,
    period_start: p.periodStart,
    period_end: p.periodEnd,
    score_menu: p.scoreMenu,
    score_water: p.scoreWater,
    score_activity: p.scoreActivity,
    score_supplements: p.scoreSupplements,
    score_sleep: p.scoreSleep,
    score_global: p.scoreGlobal,
    tendency: p.tendency,
    calculated_at: p.calculatedAt,
  };
}

export function rowToAdherenceIndex(row: AdherenceIndexRow): AdherenceIndex {
  return AdherenceIndex.reconstitute({
    id: row.id,
    patientId: row.patient_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    scoreMenu: row.score_menu,
    scoreWater: row.score_water,
    scoreActivity: row.score_activity,
    scoreSupplements: row.score_supplements,
    scoreSleep: row.score_sleep,
    scoreGlobal: row.score_global,
    tendency: row.tendency as AdherenceIndexProps["tendency"],
    calculatedAt: row.calculated_at,
  });
}

export function barrierEventToRow(barrier: BarrierEvent): BarrierEventRow {
  const p = barrier.toProps();
  return {
    id: p.id,
    patient_id: p.patientId,
    type: p.type,
    description: p.description,
    date: p.date,
    resolution_date: p.resolutionDate ?? null,
    action_taken: p.actionTaken,
    created_at: p.createdAt,
  };
}

export function rowToBarrierEvent(row: BarrierEventRow): BarrierEvent {
  return BarrierEvent.reconstitute({
    id: row.id,
    patientId: row.patient_id,
    type: row.type as BarrierEventProps["type"],
    description: row.description,
    date: row.date,
    resolutionDate: row.resolution_date ?? undefined,
    actionTaken: row.action_taken,
    createdAt: row.created_at,
  });
}
