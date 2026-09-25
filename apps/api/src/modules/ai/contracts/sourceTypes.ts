import type { EvidenceSourceType } from '../expert/evidenceEnvelope.js';

/** Tipos de fuente formales. Nomenclatura previa mapeada sin duplicación. */
export type ClinicalSourceType = 'ERP' | 'DWH' | 'RAG' | 'RULE_ENGINE' | 'CALCULATOR' | 'MODEL_INFERENCE';

export const CLINICAL_SOURCE_TYPES: readonly ClinicalSourceType[] = [
  'ERP',
  'DWH',
  'RAG',
  'RULE_ENGINE',
  'CALCULATOR',
  'MODEL_INFERENCE',
];

/** Mapping de la nomenclatura legacy del EvidenceEnvelope v1 al contrato formal. */
export const LEGACY_SOURCE_TYPE_MAP: Record<EvidenceSourceType, ClinicalSourceType> = {
  erp: 'ERP',
  calculator: 'CALCULATOR',
  golden_rule: 'RULE_ENGINE',
  ai: 'MODEL_INFERENCE',
  knowledge: 'RAG',
  memory: 'RAG',
};

export function mapLegacySourceType(type: EvidenceSourceType): ClinicalSourceType {
  return LEGACY_SOURCE_TYPE_MAP[type];
}

/** DWH real disponible (Build 08): base separada con ETL versionado y capa semántica.
 *  Esta bandera se consulta con cautela: los flujos deben verificar DWH_ENABLED y
 *  la existencia de carga exitosa antes de afirmar datos del DWH. */
export const DWH_REAL_AVAILABLE = true;