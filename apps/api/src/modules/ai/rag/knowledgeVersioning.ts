import type { Role } from '@nutriclinica/shared';
import { isTierUsableForClinical, type EvidenceTier } from './knowledgeGovernance.js';

/** Ciclo de vida autoritativo de una version de documento de conocimiento. */
export type KnowledgeVersionState = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'SUPERSEDED' | 'EXPIRED' | 'REVOKED' | 'DELETED';

export const ELIGIBLE_RETRIEVAL_STATES: readonly KnowledgeVersionState[] = ['APPROVED'];

export const ALL_KNOWLEDGE_STATES: readonly KnowledgeVersionState[] = [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'SUPERSEDED',
  'EXPIRED',
  'REVOKED',
  'DELETED',
];

/** Estado desconocido: DENY (fail-closed). */
export function isKnownState(state: string): state is KnowledgeVersionState {
  return (ALL_KNOWLEDGE_STATES as readonly string[]).includes(state);
}

export const KNOWLEDGE_TIER_LABELS: Record<EvidenceTier, string> = {
  clinical_guideline: 'TIER_2_OFFICIAL_GUIDELINE',
  institutional_protocol: 'TIER_1_INSTITUTIONAL_PROTOCOL',
  peer_reviewed: 'TIER_4_PEER_REVIEWED',
  educational: 'TIER_5_EDUCATIONAL',
  unverified: 'TIER_UNVERIFIED_NOT_ELIGIBLE',
};

