import type { Role } from '@nutriclinica/shared';

export type EvidenceTier = 'clinical_guideline' | 'institutional_protocol' | 'peer_reviewed' | 'educational' | 'unverified';

export const ALL_TIERS: readonly EvidenceTier[] = ['clinical_guideline', 'institutional_protocol', 'peer_reviewed', 'educational', 'unverified'];

export const TIER_RANK: Record<EvidenceTier, number> = {
  clinical_guideline: 5,
  institutional_protocol: 4,
  peer_reviewed: 3,
  educational: 2,
  unverified: 1,
};

/** Tiers por debajo de este no se sirven en contexto clinico (fail-closed). */
export const MIN_CLINICAL_TIER: EvidenceTier = 'educational';

export type KnowledgeDocStatus = 'draft' | 'approved' | 'expired' | 'revoked';

export interface KnowledgeDoc {
  id: string;
  /** null = documento global disponible en todas las sucursales. */
  sucursalId: string | null;
  title: string;
  category: string;
  tier: EvidenceTier;
  content: string;
  status: KnowledgeDocStatus;
  approvedBy?: string;
  approvedAt?: string;
  expiresAt?: string;
  allowedRoles: Role[];
  createdAt: string;
}

export function isTierUsableForClinical(tier: EvidenceTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[MIN_CLINICAL_TIER];
}

export function isDocUsable(doc: KnowledgeDoc, input: { now: Date; role: Role; sucursalId: string | null }): boolean {
  if (doc.status !== 'approved') return false;
  if (doc.expiresAt && new Date(doc.expiresAt).getTime() < input.now.getTime()) return false;
  if (!doc.allowedRoles.includes(input.role)) return false;
  if (doc.sucursalId !== null && doc.sucursalId !== input.sucursalId) return false;
  if (!isTierUsableForClinical(doc.tier)) return false;
  return true;
}

export interface KnowledgeDocStore {
  save(doc: KnowledgeDoc): Promise<void>;
  get(id: string): Promise<KnowledgeDoc | undefined>;
  list(input: { sucursalId: string | null; status?: KnowledgeDocStatus }): Promise<KnowledgeDoc[]>;
}

export class InMemoryKnowledgeDocStore implements KnowledgeDocStore {
  private readonly docs = new Map<string, KnowledgeDoc>();

  async save(doc: KnowledgeDoc): Promise<void> {
    this.docs.set(doc.id, doc);
  }

  async get(id: string): Promise<KnowledgeDoc | undefined> {
    return this.docs.get(id);
  }

  async list(input: { sucursalId: string | null; status?: KnowledgeDocStatus }): Promise<KnowledgeDoc[]> {
    return Array.from(this.docs.values()).filter(
      (doc) =>
        (input.sucursalId === null || doc.sucursalId === null || doc.sucursalId === input.sucursalId) &&
        (input.status === undefined || doc.status === input.status),
    );
  }
}

export function approveDoc(doc: KnowledgeDoc, input: { by: string; now: Date; expiresAt?: string }): KnowledgeDoc {
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= input.now.getTime()) {
    throw new Error('La vigencia debe ser futura');
  }
  return {
    ...doc,
    status: 'approved',
    approvedBy: input.by,
    approvedAt: input.now.toISOString(),
    expiresAt: input.expiresAt ?? doc.expiresAt,
  };
}

export class SqlKnowledgeDocStore implements KnowledgeDocStore {
  async save(doc: KnowledgeDoc): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), doc.id)
      .input('sucursal_id', sql.UniqueIdentifier(), doc.sucursalId)
      .input('title', sql.NVarChar(300), doc.title)
      .input('category', sql.NVarChar(100), doc.category)
      .input('tier', sql.NVarChar(40), doc.tier)
      .input('content', sql.NVarChar(sql.MAX), doc.content)
      .input('status', sql.NVarChar(20), doc.status)
      .input('approved_by', sql.UniqueIdentifier(), doc.approvedBy ?? null)
      .input('approved_at', sql.DateTime2(3), doc.approvedAt ? new Date(doc.approvedAt) : null)
      .input('expires_at', sql.DateTime2(3), doc.expiresAt ? new Date(doc.expiresAt) : null)
      .input('allowed_roles', sql.NVarChar(500), doc.allowedRoles.join(','))
      .input('created_at', sql.DateTime2(3), new Date(doc.createdAt))
      .query(
        `INSERT INTO knowledge_docs (id, sucursal_id, title, category, tier, content, status, approved_by, approved_at, expires_at, allowed_roles, created_at, deleted_at)
         VALUES (@id, @sucursal_id, @title, @category, @tier, @content, @status, @approved_by, @approved_at, @expires_at, @allowed_roles, @created_at, NULL)`,
      );
  }

  async get(id: string): Promise<KnowledgeDoc | undefined> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query('SELECT TOP 1 * FROM knowledge_docs WHERE id = @id AND deleted_at IS NULL');
    const row = result.recordset[0];
    return row ? mapRow(row) : undefined;
  }

  async list(input: { sucursalId: string | null; status?: KnowledgeDocStatus }): Promise<KnowledgeDoc[]> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const req = pool.request();
    if (input.sucursalId !== null) {
      req.input('sucursal_id', sql.UniqueIdentifier(), input.sucursalId);
    }
    if (input.status) {
      req.input('status', sql.NVarChar(20), input.status);
    }
    const result = await req.query(
      `SELECT * FROM knowledge_docs WHERE deleted_at IS NULL
       ${input.sucursalId !== null ? 'AND (sucursal_id = @sucursal_id OR sucursal_id IS NULL)' : ''}
       ${input.status ? 'AND status = @status' : ''}`,
    );
    return result.recordset.map(mapRow);
  }
}

function mapRow(row: Record<string, unknown>): KnowledgeDoc {
  return {
    id: String(row.id),
    sucursalId: row.sucursal_id ? String(row.sucursal_id) : null,
    title: String(row.title),
    category: String(row.category),
    tier: row.tier as EvidenceTier,
    content: String(row.content),
    status: row.status as KnowledgeDocStatus,
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    approvedAt: row.approved_at ? new Date(row.approved_at as string).toISOString() : undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at as string).toISOString() : undefined,
    allowedRoles: String(row.allowed_roles).split(',').filter(Boolean) as Role[],
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export function selectKnowledgeDocStore(env: NodeJS.ProcessEnv = process.env): KnowledgeDocStore {
  return env.AI_RAG_DOC_STORE === 'sql' ? new SqlKnowledgeDocStore() : inMemoryKnowledgeDocStore;
}

export const inMemoryKnowledgeDocStore = new InMemoryKnowledgeDocStore();