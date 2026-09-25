export type MemorySensitivity = 'PHI' | 'NON_PHI';

export interface ConversationMemoryEntry {
  id: string;
  conversationId: string;
  userId: string;
  pacienteId: string | null;
  sucursalId: string;
  domain: string;
  summary: string;
  sensitivity: MemorySensitivity;
  turnCount: number;
  sizeBytes: number;
  consentRef: string | null;
  createdAt: string;
  expiresAt: string;
  deletedAt?: string;
}

export interface ConversationMemoryStore {
  save(entry: ConversationMemoryEntry): Promise<void>;
  get(id: string): Promise<ConversationMemoryEntry | undefined>;
  list(input: { conversationId?: string; userId: string; pacienteId: string | null; sucursalId: string; now: Date }): Promise<ConversationMemoryEntry[]>;
  delete(id: string): Promise<boolean>;
  purgeExpired(now: Date): Promise<number>;
}

export const CONVERSATION_MEMORY_POLICY = {
  maxTurns: 50,
  maxBytes: 4096,
  ttlDays: 7,
} as const;

export function buildConversationMemoryEntry(input: {
  id: string;
  conversationId: string;
  userId: string;
  pacienteId: string | null;
  sucursalId: string;
  domain: string;
  summary: string;
  sensitivity: MemorySensitivity;
  turnCount: number;
  now: Date;
  consentRef?: string | null;
  ttlDays?: number;
}): ConversationMemoryEntry {
  const ttl = input.ttlDays ?? CONVERSATION_MEMORY_POLICY.ttlDays;
  return {
    id: input.id,
    conversationId: input.conversationId,
    userId: input.userId,
    pacienteId: input.pacienteId,
    sucursalId: input.sucursalId,
    domain: input.domain,
    summary: input.summary,
    sensitivity: input.sensitivity,
    turnCount: input.turnCount,
    sizeBytes: Buffer.byteLength(input.summary, 'utf8'),
    consentRef: input.consentRef ?? null,
    createdAt: input.now.toISOString(),
    expiresAt: new Date(input.now.getTime() + ttl * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function isConversationMemoryWithinPolicy(entry: ConversationMemoryEntry): boolean {
  return entry.turnCount <= CONVERSATION_MEMORY_POLICY.maxTurns && entry.sizeBytes <= CONVERSATION_MEMORY_POLICY.maxBytes;
}

export class InMemoryConversationMemoryStore implements ConversationMemoryStore {
  private readonly entries = new Map<string, ConversationMemoryEntry>();

  async save(entry: ConversationMemoryEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async get(id: string): Promise<ConversationMemoryEntry | undefined> {
    return this.entries.get(id);
  }

  async list(input: { conversationId?: string; userId: string; pacienteId: string | null; sucursalId: string; now: Date }): Promise<ConversationMemoryEntry[]> {
    return Array.from(this.entries.values())
      .filter((entry) => entry.deletedAt === undefined)
      .filter((entry) => new Date(entry.expiresAt).getTime() >= input.now.getTime())
      .filter((entry) => input.conversationId === undefined || entry.conversationId === input.conversationId)
      .filter((entry) => entry.userId === input.userId)
      .filter((entry) => entry.sucursalId === input.sucursalId)
      .filter((entry) => entry.pacienteId === input.pacienteId || (entry.pacienteId === null && input.pacienteId === null))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async purgeExpired(now: Date): Promise<number> {
    let purged = 0;
    for (const [id, entry] of this.entries) {
      if (new Date(entry.expiresAt).getTime() < now.getTime()) {
        this.entries.delete(id);
        purged += 1;
      }
    }
    return purged;
  }
}

export class SqlConversationMemoryStore implements ConversationMemoryStore {
  async save(entry: ConversationMemoryEntry): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), entry.id)
      .input('conversation_id', sql.NVarChar(64), entry.conversationId)
      .input('user_id', sql.UniqueIdentifier(), entry.userId)
      .input('paciente_id', sql.UniqueIdentifier(), entry.pacienteId ?? null)
      .input('sucursal_id', sql.UniqueIdentifier(), entry.sucursalId)
      .input('domain', sql.NVarChar(50), entry.domain)
      .input('summary', sql.NVarChar(4000), entry.summary)
      .input('sensitivity', sql.NVarChar(10), entry.sensitivity)
      .input('turn_count', sql.Int(), entry.turnCount)
      .input('size_bytes', sql.Int(), entry.sizeBytes)
      .input('consent_ref', sql.NVarChar(100), entry.consentRef ?? null)
      .input('created_at', sql.DateTime2(3), new Date(entry.createdAt))
      .input('updated_at', sql.DateTime2(3), new Date(entry.createdAt))
      .input('expires_at', sql.DateTime2(3), new Date(entry.expiresAt))
      .input('deleted_at', sql.DateTime2(3), entry.deletedAt ? new Date(entry.deletedAt) : null)
      .query(
        `INSERT INTO ai_conversation_memory (id, conversation_id, user_id, paciente_id, sucursal_id, domain, summary, sensitivity, turn_count, size_bytes, consent_ref, created_at, updated_at, expires_at, deleted_at)
         VALUES (@id, @conversation_id, @user_id, @paciente_id, @sucursal_id, @domain, @summary, @sensitivity, @turn_count, @size_bytes, @consent_ref, @created_at, @updated_at, @expires_at, @deleted_at)`,
      );
  }

  async get(id: string): Promise<ConversationMemoryEntry | undefined> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query('SELECT TOP 1 * FROM ai_conversation_memory WHERE id = @id');
    return result.recordset[0] ? mapConversationRow(result.recordset[0]) : undefined;
  }

  async list(input: { conversationId?: string; userId: string; pacienteId: string | null; sucursalId: string; now: Date }): Promise<ConversationMemoryEntry[]> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('user_id', sql.UniqueIdentifier(), input.userId)
      .input('paciente_id', sql.UniqueIdentifier(), input.pacienteId ?? null)
      .input('sucursal_id', sql.UniqueIdentifier(), input.sucursalId)
      .input('now', sql.DateTime2(3), input.now)
      .query(
        `SELECT * FROM ai_conversation_memory
         WHERE deleted_at IS NULL AND expires_at >= @now
           AND user_id = @user_id AND sucursal_id = @sucursal_id
           AND (paciente_id = @paciente_id OR (paciente_id IS NULL AND @paciente_id IS NULL))
         ORDER BY created_at DESC`,
      );
    return result.recordset.map(mapConversationRow);
  }

  async delete(id: string): Promise<boolean> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query('DELETE FROM ai_conversation_memory WHERE id = @id');
    return result.rowsAffected[0] > 0;
  }

  async purgeExpired(now: Date): Promise<number> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('now', sql.DateTime2(3), now)
      .query('DELETE FROM ai_conversation_memory WHERE expires_at < @now');
    return result.rowsAffected[0];
  }
}

