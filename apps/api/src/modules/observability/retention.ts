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

export function readTelemetryRetention(env: NodeJS.ProcessEnv = process.env): TelemetryRetentionConfig {
  return {
    rawEventsDays: Number(env.AI_TELEMETRY_RETENTION_RAW_DAYS ?? 7),
    aggregatesDays: Number(env.AI_TELEMETRY_RETENTION_AGG_DAYS ?? 90),
    alertDays: Number(env.AI_TELEMETRY_RETENTION_ALERT_DAYS ?? 30),
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