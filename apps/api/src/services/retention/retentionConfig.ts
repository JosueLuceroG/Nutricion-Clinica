export const RETENTION_CONFIG = {
  /** Años que deben conservarse las grabaciones antes de ser eliminadas */
  get years(): number {
    const val = Number(process.env.RECORDING_RETENTION_YEARS);
    return Number.isFinite(val) && val >= 1 ? val : 10;
  },

  /** Habilitar/deshabilitar el cleanup automático */
  get cleanupEnabled(): boolean {
    return process.env.RETENTION_CLEANUP_ENABLED !== 'false';
  },

  /** Expresión cron para el schedule (default: diario a las 03:00) */
  get cronSchedule(): string {
    return process.env.RETENTION_CRON_SCHEDULE ?? '0 3 * * *';
  },
};
