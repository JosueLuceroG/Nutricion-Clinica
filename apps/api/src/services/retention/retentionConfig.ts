export const RETENTION_CONFIG = {
  /** Años que deben conservarse las grabaciones antes de ser eliminadas */
  get years(): number {
    const raw = process.env.RECORDING_RETENTION_YEARS?.trim();
    if (!raw) return 10;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      throw new Error(
        "RECORDING_RETENTION_YEARS debe ser entero entre 1 y 100",
      );
    }
    return value;
  },

  /** Habilitar/deshabilitar el cleanup automático */
  get cleanupEnabled(): boolean {
    return (
      process.env.RETENTION_CLEANUP_ENABLED?.trim().toLowerCase() === "true"
    );
  },

  /** Expresión cron para el schedule (default: diario a las 03:00) */
  get cronSchedule(): string {
    return process.env.RETENTION_CRON_SCHEDULE ?? "0 3 * * *";
  },

  get cronTimezone(): string {
    const timezone = process.env.RETENTION_CRON_TIMEZONE?.trim() || "UTC";
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      throw new Error(`RETENTION_CRON_TIMEZONE invalido: '${timezone}'`);
    }
    return timezone;
  },

  get dryRun(): boolean {
    return process.env.RETENTION_CLEANUP_DRY_RUN !== "false";
  },

  get legalHoldReviewAttested(): boolean {
    return process.env.RETENTION_LEGAL_HOLD_REVIEW_ATTESTED === "true";
  },

  get batchSize(): number {
    const raw = process.env.RETENTION_CLEANUP_BATCH_SIZE?.trim();
    if (!raw) return 100;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      throw new Error(
        "RETENTION_CLEANUP_BATCH_SIZE debe ser entero entre 1 y 1000",
      );
    }
    return value;
  },
};
