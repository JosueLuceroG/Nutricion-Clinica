/**
 * Retencion de telemetria (configurable, documentada).
 * Eventos crudos de alta cardinalidad: retencion corta.
 * Agregados: retencion larga.
 * No se inventan requisitos legales: son valores operativos configurables.
 */
export interface TelemetryRetentionConfig {
  rawEventsDays: number;
  aggregatesDays: number;
  alertDays: number;
}

function readRetentionDays(
  raw: string | undefined,
  fallback: number,
  name: string,
): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 36_500) {
    throw new Error(`${name} debe ser entero entre 1 y 36500`);
  }
  return value;
}

export function readTelemetryRetention(
  env: NodeJS.ProcessEnv = process.env,
): TelemetryRetentionConfig {
  return {
    rawEventsDays: readRetentionDays(
      env.AI_TELEMETRY_RETENTION_RAW_DAYS,
      7,
      "AI_TELEMETRY_RETENTION_RAW_DAYS",
    ),
    aggregatesDays: readRetentionDays(
      env.AI_TELEMETRY_RETENTION_AGG_DAYS,
      90,
      "AI_TELEMETRY_RETENTION_AGG_DAYS",
    ),
    alertDays: readRetentionDays(
      env.AI_TELEMETRY_RETENTION_ALERT_DAYS,
      30,
      "AI_TELEMETRY_RETENTION_ALERT_DAYS",
    ),
  };
}

export function retentionPurgeSql(env: NodeJS.ProcessEnv = process.env): string {
  const cfg = readTelemetryRetention(env);
  return `
    DELETE FROM ai_telemetry_events WHERE ts < DATEADD(day, -${cfg.rawEventsDays}, SYSUTCDATETIME());
    DELETE FROM ai_telemetry_aggregates WHERE updated_at < DATEADD(day, -${cfg.aggregatesDays}, SYSUTCDATETIME());
    DELETE FROM ai_telemetry_alerts WHERE created_at < DATEADD(day, -${cfg.alertDays}, SYSUTCDATETIME());
  `;
}
