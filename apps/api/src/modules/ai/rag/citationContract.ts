import type { Role } from '@nutriclinica/shared';
import { isVersionEligible, type KnowledgeVersionStore } from './knowledgeVersioning.js';
import type { VersionedRetrievedChunk } from './versionedRetrieval.js';

export const CITATION_CONTRACT_VERSION = 'citation-contract.v1';

export interface CitationContractRef {
  documentId: string;
  documentVersion: number;
  chunkId: string;
  chunkIndex: number;
  knowledgeTier: string;
  effectiveFrom: string;
  effectiveTo?: string;
  retrievedAt: string;
  valid: boolean;
  invalidReasons: string[];
}

export interface CitationValidationInput {
  now: Date;
  role: Role;
  sucursalId: string;
  requireCurrent: boolean;
}

/** Contrato de cita para DOCUMENTED_GUIDANCE: documento + version + chunk + tier + vigencia. */
export function buildCitationRef(chunk: VersionedRetrievedChunk): Omit<CitationContractRef, 'valid' | 'invalidReasons'> {
  return {
    documentId: chunk.documentId,
    documentVersion: chunk.documentVersion,
    chunkId: chunk.chunkId,
    chunkIndex: chunk.chunkIndex,
    knowledgeTier: chunk.knowledgeTier,
    effectiveFrom: chunk.effectiveFrom,
    effectiveTo: chunk.effectiveTo,
    retrievedAt: chunk.retrievedAt,
  };
}

/**
 * Valida una cita contra el store versionado.
 * Sin documento/version/chunk: invalida. Sin autorizacion/estado elegible: invalida.
 * requireCurrent=true exige que sea la version actual (no superseded/revoked/expired).
 */
export async function validateCitationContract(input: {
  documentId: string;
  version?: number;
  store: KnowledgeVersionStore;
  now: Date;
  role: Role;
  sucursalId: string;
  requireCurrent: boolean;
}): Promise<{ valid: boolean; reasons: string[]; version?: number }> {
  const reasons: string[] = [];
  const versions = await input.store.listVersions(input.documentId);
  if (versions.length === 0) {
    return { valid: false, reasons: [`documento no existe: ${input.documentId}`] };
  }
  const version = input.version ?? Math.max(...versions.map((v) => v.version));
  const found = await input.store.getVersion(input.documentId, version);
  if (!found) {
    return { valid: false, reasons: [`version no existe: ${input.documentId}:v${version}`] };
  }
  if (found.status === 'DELETED' || found.deletedAt) reasons.push('documento eliminado');
  if (found.status === 'REVOKED' || found.revokedAt) reasons.push('documento revocado');
  if (found.status === 'EXPIRED') reasons.push('documento expirado');
  if (found.status === 'SUPERSEDED') reasons.push('version superseded');
  if (found.status !== 'APPROVED') reasons.push(`estado no elegible: ${found.status}`);
  if (!isVersionEligible(found, { now: input.now, role: input.role, sucursalId: input.sucursalId })) {
    reasons.push('no autorizado o fuera de vigencia para el actor');
  }
  if (input.requireCurrent) {
    const newer = versions.filter((v) => v.version > version && v.status === 'APPROVED' && v.deletedAt === undefined);
    if (newer.length > 0) reasons.push(`existe version mas reciente: v${Math.max(...newer.map((v) => v.version))}`);
  }
  return { valid: reasons.length === 0, reasons, version };
}

export interface CitationContractVerification {
  ok: boolean;
  citations: CitationContractRef[];
  invalid: string[];
  validCount: number;
}

/**
 * Verifica las citas [docId] de una salida contra los chunks recuperados.
 * Solo cuentan como validas las citas presentes en el contexto recuperado
 * (nunca ids inventados por el modelo).
 */
export function verifyVersionedCitations(input: { content: string; retrieved: VersionedRetrievedChunk[]; now: Date }): CitationContractVerification {
  const pattern = /\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;
  const cited = [...new Set((input.content.match(pattern) ?? []).map((m) => m.slice(1, -1).toLowerCase()))];
  const byDoc = new Map<string, VersionedRetrievedChunk>();
  for (const chunk of input.retrieved) {
    if (!byDoc.has(chunk.documentId.toLowerCase())) byDoc.set(chunk.documentId.toLowerCase(), chunk);
  }
  const citations: CitationContractRef[] = cited.map((docId) => {
    const chunk = byDoc.get(docId);
    if (!chunk) {
      return {
        documentId: docId,
        documentVersion: 0,
        chunkId: '',
        chunkIndex: -1,
        knowledgeTier: '',
        effectiveFrom: '',
        retrievedAt: input.now.toISOString(),
        valid: false,
        invalidReasons: ['cita sin respaldo en el contexto recuperado'],
      };
    }
    return {
      ...buildCitationRef(chunk),
      valid: chunk.citationValid,
      invalidReasons: chunk.citationValid ? [] : ['chunk no elegible'],
    };
  });
  return {
    ok: citations.every((c) => c.valid),
    citations,
    invalid: citations.filter((c) => !c.valid).map((c) => c.documentId),
    validCount: citations.filter((c) => c.valid).length,
  };
}