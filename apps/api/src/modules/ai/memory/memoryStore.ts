import type { MemoryEntry } from './memoryTypes.js';

export interface MemoryStore {
  save(entry: MemoryEntry): Promise<void>;
  get(id: string): Promise<MemoryEntry | undefined>;
  list(input: { pacienteId: string; sucursalId: string; actorId: string; now: Date }): Promise<MemoryEntry[]>;
  delete(id: string): Promise<boolean>;
  purgeExpired(now: Date): Promise<number>;
}

function isVisible(entry: MemoryEntry, actorId: string): boolean {
  return entry.visibility === 'shared' || entry.actorId === actorId;
}

function isExpired(entry: MemoryEntry, now: Date): boolean {
  return new Date(entry.expiresAt).getTime() < now.getTime();
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async save(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async get(id: string): Promise<MemoryEntry | undefined> {
    return this.entries.get(id);
  }

  async list(input: { pacienteId: string; sucursalId: string; actorId: string; now: Date }): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values())
      .filter((entry) => entry.pacienteId === input.pacienteId && entry.sucursalId === input.sucursalId)
      .filter((entry) => !isExpired(entry, input.now))
      .filter((entry) => isVisible(entry, input.actorId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  async purgeExpired(now: Date): Promise<number> {
    let purged = 0;
    for (const [id, entry] of this.entries) {
      if (isExpired(entry, now)) {
        this.entries.delete(id);
        purged += 1;
      }
    }
    return purged;
  }
}

export class SqlMemoryStore implements MemoryStore {
  async save(entry: MemoryEntry): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.UniqueIdentifier(), entry.id)
      .input('paciente_id', sql.UniqueIdentifier(), entry.pacienteId)
      .input('sucursal_id', sql.UniqueIdentifier(), entry.sucursalId)
      .input('actor_id', sql.UniqueIdentifier(), entry.actorId)
      .input('content', sql.NVarChar(500), entry.content)
      .input('visibility', sql.NVarChar(10), entry.visibility)
      .input('source', sql.NVarChar(30), entry.source)
      .input('created_at', sql.DateTime2(3), new Date(entry.createdAt))
      .input('expires_at', sql.DateTime2(3), new Date(entry.expiresAt))
      .query(
        `INSERT INTO ai_memory (id, paciente_id, sucursal_id, actor_id, content, visibility, source, created_at, expires_at)
         VALUES (@id, @paciente_id, @sucursal_id, @actor_id, @content, @visibility, @source, @created_at, @expires_at)`,
      );
  }

  async get(id: string): Promise<MemoryEntry | undefined> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query('SELECT TOP 1 * FROM ai_memory WHERE id = @id');
    const row = result.recordset[0];
    return row ? mapRow(row) : undefined;
  }

  async list(input: { pacienteId: string; sucursalId: string; actorId: string; now: Date }): Promise<MemoryEntry[]> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('paciente_id', sql.UniqueIdentifier(), input.pacienteId)
      .input('sucursal_id', sql.UniqueIdentifier(), input.sucursalId)
      .input('actor_id', sql.UniqueIdentifier(), input.actorId)
      .input('now', sql.DateTime2(3), input.now)
      .query(
        `SELECT * FROM ai_memory
         WHERE paciente_id = @paciente_id AND sucursal_id = @sucursal_id
           AND expires_at >= @now
           AND (visibility = 'shared' OR actor_id = @actor_id)
         ORDER BY created_at DESC`,
      );
    return result.recordset.map(mapRow);
  }

  async delete(id: string): Promise<boolean> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.UniqueIdentifier(), id)
      .query('DELETE FROM ai_memory WHERE id = @id');
    return result.rowsAffected[0] > 0;
  }

  async purgeExpired(now: Date): Promise<number> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('now', sql.DateTime2(3), now)
      .query('DELETE FROM ai_memory WHERE expires_at < @now');
    return result.rowsAffected[0];
  }
}

function mapRow(row: Record<string, unknown>): MemoryEntry {
  return {
    id: String(row.id),
    pacienteId: String(row.paciente_id),
    sucursalId: String(row.sucursal_id),
    actorId: String(row.actor_id),
    content: String(row.content),
    visibility: row.visibility as MemoryEntry['visibility'],
    source: row.source as MemoryEntry['source'],
    createdAt: new Date(row.created_at as string).toISOString(),
    expiresAt: new Date(row.expires_at as string).toISOString(),
  };
}

export function selectMemoryStore(env: NodeJS.ProcessEnv = process.env): MemoryStore {
  return env.AI_MEMORY_STORE === 'sql' ? new SqlMemoryStore() : inMemoryMemoryStore;
}

export const inMemoryMemoryStore = new InMemoryMemoryStore();