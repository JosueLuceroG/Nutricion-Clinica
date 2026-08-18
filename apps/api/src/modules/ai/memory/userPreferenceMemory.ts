export type PreferenceValue = string | number | boolean;

export interface UserPreference {
  prefKey: string;
  value: PreferenceValue;
  userId: string;
  sucursalId: string;
  updatedAt: string;
}

/**
 * Claves permitidas: afectan SOLO estilo/forma de la salida.
 * Nunca pueden cambiar permisos, riesgo, consenso ni certificación.
 */
export const SAFE_PREFERENCE_KEYS: ReadonlySet<string> = new Set([
  'output_format',
  'language',
  'measurement_units',
  'verbosity',
  'assistant_style',
  'preferred_model_hint',
]);

export const FORBIDDEN_PREFERENCE_KEYS: ReadonlySet<string> = new Set([
  'permission_override',
  'risk_override',
  'consent_override',
  'professional_review_disabled',
  'certification_bypass',
  'system_prompt_override',
  'egress_bypass',
  'role_override',
]);

export interface UserPreferenceStore {
  save(preference: UserPreference): Promise<void>;
  get(userId: string, sucursalId: string, prefKey: string): Promise<UserPreference | undefined>;
  list(userId: string, sucursalId: string): Promise<UserPreference[]>;
  delete(userId: string, sucursalId: string, prefKey: string): Promise<boolean>;
}

export function buildUserPreference(input: {
  prefKey: string;
  value: PreferenceValue;
  userId: string;
  sucursalId: string;
  now: Date;
}): UserPreference {
  if (FORBIDDEN_PREFERENCE_KEYS.has(input.prefKey)) {
    throw new Error(`preferencia prohibida: ${input.prefKey}`);
  }
  if (!SAFE_PREFERENCE_KEYS.has(input.prefKey)) {
    throw new Error(`clave de preferencia no registrada: ${input.prefKey}`);
  }
  if (input.prefKey === 'preferred_model_hint' && typeof input.value !== 'string') {
    throw new Error('preferred_model_hint debe ser una cadena');
  }
  if (input.prefKey === 'measurement_units' && !['metric', 'imperial'].includes(String(input.value))) {
    throw new Error('measurement_units debe ser metric o imperial');
  }
  return { prefKey: input.prefKey, value: input.value, userId: input.userId, sucursalId: input.sucursalId, updatedAt: input.now.toISOString() };
}

export class InMemoryUserPreferenceStore implements UserPreferenceStore {
  private readonly preferences = new Map<string, UserPreference>();

  async save(preference: UserPreference): Promise<void> {
    this.preferences.set(`${preference.userId}|${preference.sucursalId}|${preference.prefKey}`, preference);
  }

  async get(userId: string, sucursalId: string, prefKey: string): Promise<UserPreference | undefined> {
    return this.preferences.get(`${userId}|${sucursalId}|${prefKey}`);
  }

  async list(userId: string, sucursalId: string): Promise<UserPreference[]> {
    return Array.from(this.preferences.values())
      .filter((p) => p.userId === userId && p.sucursalId === sucursalId)
      .sort((a, b) => a.prefKey.localeCompare(b.prefKey));
  }

  async delete(userId: string, sucursalId: string, prefKey: string): Promise<boolean> {
    return this.preferences.delete(`${userId}|${sucursalId}|${prefKey}`);
  }
}

