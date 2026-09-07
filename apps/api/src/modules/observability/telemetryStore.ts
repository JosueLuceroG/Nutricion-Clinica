import sql from "mssql";
import { getPool } from "../../db/connection.js";
import {
  assertNoPhiFields,
  type SafeCounts,
  type TelemetryEvent,
} from "./telemetryTypes.js";

/**
 * Almacen de telemetria. Store primario SEPARADO del DWH clinico.
 * Seleccion por env AI_TELEMETRY_STORE (memory | sql). La escritura es
 * fail-soft: un fallo de telemetria nunca rompe el flujo de negocio y
 * NUNCA condiciona la llamada al provider.
 */

export interface TelemetryStore {
  readonly kind: "memory" | "sql";
  record(event: TelemetryEvent): Promise<void>;
  recordAggregate(
    metricKey: string,
    metricType: string,
    valueType: string,
    value: number,
    sampleCount: number,
  ): Promise<void>;
  recent(limit: number): Promise<TelemetryEvent[]>;
  findAggregate(
    metricKeyPrefix: string,
  ): Promise<
    Array<{
      metricKey: string;
      metricType: string;
      valueType: string;
      value: number;
      sampleCount: number;
    }>
  >;
  clear(): Promise<void>;
}

const MAX_EVENT_BYTES = Number(
  process.env.AI_TELEMETRY_MAX_EVENT_BYTES ?? 2048,
);

export function boundEventSize(event: TelemetryEvent): TelemetryEvent {
  const json = JSON.stringify(event);
  if (json.length > MAX_EVENT_BYTES) {
    return {
      ...event,
      counts: {},
      latencyMs: {},
      versionBundle: undefined,
      reasonCode: undefined,
    };
  }
  return event;
}

export function serializeTelemetryDetails(event: TelemetryEvent): string | null {
  if (!event.counts && !event.latencyMs) return null;
  return JSON.stringify({
    ...(event.counts ? { counts: event.counts } : {}),
    ...(event.latencyMs ? { latencyMs: event.latencyMs } : {}),
  });
}

export function parseTelemetryDetails(value: string | null): {
  counts?: SafeCounts;
  latencyMs?: SafeCounts;
} {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (parsed.counts || parsed.latencyMs) {
      return {
        counts: parsed.counts as SafeCounts | undefined,
        latencyMs: parsed.latencyMs as SafeCounts | undefined,
      };
    }
    // Rows written before the envelope was introduced stored counts directly.
    return { counts: parsed as SafeCounts };
  } catch {
    return {};
  }
}

class InMemoryTelemetryStore implements TelemetryStore {
  readonly kind = "memory" as const;
  private readonly events: TelemetryEvent[] = [];
  private readonly aggregates: Map<
    string,
    {
      metricType: string;
      valueType: string;
      value: number;
      sampleCount: number;
    }
  > = new Map();
  private readonly maxEntries = 2000;

  async record(event: TelemetryEvent): Promise<void> {
    const bounded = boundEventSize(event);
    assertNoPhiFields(bounded);
    this.events.push(bounded);
    if (this.events.length > this.maxEntries) {
      this.events.splice(0, this.events.length - this.maxEntries);
    }
  }

  async recordAggregate(
    metricKey: string,
    metricType: string,
    valueType: string,
    value: number,
    sampleCount: number,
  ): Promise<void> {
    const key = `${metricKey}|${metricType}|${valueType}`;
    const existing = this.aggregates.get(key);
    if (existing) {
      if (valueType === "count") {
        existing.value += value;
        existing.sampleCount += sampleCount;
      } else {
        existing.value = value;
        existing.sampleCount = sampleCount;
      }
    } else {
      this.aggregates.set(key, { metricType, valueType, value, sampleCount });
    }
  }

  async recent(limit: number): Promise<TelemetryEvent[]> {
    return this.events.slice(-limit).map((e) => ({ ...e }));
  }

  async findAggregate(
    metricKeyPrefix: string,
  ): Promise<
    Array<{
      metricKey: string;
      metricType: string;
      valueType: string;
      value: number;
      sampleCount: number;
    }>
  > {
    const out: Array<{
      metricKey: string;
      metricType: string;
      valueType: string;
      value: number;
      sampleCount: number;
    }> = [];
    for (const [key, agg] of this.aggregates) {
      if (key.startsWith(metricKeyPrefix)) {
        const [metricKey, metricType, valueType] = key.split("|");
        out.push({
          metricKey: metricKey!,
          metricType: metricType!,
          valueType: valueType!,
          value: agg.value,
          sampleCount: agg.sampleCount,
        });
      }
    }
    return out;
  }

  async clear(): Promise<void> {
    this.events.length = 0;
    this.aggregates.clear();
  }
}

class SqlTelemetryStore implements TelemetryStore {
  readonly kind = "sql" as const;

  private pool(): Promise<sql.ConnectionPool> {
    return getPool();
  }