export function fnv1a32Hex(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function computeContentFingerprint(content: string): string {
  return `sha-ish-fnv1a-${fnv1a32Hex(content)}`;
}

export interface KnowledgeDocumentVersion {
  documentId: string;
  version: number;
  title: string;
  category: string;
  tier: EvidenceTier;
  content: string;
  status: KnowledgeVersionState;
  sourceIssuer?: string;
  approvedByRef?: string;
  approvedAt?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  supersedesVersion?: number;
  scope: string;
  sucursalScope: string | null;
  patientScope: 'NONE';
  allowedRoles: Role[];
  contentFingerprint: string;
  revokedAt?: string;
  revokedByRef?: string;
  supersededByRef?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  documentVersion: number;
  chunkIndex: number;
  content: string;
  contentFingerprint: string;
}

export interface KnowledgeVersionStore {
  saveVersion(version: KnowledgeDocumentVersion): Promise<void>;
  getVersion(documentId: string, version: number): Promise<KnowledgeDocumentVersion | undefined>;
  listVersions(documentId: string): Promise<KnowledgeDocumentVersion[]>;
  listEligible(input: { sucursalId: string | null; now: Date }): Promise<KnowledgeDocumentVersion[]>;
  saveChunk(chunk: KnowledgeChunk): Promise<void>;
  listChunks(documentId: string, version: number): Promise<KnowledgeChunk[]>;
}

export function isVersionEligible(version: KnowledgeDocumentVersion, input: { now: Date; role: Role; sucursalId: string | null }): boolean {
  if (version.status !== 'APPROVED') return false;
  if (version.deletedAt || version.revokedAt) return false;
  if (new Date(version.effectiveFrom).getTime() > input.now.getTime()) return false;
  if (version.effectiveTo && new Date(version.effectiveTo).getTime() < input.now.getTime()) return false;
  if (!version.allowedRoles.includes(input.role)) return false;
  if (version.sucursalScope !== null && version.sucursalScope !== input.sucursalId) return false;
  if (version.patientScope !== 'NONE') return false;
  if (!isTierUsableForClinical(version.tier)) return false;
  return true;
}

export interface ApprovalInput {
  byRef: string;
  now: Date;
  effectiveFrom?: Date;
  effectiveTo?: Date;
}

export function approveVersion(draft: KnowledgeDocumentVersion, input: ApprovalInput): KnowledgeDocumentVersion {
  const effectiveFrom = input.effectiveFrom ?? input.now;
  if (effectiveFrom.getTime() > input.now.getTime() + 1000 * 60) {
    throw new Error('La vigencia no puede iniciar en el futuro lejano');
  }
  if (input.effectiveTo && input.effectiveTo.getTime() <= effectiveFrom.getTime()) {
    throw new Error('La vigencia debe ser futura');
  }
  return {
    ...draft,
    status: 'APPROVED',
    approvedByRef: input.byRef,
    approvedAt: input.now.toISOString(),
    effectiveFrom: effectiveFrom.toISOString(),
    effectiveTo: input.effectiveTo?.toISOString() ?? draft.effectiveTo,
    updatedAt: input.now.toISOString(),
  };
}

export function supersedeVersion(current: KnowledgeDocumentVersion, by: string, now: Date): KnowledgeDocumentVersion {
  return {
    ...current,
    status: 'SUPERSEDED',
    updatedAt: now.toISOString(),
    supersededByRef: by,
    supersedesVersion: current.version,
  };
}

export function revokeVersion(version: KnowledgeDocumentVersion, by: string, now: Date): KnowledgeDocumentVersion {
  return {
    ...version,
    status: 'REVOKED',
    revokedAt: now.toISOString(),
    revokedByRef: by,
    updatedAt: now.toISOString(),
  };
}

export function markExpired(version: KnowledgeDocumentVersion, now: Date): KnowledgeDocumentVersion {
  if (version.status !== 'APPROVED') return version;
  return { ...version, status: 'EXPIRED', updatedAt: now.toISOString() };
}

export function markDeleted(version: KnowledgeDocumentVersion, now: Date): KnowledgeDocumentVersion {
  return { ...version, status: 'DELETED', deletedAt: now.toISOString(), updatedAt: now.toISOString() };
}

export function buildDocumentVersion(input: {
  documentId: string;
  version: number;
  title: string;
  category: string;
  tier: EvidenceTier;
  content: string;
  status?: KnowledgeVersionState;
  sourceIssuer?: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  supersedesVersion?: number;
  scope?: string;
  sucursalScope?: string | null;
  patientScope?: 'NONE';
  allowedRoles: Role[];
  now: Date;
}): KnowledgeDocumentVersion {
  const nowIso = input.now.toISOString();
  return {
    documentId: input.documentId,
    version: input.version,
    title: input.title,
    category: input.category,
    tier: input.tier,
    content: input.content,
    status: input.status ?? 'DRAFT',
    sourceIssuer: input.sourceIssuer,
    effectiveFrom: (input.effectiveFrom ?? input.now).toISOString(),
    effectiveTo: input.effectiveTo?.toISOString(),
    supersedesVersion: input.supersedesVersion,
    scope: input.scope ?? 'institutional_knowledge_base',
    sucursalScope: input.sucursalScope ?? null,
    patientScope: 'NONE',
    allowedRoles: input.allowedRoles,
    contentFingerprint: computeContentFingerprint(input.content),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** Id deterministico tipo UUID para chunks (compatible con UNIQUEIDENTIFIER). */
export function uuidFromString(input: string): string {
  const hex = fnv1a32Hex(input).padStart(8, '0') + fnv1a32Hex(`salt:${input}`).padStart(8, '0') + fnv1a32Hex(`x:${input}`).padStart(8, '0') + fnv1a32Hex(`y:${input}`).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function chunkVersion(doc: KnowledgeDocumentVersion, maxChars: number): KnowledgeChunk[] {
  const clean = doc.content.trim().replace(/\s+/g, ' ');
  const pieces: string[] = [];
  if (clean.length <= maxChars) {
    pieces.push(clean);
  } else {
    let remaining = clean;
    while (remaining.length > maxChars) {
      let cut = remaining.lastIndexOf(' ', maxChars);
      if (cut <= 0) cut = maxChars;
      pieces.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining.length > 0) pieces.push(remaining);
  }
  return pieces.map((content, index) => ({
    id: uuidFromString(`${doc.documentId}:v${doc.version}:c${index}`),
    documentId: doc.documentId,
    documentVersion: doc.version,
    chunkIndex: index,
    content,
    contentFingerprint: computeContentFingerprint(content),
  }));
}

export class InMemoryKnowledgeVersionStore implements KnowledgeVersionStore {
  private readonly versions = new Map<string, KnowledgeDocumentVersion>();
  private readonly chunks = new Map<string, KnowledgeChunk>();

  private key(documentId: string, version: number): string {
    return `${documentId}:v${version}`;
  }

  async saveVersion(version: KnowledgeDocumentVersion): Promise<void> {
    this.versions.set(this.key(version.documentId, version.version), version);
  }

  async getVersion(documentId: string, version: number): Promise<KnowledgeDocumentVersion | undefined> {
    return this.versions.get(this.key(documentId, version));
  }

  async listVersions(documentId: string): Promise<KnowledgeDocumentVersion[]> {
    return Array.from(this.versions.values())
      .filter((v) => v.documentId === documentId)
      .sort((a, b) => b.version - a.version);
  }

  async listEligible(input: { sucursalId: string | null; now: Date }): Promise<KnowledgeDocumentVersion[]> {
    return Array.from(this.versions.values()).filter(
      (v) =>
        v.status === 'APPROVED' &&
        v.deletedAt === undefined &&
        v.revokedAt === undefined &&
        new Date(v.effectiveFrom).getTime() <= input.now.getTime() &&
        (v.effectiveTo === undefined || new Date(v.effectiveTo).getTime() >= input.now.getTime()) &&
        (v.sucursalScope === null || v.sucursalScope === input.sucursalId) &&
        v.patientScope === 'NONE',
    );
  }

  async saveChunk(chunk: KnowledgeChunk): Promise<void> {
    this.chunks.set(chunk.id, chunk);
  }

  async listChunks(documentId: string, version: number): Promise<KnowledgeChunk[]> {
    return Array.from(this.chunks.values())
      .filter((c) => c.documentId === documentId && c.documentVersion === version)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
  }
}

export class SqlKnowledgeVersionStore implements KnowledgeVersionStore {
  async saveVersion(version: KnowledgeDocumentVersion): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('doc_id', sql.UniqueIdentifier(), version.documentId)
      .input('version', sql.Int, version.version)
      .input('title', sql.NVarChar(300), version.title)
      .input('category', sql.NVarChar(100), version.category)
      .input('tier', sql.NVarChar(40), version.tier)
      .input('status', sql.NVarChar(20), version.status)
      .input('content', sql.NVarChar(sql.MAX), version.content)
      .input('content_fingerprint', sql.NVarChar(64), version.contentFingerprint)
      .input('source_issuer', sql.NVarChar(200), version.sourceIssuer ?? null)
      .input('approved_by_ref', sql.NVarChar(200), version.approvedByRef ?? null)
      .input('approved_at', sql.DateTime2(3), version.approvedAt ? new Date(version.approvedAt) : null)
      .input('effective_from', sql.DateTime2(3), new Date(version.effectiveFrom))
      .input('effective_to', sql.DateTime2(3), version.effectiveTo ? new Date(version.effectiveTo) : null)
      .input('supersedes_version', sql.Int, version.supersedesVersion ?? null)
      .input('scope', sql.NVarChar(40), version.scope)
      .input('sucursal_scope', sql.UniqueIdentifier(), version.sucursalScope)
      .input('patient_scope', sql.NVarChar(40), version.patientScope)
      .input('allowed_roles', sql.NVarChar(500), version.allowedRoles.join(','))
      .input('revoked_at', sql.DateTime2(3), version.revokedAt ? new Date(version.revokedAt) : null)
      .input('revoked_by_ref', sql.NVarChar(200), version.revokedByRef ?? null)
      .input('superseded_by_ref', sql.NVarChar(200), version.supersededByRef ?? null)
      .input('deleted_at', sql.DateTime2(3), version.deletedAt ? new Date(version.deletedAt) : null)
      .input('created_at', sql.DateTime2(3), new Date(version.createdAt))
      .input('updated_at', sql.DateTime2(3), new Date(version.updatedAt))
      .query(
        `IF EXISTS (SELECT 1 FROM knowledge_doc_versions WHERE doc_id = @doc_id AND version = @version)
           UPDATE knowledge_doc_versions SET
             title = @title, category = @category, tier = @tier, status = @status, content = @content,
             content_fingerprint = @content_fingerprint, source_issuer = @source_issuer,
             approved_by_ref = @approved_by_ref, approved_at = @approved_at,
             effective_from = @effective_from, effective_to = @effective_to,
             supersedes_version = @supersedes_version, scope = @scope,
             sucursal_scope = @sucursal_scope, patient_scope = @patient_scope,
             allowed_roles = @allowed_roles, revoked_at = @revoked_at,
             revoked_by_ref = @revoked_by_ref, superseded_by_ref = @superseded_by_ref,
             deleted_at = @deleted_at, updated_at = @updated_at
           WHERE doc_id = @doc_id AND version = @version
         ELSE
           INSERT INTO knowledge_doc_versions
             (doc_id, version, title, category, tier, status, content, content_fingerprint, source_issuer,
              approved_by_ref, approved_at, effective_from, effective_to, supersedes_version, scope,
              sucursal_scope, patient_scope, allowed_roles, revoked_at, revoked_by_ref, superseded_by_ref,
              deleted_at, created_at, updated_at)
           VALUES
             (@doc_id, @version, @title, @category, @tier, @status, @content, @content_fingerprint, @source_issuer,
              @approved_by_ref, @approved_at, @effective_from, @effective_to, @supersedes_version, @scope,
              @sucursal_scope, @patient_scope, @allowed_roles, @revoked_at, @revoked_by_ref, @superseded_by_ref,
              @deleted_at, @created_at, @updated_at)`,
      );
  }

  async getVersion(documentId: string, version: number): Promise<KnowledgeDocumentVersion | undefined> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('doc_id', sql.UniqueIdentifier(), documentId)
      .input('version', sql.Int, version)
      .query('SELECT TOP 1 * FROM knowledge_doc_versions WHERE doc_id = @doc_id AND version = @version');
    const row = result.recordset[0];
    return row ? mapVersionRow(row) : undefined;
  }

  async listVersions(documentId: string): Promise<KnowledgeDocumentVersion[]> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('doc_id', sql.UniqueIdentifier(), documentId)
      .query('SELECT * FROM knowledge_doc_versions WHERE doc_id = @doc_id ORDER BY version DESC');
    return result.recordset.map(mapVersionRow);
  }

  async listEligible(input: { sucursalId: string | null; now: Date }): Promise<KnowledgeDocumentVersion[]> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const req = pool.request();
    if (input.sucursalId !== null) {
      req.input('sucursal_id', sql.UniqueIdentifier(), input.sucursalId);
    }
    req.input('now', sql.DateTime2(3), input.now);
    const result = await req.query(
      `SELECT * FROM knowledge_doc_versions
       WHERE status = 'APPROVED' AND deleted_at IS NULL AND revoked_at IS NULL
         AND effective_from <= @now AND (effective_to IS NULL OR effective_to >= @now)
         AND patient_scope = 'NONE'
         AND (sucursal_scope IS NULL ${input.sucursalId !== null ? 'OR sucursal_scope = @sucursal_id' : ''})
       ORDER BY doc_id, version`,
    );
    return result.recordset.map(mapVersionRow);
  }

  async saveChunk(chunk: KnowledgeChunk): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), chunk.id)
      .input('doc_id', sql.UniqueIdentifier(), chunk.documentId)
      .input('doc_version', sql.Int, chunk.documentVersion)
      .input('chunk_index', sql.Int, chunk.chunkIndex)
      .input('content', sql.NVarChar(sql.MAX), chunk.content)
      .input('content_fingerprint', sql.NVarChar(64), chunk.contentFingerprint)
      .input('created_at', sql.DateTime2(3), new Date())
      .query(
        `INSERT INTO knowledge_chunks (id, doc_id, doc_version, chunk_index, content, content_fingerprint, created_at)
         VALUES (@id, @doc_id, @doc_version, @chunk_index, @content, @content_fingerprint, @created_at)`,
      );
  }

  async listChunks(documentId: string, version: number): Promise<KnowledgeChunk[]> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('doc_id', sql.UniqueIdentifier(), documentId)
      .input('doc_version', sql.Int, version)
      .query('SELECT * FROM knowledge_chunks WHERE doc_id = @doc_id AND doc_version = @doc_version ORDER BY chunk_index');
    return result.recordset.map((row) => ({
      id: String(row.id),
      documentId: String(row.doc_id),
      documentVersion: Number(row.doc_version),
      chunkIndex: Number(row.chunk_index),
      content: String(row.content),
      contentFingerprint: String(row.content_fingerprint),
    }));
  }
}