export class SqlUserPreferenceStore implements UserPreferenceStore {
  async save(preference: UserPreference): Promise<void> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    await pool
      .request()
      .input('user_id', sql.UniqueIdentifier(), preference.userId)
      .input('sucursal_id', sql.UniqueIdentifier(), preference.sucursalId)
      .input('pref_key', sql.NVarChar(50), preference.prefKey)
      .input('pref_value', sql.NVarChar(200), String(preference.value))
      .input('updated_at', sql.DateTime2(3), new Date(preference.updatedAt))
      .query(
        `MERGE ai_user_preferences AS target
         USING (SELECT @user_id AS user_id, @sucursal_id AS sucursal_id, @pref_key AS pref_key) AS source
           ON target.user_id = source.user_id AND target.sucursal_id = source.sucursal_id AND target.pref_key = source.pref_key
         WHEN MATCHED THEN UPDATE SET pref_value = @pref_value, updated_at = @updated_at
         WHEN NOT MATCHED THEN INSERT (user_id, sucursal_id, pref_key, pref_value, updated_at)
           VALUES (@user_id, @sucursal_id, @pref_key, @pref_value, @updated_at);`,
      );
  }

  async get(userId: string, sucursalId: string, prefKey: string): Promise<UserPreference | undefined> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('user_id', sql.UniqueIdentifier(), userId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('pref_key', sql.NVarChar(50), prefKey)
      .query('SELECT TOP 1 * FROM ai_user_preferences WHERE user_id = @user_id AND sucursal_id = @sucursal_id AND pref_key = @pref_key');
    return result.recordset[0] ? mapPreferenceRow(result.recordset[0]) : undefined;
  }

  async list(userId: string, sucursalId: string): Promise<UserPreference[]> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('user_id', sql.UniqueIdentifier(), userId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .query('SELECT * FROM ai_user_preferences WHERE user_id = @user_id AND sucursal_id = @sucursal_id ORDER BY pref_key');
    return result.recordset.map(mapPreferenceRow);
  }

  async delete(userId: string, sucursalId: string, prefKey: string): Promise<boolean> {
    const { getPool } = await import('../../../db/connection.js');
    const sql = (await import('mssql')).default;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('user_id', sql.UniqueIdentifier(), userId)
      .input('sucursal_id', sql.UniqueIdentifier(), sucursalId)
      .input('pref_key', sql.NVarChar(50), prefKey)
      .query('DELETE FROM ai_user_preferences WHERE user_id = @user_id AND sucursal_id = @sucursal_id AND pref_key = @pref_key');
    return result.rowsAffected[0] > 0;
  }
}

function mapPreferenceRow(row: Record<string, unknown>): UserPreference {
  const raw = String(row.pref_value);
  const parsed: PreferenceValue = raw === 'true' ? true : raw === 'false' ? false : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
  return {
    prefKey: String(row.pref_key),
    value: parsed,
    userId: String(row.user_id),
    sucursalId: String(row.sucursal_id),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export function selectUserPreferenceStore(env: NodeJS.ProcessEnv = process.env): UserPreferenceStore {
  return env.AI_MEMORY_STORE === 'sql' ? new SqlUserPreferenceStore() : inMemoryUserPreferenceStore;
}

export const inMemoryUserPreferenceStore = new InMemoryUserPreferenceStore();

export type PreferenceApplication = 'style' | 'format' | 'routing';

export interface AppliedPreferences {
  hints: Array<{ prefKey: string; value: PreferenceValue; application: PreferenceApplication }>;
}

/**
 * Aplica preferencias a la petición: SOLO estilo/forma/routing.
 * El hint de modelo es informativo: NUNCA desbloquea capacidades ni certificación.
 */
export function applyUserPreferences(input: { preferences: UserPreference[] }): AppliedPreferences {
  const hints: AppliedPreferences['hints'] = [];
  for (const pref of input.preferences) {
    if (pref.prefKey === 'output_format' || pref.prefKey === 'language' || pref.prefKey === 'measurement_units') {
      hints.push({ prefKey: pref.prefKey, value: pref.value, application: 'format' });
    } else if (pref.prefKey === 'verbosity' || pref.prefKey === 'assistant_style') {
      hints.push({ prefKey: pref.prefKey, value: pref.value, application: 'style' });
    } else if (pref.prefKey === 'preferred_model_hint') {
      hints.push({ prefKey: pref.prefKey, value: pref.value, application: 'routing' });
    }
  }
  return { hints };
}