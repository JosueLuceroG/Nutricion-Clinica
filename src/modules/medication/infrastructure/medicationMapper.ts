import { MedicationCatalog, type MedicationCatalogProps } from "../domain/MedicationCatalog";
import { NutrientInteraction, type NutrientInteractionProps } from "../domain/NutrientInteraction";
import type { MedicationCatalogId } from "../domain/MedicationCatalogId";

export interface MedicationCatalogRow {
  id: string;
  nombre_comercial: string;
  principio_activo: string;
  presentacion: string;
  concentracion: string;
  via_administracion: string;
  categoria_farmacologica: string;
  efectos_secundarios_json: string;
  contraindicaciones_json: string;
  notas: string;
  created_at: number;
  updated_at: number;
}

export interface NutrientInteractionRow {
  id: string;
  medicamento_id: string;
  nutriente: string;
  tipo: string;
  severidad: string;
  recomendacion: string;
  fuente: string;
  fecha_vigencia: string | null;
  created_at: number;
  updated_at: number;
}

export function medicationCatalogRowToDomain(row: MedicationCatalogRow): MedicationCatalog {
  return MedicationCatalog.reconstitute({
    id: row.id as MedicationCatalogId,
    nombre_comercial: row.nombre_comercial,
    principio_activo: row.principio_activo,
    presentacion: row.presentacion,
    concentracion: row.concentracion,
    via_administracion: row.via_administracion as MedicationCatalogProps["via_administracion"],
    categoria_farmacologica: row.categoria_farmacologica,
    efectos_secundarios: JSON.parse(row.efectos_secundarios_json),
    contraindicaciones: JSON.parse(row.contraindicaciones_json),
    notas: row.notas,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function medicationCatalogDomainToRow(medication: MedicationCatalog): MedicationCatalogRow {
  const p = medication.toProps();
  return {
    id: p.id,
    nombre_comercial: p.nombre_comercial,
    principio_activo: p.principio_activo,
    presentacion: p.presentacion,
    concentracion: p.concentracion,
    via_administracion: p.via_administracion,
    categoria_farmacologica: p.categoria_farmacologica,
    efectos_secundarios_json: JSON.stringify(p.efectos_secundarios),
    contraindicaciones_json: JSON.stringify(p.contraindicaciones),
    notas: p.notas,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function nutrientInteractionRowToDomain(row: NutrientInteractionRow): NutrientInteraction {
  return NutrientInteraction.reconstitute({
    id: row.id as MedicationCatalogId,
    medicamento_id: row.medicamento_id as MedicationCatalogId,
    nutriente: row.nutriente,
    tipo: row.tipo as NutrientInteractionProps["tipo"],
    severidad: row.severidad as NutrientInteractionProps["severidad"],
    recomendacion: row.recomendacion,
    fuente: row.fuente,
    fecha_vigencia: row.fecha_vigencia,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function nutrientInteractionDomainToRow(interaction: NutrientInteraction): NutrientInteractionRow {
  const p = interaction.toProps();
  return {
    id: p.id,
    medicamento_id: p.medicamento_id,
    nutriente: p.nutriente,
    tipo: p.tipo,
    severidad: p.severidad,
    recomendacion: p.recomendacion,
    fuente: p.fuente,
    fecha_vigencia: p.fecha_vigencia,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}