function mapConversationRow(row: Record<string, unknown>): ConversationMemoryEntry {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    userId: String(row.user_id),
    pacienteId: row.paciente_id === null ? null : String(row.paciente_id),
    sucursalId: String(row.sucursal_id),
    domain: String(row.domain),
    summary: String(row.summary),
    sensitivity: row.sensitivity as MemorySensitivity,
    turnCount: Number(row.turn_count),
    sizeBytes: Number(row.size_bytes),
    consentRef: row.consent_ref === null ? null : String(row.consent_ref),
    createdAt: new Date(row.created_at as string).toISOString(),
    expiresAt: new Date(row.expires_at as string).toISOString(),
    deletedAt: row.deleted_at === null ? undefined : new Date(row.deleted_at as string).toISOString(),
  };
}

export function selectConversationMemoryStore(env: NodeJS.ProcessEnv = process.env): ConversationMemoryStore {
  return env.AI_MEMORY_STORE === 'sql' ? new SqlConversationMemoryStore() : inMemoryConversationMemoryStore;
}

export const inMemoryConversationMemoryStore = new InMemoryConversationMemoryStore();

/** Render de egress: respeta sensitivity y capacidad del actor (PHI solo si el canal lo permite). */
export function renderConversationMemoryForEgress(input: { entries: ConversationMemoryEntry[]; allowPhi: boolean; maxEntries?: number }): string[] {
  const max = input.maxEntries ?? 5;
  return input.entries
    .slice(0, max)
    .map((entry) => {
      if (entry.sensitivity === 'PHI' && !input.allowPhi) return undefined;
      return `${entry.domain}: ${entry.summary}`;
    })
    .filter((line): line is string => line !== undefined);
}