function mapVersionRow(row: Record<string, unknown>): KnowledgeDocumentVersion {
  return {
    documentId: String(row.doc_id),
    version: Number(row.version),
    title: String(row.title),
    category: String(row.category),
    tier: row.tier as EvidenceTier,
    content: String(row.content),
    status: row.status as KnowledgeVersionState,
    sourceIssuer: row.source_issuer ? String(row.source_issuer) : undefined,
    approvedByRef: row.approved_by_ref ? String(row.approved_by_ref) : undefined,
    approvedAt: row.approved_at ? new Date(row.approved_at as string).toISOString() : undefined,
    effectiveFrom: new Date(row.effective_from as string).toISOString(),
    effectiveTo: row.effective_to ? new Date(row.effective_to as string).toISOString() : undefined,
    supersedesVersion: row.supersedes_version !== null && row.supersedes_version !== undefined ? Number(row.supersedes_version) : undefined,
    scope: String(row.scope),
    sucursalScope: row.sucursal_scope ? String(row.sucursal_scope) : null,
    patientScope: 'NONE',
    allowedRoles: String(row.allowed_roles).split(',').filter(Boolean) as Role[],
    contentFingerprint: String(row.content_fingerprint),
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string).toISOString() : undefined,
    revokedByRef: row.revoked_by_ref ? String(row.revoked_by_ref) : undefined,
    supersededByRef: row.superseded_by_ref ? String(row.superseded_by_ref) : undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at as string).toISOString() : undefined,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export function selectKnowledgeVersionStore(env: NodeJS.ProcessEnv = process.env): KnowledgeVersionStore {
  return env.AI_RAG_DOC_STORE === 'sql' ? new SqlKnowledgeVersionStore() : inMemoryKnowledgeVersionStore;
}

export const inMemoryKnowledgeVersionStore = new InMemoryKnowledgeVersionStore();