  async record(event: TelemetryEvent): Promise<void> {
    const bounded = boundEventSize(event);
    assertNoPhiFields(bounded);
    const pool = await this.pool();
    const detailsJson = serializeTelemetryDetails(bounded);
    await pool
      .request()
      .input("executionId", sql.NVarChar(64), bounded.executionId)
      .input("correlationId", sql.NVarChar(64), bounded.correlationId ?? null)
      .input("eventType", sql.NVarChar(64), bounded.eventType)
      .input("capability", sql.NVarChar(64), bounded.capability ?? null)
      .input("provider", sql.NVarChar(64), bounded.provider ?? null)
      .input("model", sql.NVarChar(64), bounded.model ?? null)
      .input("toolId", sql.NVarChar(64), bounded.toolCallId ?? null)
      .input("status", sql.NVarChar(32), bounded.status)
      .input("reasonCode", sql.NVarChar(64), bounded.reasonCode ?? null)
      .input(
        "riskLevel",
        sql.NVarChar(16),
        bounded.effectiveRisk ?? bounded.baseRisk ?? null,
      )
      .input("durationMs", sql.Int, bounded.durationMs ?? null)
      .input("versionBundle", sql.NVarChar(200), bounded.versionBundle ?? null)
      .input("countsJson", sql.NVarChar(2000), detailsJson).query(`
        INSERT INTO ai_telemetry_events (event_type, execution_id, correlation_id, capability, provider, model, tool_id, status, reason_code, risk_level, duration_ms, version_bundle, counts_json)
        SELECT @eventType, @executionId, @correlationId, @capability, @provider, @model, @toolId, @status, @reasonCode, @riskLevel, @durationMs, @versionBundle, @countsJson
        WHERE NOT EXISTS (
          SELECT 1 FROM ai_telemetry_events
          WHERE event_type = @eventType AND execution_id = @executionId AND ts > DATEADD(hour, -1, SYSUTCDATETIME())
        )
      `);
  }

  async recordAggregate(
    metricKey: string,
    metricType: string,
    valueType: string,
    value: number,
    sampleCount: number,
  ): Promise<void> {
    const pool = await this.pool();
    await pool
      .request()
      .input("metricKey", sql.NVarChar(200), metricKey)
      .input("metricType", sql.NVarChar(32), metricType)
      .input("valueType", sql.NVarChar(16), valueType)
      .input("value", sql.Float, value)
      .input("sampleCount", sql.Int, sampleCount).query(`
        MERGE ai_telemetry_aggregates WITH (HOLDLOCK) AS t
        USING (SELECT @metricKey AS metric_key, @metricType AS metric_type, @valueType AS value_type) AS s
        ON t.metric_key = s.metric_key AND t.metric_type = s.metric_type AND t.value_type = s.value_type
        WHEN MATCHED THEN
          UPDATE SET
            t.value = CASE WHEN @valueType = 'count' THEN t.value + @value ELSE @value END,
            t.sample_count = CASE WHEN @valueType = 'count' THEN t.sample_count + @sampleCount ELSE @sampleCount END,
            t.updated_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (metric_key, window_ts, metric_type, value_type, value, sample_count)
          VALUES (@metricKey, SYSUTCDATETIME(), @metricType, @valueType, @value, @sampleCount);
      `);
  }

  async recent(limit: number): Promise<TelemetryEvent[]> {
    const pool = await this.pool();
    const result = await pool.request().input("limit", sql.Int, limit).query<{
      event_type: string;
      execution_id: string;
      correlation_id: string | null;
      capability: string | null;
      provider: string | null;
      model: string | null;
      status: string;
      reason_code: string | null;
      risk_level: string | null;
      duration_ms: number | null;
      counts_json: string | null;
    }>(`
        SELECT TOP (@limit) event_type, execution_id, correlation_id, capability, provider, model, status, reason_code, risk_level, duration_ms, counts_json
        FROM ai_telemetry_events
        ORDER BY event_id DESC
      `);
    return result.recordset.map((r) => {
      const details = parseTelemetryDetails(r.counts_json);
      return {
        eventType: r.event_type as TelemetryEvent["eventType"],
        executionId: r.execution_id,
        correlationId: r.correlation_id ?? undefined,
        capability: r.capability ?? undefined,
        provider: r.provider ?? undefined,
        model: r.model ?? undefined,
        status: r.status,
        reasonCode: r.reason_code ?? undefined,
        durationMs: r.duration_ms ?? undefined,
        ...details,
      };
    });
  }

  async findAggregate(
    metricKeyPrefix: string,
  ): Promise<
    Array<{
      metricKey: string;
      metricType: string;
      valueType: string;
      value: number;
      sampleCount: number;
    }>
  > {
    const pool = await this.pool();
    const result = await pool
      .request()
      .input("prefix", sql.NVarChar(200), `${metricKeyPrefix}%`).query<{
      metric_key: string;
      metric_type: string;
      value_type: string;
      value: number;
      sample_count: number;
    }>(`
        SELECT metric_key, metric_type, value_type, value, sample_count
        FROM ai_telemetry_aggregates
        WHERE metric_key LIKE @prefix
      `);
    return result.recordset.map((r) => ({
      metricKey: r.metric_key,
      metricType: r.metric_type,
      valueType: r.value_type,
      value: r.value,
      sampleCount: r.sample_count,
    }));
  }

  async clear(): Promise<void> {
    const pool = await this.pool();
    await pool
      .request()
      .batch(
        "DELETE FROM ai_telemetry_events; DELETE FROM ai_telemetry_aggregates; DELETE FROM ai_telemetry_alerts;",
      );
  }
}

let store: TelemetryStore | null = null;

export function selectTelemetryStore(
  env: NodeJS.ProcessEnv = process.env,
): TelemetryStore {
  const kind =
    (env.AI_TELEMETRY_STORE ?? "memory").trim() === "sql" ? "sql" : "memory";
  if (store && store.kind === kind) return store;
  store =
    kind === "sql" ? new SqlTelemetryStore() : new InMemoryTelemetryStore();
  return store;
}

export function resetTelemetryStoreForTests(): void {
  store = null;
}

export { MAX_EVENT_BYTES };
